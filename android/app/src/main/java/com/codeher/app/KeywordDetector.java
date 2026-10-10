package com.codeher.app;

import android.content.Context;

/**
 * On-device keyword detection contract (codeHER.md §3).
 *
 * <p>Phase 2 fills this in with Vosk (small model, restricted grammar limited
 * to the configured phrase plus filler). The service drives the mic; the
 * engine only reports matches — raw audio is never stored or transmitted.
 */
public interface KeywordDetector {

    /** Fired on the engine's thread when the phrase matches above threshold. */
    interface Listener {
        void onPhrase(String phrase, double confidence);
    }

    void start(Context context, String phrase, Listener listener);

    void stop();
}
