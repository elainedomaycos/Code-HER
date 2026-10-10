package com.codeher.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.telephony.SmsManager;
import android.telephony.SubscriptionManager;
import android.util.Log;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Emergency SMS sending (codeHER.md §5).
 *
 * <p>Sends via {@link SmsManager} — the cellular radio, no internet needed.
 * Numbers are validated to PH format before touching the radio. Failures
 * throw so the JS layer can map them to queued/failed per-contact status.
 * The retry outbox persists in SharedPreferences so queued messages survive
 * process death and are flushed when signal returns.
 */
public class HerSmsSender {

    private static final String TAG = "HerSms";
    private static final String PREFS = "codeher_sms";
    private static final String KEY_OUTBOX = "outbox";
    private static final Pattern PHONE_RE = Pattern.compile("^\\+639\\d{9}$");

    public static boolean isValidNumber(String to) {
        return to != null && PHONE_RE.matcher(to).matches();
    }

    public static void send(Context context, String to, String body) throws Exception {
        sendInternal(context, to, body, null, false);
    }

    /**
     * Send with sent/delivery receipts tracked under {@code token} by
     * {@link SmsStatusReceiver} via the framework default manager — the same
     * routing the stock Messages app uses.
     */
    public static void sendWithReceipts(Context context, String to, String body, String token)
            throws Exception {
        if (token == null || token.isEmpty()) {
            throw new IllegalArgumentException("send-failed");
        }
        sendInternal(context, to, body, token, false);
    }

    /**
     * Same, but via the explicitly resolved subscription. Fallback when the
     * framework default fails (stale default-subscription records after SIM
     * swaps are a known cause of generic radio failures).
     */
    public static void sendWithReceiptsViaSubscription(
            Context context, String to, String body, String token) throws Exception {
        if (token == null || token.isEmpty()) {
            throw new IllegalArgumentException("send-failed");
        }
        sendInternal(context, to, body, token, true);
    }

    private static void sendInternal(
            Context context, String to, String body, String token, boolean viaSubscription)
            throws Exception {
        if (!isValidNumber(to)) {
            throw new IllegalArgumentException("invalid-number");
        }
        SmsManager sms = viaSubscription ? subscriptionManager(context) : frameworkManager(context);
        if (sms == null) {
            throw new IllegalStateException("send-failed");
        }
        Log.i(TAG, "sending via " + (viaSubscription ? "subscription" : "framework-default"));
        try {
            ArrayList<String> parts = sms.divideMessage(body == null ? "" : body);
            if (parts == null || parts.isEmpty()) {
                throw new IllegalStateException("send-failed");
            }
            if (token == null) {
                if (parts.size() > 1) {
                    sms.sendMultipartTextMessage(to, null, parts, null, null);
                } else {
                    sms.sendTextMessage(to, null, body, null, null);
                }
                return;
            }
            SmsStatusReceiver.expectParts(token, parts.size());
            try {
                if (parts.size() > 1) {
                    ArrayList<PendingIntent> sentIntents = new ArrayList<>();
                    ArrayList<PendingIntent> deliveredIntents = new ArrayList<>();
                    for (int i = 0; i < parts.size(); i++) {
                        sentIntents.add(sentIntent(context, token, parts.size(), i));
                        deliveredIntents.add(deliveredIntent(context, token, i));
                    }
                    sms.sendMultipartTextMessage(to, null, parts, sentIntents, deliveredIntents);
                } else {
                    sms.sendTextMessage(
                            to, null, body, sentIntent(context, token, 1, 0),
                            deliveredIntent(context, token, 0));
                }
            } catch (Exception e) {
                SmsStatusReceiver.clear(token);
                throw e;
            }
        } catch (SecurityException e) {
            throw new SecurityException("send-failed", e);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("send-failed", e);
        }
    }

    private static PendingIntent sentIntent(Context context, String token, int parts, int index) {
        Intent intent = new Intent(SmsStatusReceiver.ACTION_SMS_SENT);
        intent.setPackage(context.getPackageName());
        intent.putExtra(SmsStatusReceiver.EXTRA_TOKEN, token);
        intent.putExtra(SmsStatusReceiver.EXTRA_PARTS, parts);
        return PendingIntent.getBroadcast(
                context,
                token.hashCode() * 31 + index,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent deliveredIntent(Context context, String token, int index) {
        Intent intent = new Intent(SmsStatusReceiver.ACTION_SMS_DELIVERED);
        intent.setPackage(context.getPackageName());
        intent.putExtra(SmsStatusReceiver.EXTRA_TOKEN, token);
        return PendingIntent.getBroadcast(
                context,
                token.hashCode() * 31 + 0x1000 + index,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /**
     * Framework default routing — exactly what the stock Messages app uses.
     * Primary path; the subscription manager is the fallback.
     */
    private static SmsManager frameworkManager(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return context.getSystemService(SmsManager.class);
        }
        return SmsManager.getDefault();
    }

    /**
     * Dual-SIM aware manager: the default SMS subscription when one is set,
     * else the framework default. On dual-SIM phones without a default, the
     * plain default manager can fail every send.
     */
    private static SmsManager subscriptionManager(Context context) {
        try {
            int subId = SubscriptionManager.getDefaultSmsSubscriptionId();
            if (subId > SubscriptionManager.INVALID_SUBSCRIPTION_ID) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    SmsManager sms = context.getSystemService(SmsManager.class);
                    if (sms != null) {
                        return sms.createForSubscriptionId(subId);
                    }
                } else {
                    return SmsManager.getSmsManagerForSubscriptionId(subId);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "subscription lookup failed, using default manager", e);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return context.getSystemService(SmsManager.class);
        }
        return SmsManager.getDefault();
    }

    /** Persist a message for later retry (survives process death). */
    public static void queue(Context context, String to, String body) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray outbox = new JSONArray(prefs.getString(KEY_OUTBOX, "[]"));
            JSONObject entry = new JSONObject();
            entry.put("to", to);
            entry.put("body", body);
            outbox.put(entry);
            prefs.edit().putString(KEY_OUTBOX, outbox.toString()).apply();
        } catch (Exception e) {
            Log.w(TAG, "queue persist failed", e);
        }
    }

    /** Load and clear the persisted outbox. */
    public static List<String[]> drain(Context context) {
        List<String[]> items = new ArrayList<>();
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray outbox = new JSONArray(prefs.getString(KEY_OUTBOX, "[]"));
            prefs.edit().remove(KEY_OUTBOX).apply();
            for (int i = 0; i < outbox.length(); i++) {
                JSONObject entry = outbox.getJSONObject(i);
                items.add(new String[] {entry.optString("to"), entry.optString("body")});
            }
        } catch (Exception e) {
            Log.w(TAG, "outbox drain failed", e);
        }
        return items;
    }
}
