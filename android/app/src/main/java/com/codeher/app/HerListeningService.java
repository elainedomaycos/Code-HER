package com.codeher.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;

/**
 * Foreground service that owns the microphone while listening (codeHER.md §3).
 *
 * <p>Keeps running with the screen off via a persistent low-importance
 * notification. Drives a {@link KeywordDetector}; matches are forwarded to
 * JS through {@link HerNativePlugin#emitDetection}. Raw audio never leaves
 * the engine — nothing is recorded or uploaded.
 */
public class HerListeningService extends Service {

    private static final String TAG = "HerListening";
    private static final String CHANNEL_ID = "codeher_listening";
    private static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_START = "com.codeher.app.action.START_LISTENING";
    public static final String ACTION_STOP = "com.codeher.app.action.STOP_LISTENING";
    public static final String EXTRA_PHRASE = "com.codeher.app.extra.PHRASE";

    private static volatile String status = "stopped";
    private static volatile String activePhrase = "help me";

    // Vosk on-device engine. Swap back to StubKeywordDetector only to test
    // the service/permission/event path without the ~70 MB model.
    private static KeywordDetector detector = new VoskKeywordDetector();

    /** Start (or re-target) listening. Safe to call repeatedly. */
    public static void start(Context context, String phrase) {
        if (phrase != null && !phrase.isEmpty()) {
            activePhrase = phrase;
        }
        Intent intent = new Intent(context, HerListeningService.class);
        intent.setAction(ACTION_START);
        intent.putExtra(EXTRA_PHRASE, activePhrase);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    /** Stop listening and dismiss the notification. */
    public static void stop(Context context) {
        Intent intent = new Intent(context, HerListeningService.class);
        intent.setAction(ACTION_STOP);
        context.startService(intent);
    }

    /** "listening" or "stopped" — surfaced to JS via HerNative.getStatus. */
    public static String getStatus() {
        return status;
    }

    /** Retarget the phrase; takes effect on the next start. */
    public static void setPhrase(String phrase) {
        if (phrase != null && !phrase.isEmpty()) {
            activePhrase = phrase;
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_STICKY;
        }
        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(action)) {
            return START_STICKY;
        }
        String phrase = intent.getStringExtra(EXTRA_PHRASE);
        if (phrase != null && !phrase.isEmpty()) {
            activePhrase = phrase;
        }
        startForegroundWithNotification();
        status = "listening";
        try {
            detector.start(this, activePhrase, HerNativePlugin::emitDetection);
        } catch (Exception e) {
            Log.e(TAG, "keyword detector failed to start", e);
            stopSelf();
            return START_NOT_STICKY;
        }
        Log.i(TAG, "listening for phrase, mic held by foreground service");
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        try {
            detector.stop();
        } catch (Exception e) {
            Log.w(TAG, "keyword detector stop failed", e);
        }
        status = "stopped";
        stopForeground(true);
        super.onDestroy();
    }

    private void startForegroundWithNotification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "CodeHER listening",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shows while CodeHER listens for your safe phrase on this device.");
            manager.createNotificationChannel(channel);
        }
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pending = PendingIntent.getActivity(
                this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("CodeHER is listening")
                .setContentText("Say \"" + activePhrase + "\" to trigger an alert. Audio stays on this device.")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pending)
                .setOngoing(true)
                .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                    NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }
}
