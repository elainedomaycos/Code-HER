package com.codeher.app;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.telephony.SmsManager;
import android.util.Log;
import java.util.HashMap;
import java.util.Map;

/**
 * Delivery receipts for emergency SMS (codeHER.md §5/§11).
 *
 * <p>Listens for the sent + delivered intents fired per message part and
 * forwards one verdict per token to JS via
 * {@link HerNativePlugin#emitSmsStatus}. Multipart messages resolve when
 * every part resolves. Result mapping: handed to the radio → "sent";
 * no service / radio off → "no-signal" (retryable); anything else →
 * "send-failed". Delivery receipts are informational — "sent" is what the
 * UI renders.
 */
public class SmsStatusReceiver extends BroadcastReceiver {

    private static final String TAG = "HerSms";

    public static final String ACTION_SMS_SENT = "com.codeher.app.action.SMS_SENT";
    public static final String ACTION_SMS_DELIVERED = "com.codeher.app.action.SMS_DELIVERED";
    public static final String EXTRA_TOKEN = "com.codeher.app.extra.SMS_TOKEN";
    public static final String EXTRA_PARTS = "com.codeher.app.extra.SMS_PARTS";

    // token → parts still outstanding. Guarded by the class lock; callbacks
    // arrive on the main thread.
    private static final Map<String, int[]> pendingParts = new HashMap<>();

    static void expectParts(String token, int parts) {
        synchronized (pendingParts) {
            pendingParts.put(token, new int[] {parts});
        }
    }

    static void clear(String token) {
        synchronized (pendingParts) {
            pendingParts.remove(token);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) {
            return;
        }
        String token = intent.getStringExtra(EXTRA_TOKEN);
        if (token == null) {
            return;
        }
        String action = intent.getAction();
        if (ACTION_SMS_SENT.equals(action)) {
            onSent(token, getResultCode());
        } else if (ACTION_SMS_DELIVERED.equals(action)) {
            if (getResultCode() == Activity.RESULT_OK) {
                HerNativePlugin.emitSmsStatus(token, "delivered", null);
            }
        }
    }

    private void onSent(String token, int resultCode) {
        switch (resultCode) {
            case Activity.RESULT_OK:
                finishPart(token, "sent", null);
                break;
            case SmsManager.RESULT_ERROR_NO_SERVICE:
            case SmsManager.RESULT_ERROR_RADIO_OFF:
                finishPart(token, "failed", "no-signal");
                break;
            default:
                Log.w(TAG, "sms sent failed, result=" + resultCode);
                finishPart(token, "failed", "send-failed");
                break;
        }
    }

    /** Emit once every part of the token has resolved. */
    private void finishPart(String token, String phase, String error) {
        boolean last;
        synchronized (pendingParts) {
            int[] remaining = pendingParts.get(token);
            if (remaining == null) {
                // Unknown token (e.g. after a retry round re-sent it): emit directly.
                HerNativePlugin.emitSmsStatus(token, phase, error);
                return;
            }
            remaining[0]--;
            last = remaining[0] <= 0;
            if (last) {
                pendingParts.remove(token);
            }
        }
        if (last) {
            HerNativePlugin.emitSmsStatus(token, phase, error);
        }
    }
}
