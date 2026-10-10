package com.codeher.app;

import android.content.Context;
import android.util.Log;

/**
 * Placeholder engine: opens no mic stream and emits no detections.
 *
 * <p>Replaced by the Vosk integration (Phase 2): load the small model from
 * app assets, set a restricted grammar for the configured phrase, feed it
 * 16 kHz PCM from the foreground service's AudioRecord, and call
 * {@code listener.onPhrase(...)} on match. Until then the status path,
 * permission path, and event bridge are fully testable without claiming any
 * detection accuracy (codeHER.md honesty rules).
 */
public class StubKeywordDetector implements KeywordDetector {

    private static final String TAG = "HerListening";

    @Override
    public void start(Context context, String phrase, Listener listener) {
        Log.i(TAG, "StubKeywordDetector: Vosk engine not wired yet, no detections will fire");
    }

    @Override
    public void stop() {
        // Nothing held.
    }
}
