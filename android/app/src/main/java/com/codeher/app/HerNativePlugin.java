package com.codeher.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.location.Location;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Capacitor bridge for CodeHER's native layer (codeHER.md §3).
 *
 * <p>JS never touches Android APIs directly: every call goes through the
 * typed {@code ListeningService} in src/services (native implementation),
 * which calls these methods. Detections flow back as {@code phraseDetected}
 * events with phrase + confidence + timestamp.
 */
@CapacitorPlugin(
        name = "HerNative",
        permissions = {
            @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone"),
            @Permission(
                    strings = {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    alias = "location"),
            @Permission(strings = { Manifest.permission.SEND_SMS }, alias = "sms")
        })
public class HerNativePlugin extends Plugin {

    private static final String EVENT_PHRASE_DETECTED = "phraseDetected";
    private static final String EVENT_SMS_STATUS = "smsStatus";

    private static volatile HerNativePlugin instance;
    private String phrase = "help me";
    private SmsStatusReceiver smsReceiver;

    /** In-flight send awaiting its receipt, with retry state. */
    private static class PendingSend {
        final PluginCall call;
        final String to;
        final String body;
        boolean retried;

        PendingSend(PluginCall call, String to, String body) {
            this.call = call;
            this.to = to;
            this.body = body;
        }
    }

    private final java.util.Map<String, PendingSend> pendingSends = new java.util.HashMap<>();

    @Override
    public void load() {
        instance = this;
        Log.i("HerNative", "bridge loaded, build=" + BuildConfig.BUILD_TAG);
        smsReceiver = new SmsStatusReceiver();
        IntentFilter filter = new IntentFilter();
        filter.addAction(SmsStatusReceiver.ACTION_SMS_SENT);
        filter.addAction(SmsStatusReceiver.ACTION_SMS_DELIVERED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(smsReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(smsReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (smsReceiver != null) {
            try {
                getContext().unregisterReceiver(smsReceiver);
            } catch (Exception ignored) {
            }
            smsReceiver = null;
        }
        synchronized (pendingSends) {
            pendingSends.clear();
        }
        if (instance == this) {
            instance = null;
        }
    }

    /**
     * Forward a detector match to JS. Called on the engine's thread by
     * {@link HerListeningService}; drops the event if the bridge is gone.
     */
    public static void emitDetection(String phrase, double confidence) {
        HerNativePlugin plugin = instance;
        if (plugin == null) {
            return;
        }
        JSObject data = new JSObject();
        data.put("phrase", phrase);
        data.put("confidence", confidence);
        data.put("at", System.currentTimeMillis());
        plugin.notifyListeners(EVENT_PHRASE_DETECTED, data);
    }

    /**
     * Forward an SMS sent/delivery verdict to JS. Called on the main thread
     * by {@link SmsStatusReceiver}; resolves the keep-alive {@code sendSms}
     * call waiting on {@code token}.
     */
    public static void emitSmsStatus(String token, String phase, String error) {
        HerNativePlugin plugin = instance;
        android.util.Log.i(
                "HerSms", "receipt token=" + token + " phase=" + phase + " error=" + error);
        if (plugin == null) {
            return;
        }
        PendingSend pending;
        synchronized (plugin.pendingSends) {
            pending = plugin.pendingSends.remove(token);
        }
        JSObject event = new JSObject();
        event.put("token", token);
        event.put("phase", phase);
        if (error != null) {
            event.put("error", error);
        }
        plugin.notifyListeners(EVENT_SMS_STATUS, event);
        if (pending == null) {
            return;
        }
        if ("sent".equals(phase) || "delivered".equals(phase)) {
            JSObject result = new JSObject();
            result.put("ok", true);
            pending.call.resolve(result);
            return;
        }
        // Generic radio failure: retry once via the other routing path before
        // giving up. No-signal/invalid-number are terminal, not retried.
        if ("send-failed".equals(error) && !pending.retried) {
            pending.retried = true;
            synchronized (plugin.pendingSends) {
                plugin.pendingSends.put(token, pending);
            }
            try {
                android.util.Log.i("HerSms", "retrying via subscription manager, token=" + token);
                HerSmsSender.sendWithReceiptsViaSubscription(
                        plugin.getContext(), pending.to, pending.body, token);
                return;
            } catch (Exception e) {
                synchronized (plugin.pendingSends) {
                    plugin.pendingSends.remove(token);
                }
            }
        }
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("error", error != null ? error : "send-failed");
        pending.call.resolve(result);
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (!hasPermission("microphone")) {
            requestPermissionForAlias("microphone", call, "onMicrophonePermission");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void onMicrophonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            startService(call);
        } else {
            call.reject("Microphone permission denied");
        }
    }

    private void startService(PluginCall call) {
        try {
            HerListeningService.start(getContext(), phrase);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not start listening", e);
        }
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        try {
            HerListeningService.stop(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not stop listening", e);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("status", HerListeningService.getStatus());
        call.resolve(result);
    }

    @PluginMethod
    public void setPhrase(PluginCall call) {
        String next = call.getString("phrase");
        if (next == null || next.isEmpty()) {
            call.reject("phrase is required");
            return;
        }
        phrase = next;
        HerListeningService.setPhrase(next);
        call.resolve();
    }

    // ---- Location (HerLocationProvider: GPS single-update, 8s cap) ----------

    @PluginMethod
    public void getCurrentLocation(PluginCall call) {
        if (!hasPermission("location")) {
            requestPermissionForAlias("location", call, "onLocationPermission");
            return;
        }
        resolveLocation(call);
    }

    @PermissionCallback
    private void onLocationPermission(PluginCall call) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            resolveLocation(call);
        } else {
            call.reject("Location permission denied");
        }
    }

    private void resolveLocation(PluginCall call) {
        HerLocationProvider.getCurrent(
                getContext(),
                (Location location, boolean fresh) -> {
                    if (location == null) {
                        // Empty object = no fix; JS maps it to null and the
                        // SMS goes out without coordinates (codeHER.md §5).
                        call.resolve(new JSObject());
                        return;
                    }
                    JSObject result = new JSObject();
                    result.put("lat", location.getLatitude());
                    result.put("lng", location.getLongitude());
                    result.put("accuracyM", Math.round(location.getAccuracy()));
                    result.put("at", location.getTime());
                    result.put("source", fresh ? "gps" : "last_known");
                    call.resolve(result);
                });
    }

    // ---- SMS (HerSmsSender: SmsManager + persisted retry outbox) ------------

    @PluginMethod
    public void sendSms(PluginCall call) {
        if (!hasPermission("sms")) {
            requestPermissionForAlias("sms", call, "onSmsPermission");
            return;
        }
        resolveSend(call);
    }

    @PermissionCallback
    private void onSmsPermission(PluginCall call) {
        if (getPermissionState("sms") == PermissionState.GRANTED) {
            resolveSend(call);
        } else {
            rejectSend(call, "send-failed");
        }
    }

    private void resolveSend(PluginCall call) {
        String to = call.getString("to");
        String body = call.getString("body", "");
        String token = call.getString("token", "");
        if (!HerSmsSender.isValidNumber(to)) {
            rejectSend(call, "invalid-number");
            return;
        }
        if (token.isEmpty()) {
            rejectSend(call, "send-failed");
            return;
        }
        // The call stays alive until the sent/delivery broadcast resolves it
        // (see emitSmsStatus). JS also runs a 30s timeout as backstop.
        call.setKeepAlive(true);
        synchronized (pendingSends) {
            pendingSends.put(token, new PendingSend(call, to, body));
        }
        try {
            HerSmsSender.sendWithReceipts(getContext(), to, body, token);
        } catch (Exception e) {
            synchronized (pendingSends) {
                pendingSends.remove(token);
            }
            rejectSend(call, "send-failed");
        }
    }

    private void rejectSend(PluginCall call, String error) {
        JSObject result = new JSObject();
        result.put("ok", false);
        result.put("error", error);
        call.resolve(result);
    }

    @PluginMethod
    public void queueSms(PluginCall call) {
        String to = call.getString("to", "");
        String body = call.getString("body", "");
        HerSmsSender.queue(getContext(), to, body);
        call.resolve();
    }

    @PluginMethod
    public void flushSmsQueue(PluginCall call) {
        for (String[] entry : HerSmsSender.drain(getContext())) {
            try {
                HerSmsSender.send(getContext(), entry[0], entry[1]);
            } catch (Exception ignored) {
                // Best effort: a still-failing message is dropped after one
                // retry round and surfaces as failed on the next send.
            }
        }
        call.resolve();
    }

    // ---- Status (radio + grant reads; no prompts here) ----------------------

    @PluginMethod
    public void getConnectivity(PluginCall call) {
        boolean internet = false;
        boolean cellular = false;
        ConnectivityManager manager =
                (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (manager != null) {
            Network active = manager.getActiveNetwork();
            if (active != null) {
                NetworkCapabilities caps = manager.getNetworkCapabilities(active);
                if (caps != null) {
                    internet = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
                    cellular = caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR);
                }
            }
        }
        JSObject result = new JSObject();
        result.put("internet", internet);
        result.put("cellular", cellular);
        call.resolve(result);
    }

    @PluginMethod
    public void getPermissions(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put("mic", isGranted(context, Manifest.permission.RECORD_AUDIO));
        // Coarse is enough to attach an approximate fix; accuracy is reported.
        result.put(
                "location",
                isGranted(context, Manifest.permission.ACCESS_FINE_LOCATION)
                        || isGranted(context, Manifest.permission.ACCESS_COARSE_LOCATION));
        result.put("sms", isGranted(context, Manifest.permission.SEND_SMS));
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        result.put(
                "batteryExempt",
                power != null && power.isIgnoringBatteryOptimizations(context.getPackageName()));
        call.resolve(result);
    }

    private boolean isGranted(Context context, String permission) {
        return ContextCompat.checkSelfPermission(context, permission)
                == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Opens the system "don't optimize battery" prompt. Called from the
     * Settings fix action (JS status layer wires it; browser gets a no-op).
     */
    @PluginMethod
    public void requestBatteryExemption(PluginCall call) {
        try {
            Context context = getContext();
            PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (power != null && power.isIgnoringBatteryOptimizations(context.getPackageName())) {
                call.resolve();
                return;
            }
            android.content.Intent intent =
                    new android.content.Intent(
                            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                            Uri.parse("package:" + context.getPackageName()));
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open battery settings", e);
        }
    }

    /** Build identity for the Settings About row (debuggability). */
    @PluginMethod
    public void getBuildInfo(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put("buildTag", BuildConfig.BUILD_TAG);
        result.put("appId", context.getPackageName());
        result.put("versionName", versionName(context));
        call.resolve(result);
    }

    private String versionName(Context context) {
        try {
            android.content.pm.PackageManager pm = context.getPackageManager();
            String pkg = context.getPackageName();
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                return pm.getPackageInfo(
                                pkg, android.content.pm.PackageManager.PackageInfoFlags.of(0))
                        .versionName;
            }
            return pm.getPackageInfo(pkg, 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }
}
