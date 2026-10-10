package com.codeher.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import java.io.IOException;
import org.json.JSONArray;
import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.android.RecognitionListener;
import org.vosk.android.SpeechService;
import org.vosk.android.StorageService;

/**
 * Vosk on-device keyword detector (codeHER.md §3).
 *
 * <p>Small English model ({@code assets/model-en-us}, ~70 MB, git-ignored —
 * see README for the fetch command), restricted grammar limited to the
 * configured phrase plus the {@code [unk]} filler, 16 kHz mono PCM straight
 * from the mic. Matches fire {@link Listener#onPhrase} with a confidence;
 * the JS layer applies the threshold. Raw audio is consumed frame-by-frame
 * and never stored or transmitted.
 *
 * <p>Accuracy is NOT claimed — it is measured on a real device per
 * docs/ACCURACY_TEST.md, and the partial/final confidence constants below
 * are the tuning knobs.
 */
public class VoskKeywordDetector implements KeywordDetector {

    private static final String TAG = "HerListening";
    private static final float SAMPLE_RATE = 16000.0f;

    /** Asset folder (under android/app/src/main/assets) holding the model. */
    private static final String MODEL_ASSET_PATH = "model-en-us";

    /** Tuning knob — see docs/ACCURACY_TEST.md before changing. */
    /**
     * Fire threshold: only finals whose word-level confidence reaches this
     * fire. Partials are logged, never fired — partial hypotheses are
     * unstable fragments and caused noise-triggered SOS (2026-10-09).
     */
    private static final double MIN_FINAL_CONFIDENCE = 0.9;
    /**
     * Confidence credited to a word-boundary match on final text when the
     * final carries no word array (grammar-mode behavior, measured
     * 2026-10-10). Passes the 0.9 gates by design; lower this if idle noise
     * ever finalizes as the phrase.
     */
    private static final double CONFIDENCE_FINAL_TEXT = 0.95;

    // Unpacking copies ~70 MB; do it once per process.
    private static volatile Model sharedModel;
    private static volatile boolean unpacking;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private volatile SpeechService speechService;
    private volatile Recognizer recognizer;
    private volatile boolean running;

    @Override
    public void start(Context context, String phrase, Listener listener) {
        if (running) {
            return;
        }
        running = true;
        String target = sanitize(phrase);
        if (sharedModel != null) {
            beginListening(target, listener);
            return;
        }
        synchronized (VoskKeywordDetector.class) {
            if (unpacking) {
                Log.i(TAG, "model unpack already in progress");
                return;
            }
            unpacking = true;
        }
        new Thread(
                () -> {
                    try {
                        StorageService.unpack(
                                context.getApplicationContext(),
                                MODEL_ASSET_PATH,
                                "model",
                                model -> {
                                    sharedModel = model;
                                    synchronized (VoskKeywordDetector.class) {
                                        unpacking = false;
                                    }
                                    if (running) {
                                        beginListening(target, listener);
                                    }
                                },
                                e -> {
                                    Log.e(TAG, "model unpack failed", e);
                                    synchronized (VoskKeywordDetector.class) {
                                        unpacking = false;
                                    }
                                    running = false;
                                });
                    } catch (Exception e) {
                        Log.e(TAG, "model unpack failed", e);
                        synchronized (VoskKeywordDetector.class) {
                            unpacking = false;
                        }
                        running = false;
                    }
                },
                "vosk-unpack")
                .start();
    }

    private void beginListening(String target, Listener listener) {
        try {
            // Phrase-only grammar (no [unk] filler): with a filler the engine
            // mapped idle noise to the phrase in endless partials (2026-10-10).
            // If spoken "help" stops registering, restore "[unk]" and retune.
            String grammar = "[\"" + target + "\"]";
            recognizer = new Recognizer(sharedModel, SAMPLE_RATE, grammar);
            speechService = new SpeechService(recognizer, SAMPLE_RATE);
            speechService.startListening(
                    new RecognitionListener() {
                        @Override
                        public void onPartialResult(String hypothesis) {
                            // Logged for tuning, never fired: partials are
                            // unstable and caused noise triggers.
                            if (containsTarget(hypothesis, "partial", target)) {
                                Log.d(TAG, "partial candidate (ignored): " + hypothesis);
                            }
                        }

                        @Override
                        public void onResult(String hypothesis) {
                            double conf = wordConfidence(hypothesis, target);
                            if (conf >= MIN_FINAL_CONFIDENCE) {
                                emit(listener, target, conf);
                            } else if (conf > 0) {
                                Log.d(TAG, "below-threshold final conf=" + conf + ": " + hypothesis);
                            } else {
                                Log.d(TAG, "empty final: " + hypothesis);
                            }
                        }

                        @Override
                        public void onFinalResult(String hypothesis) {
                            double conf = wordConfidence(hypothesis, target);
                            if (conf >= MIN_FINAL_CONFIDENCE) {
                                emit(listener, target, conf);
                            } else if (conf > 0) {
                                Log.d(TAG, "below-threshold final conf=" + conf + ": " + hypothesis);
                            } else {
                                Log.d(TAG, "empty final: " + hypothesis);
                            }
                        }

                        @Override
                        public void onError(Exception e) {
                            Log.e(TAG, "recognizer error", e);
                        }

                        @Override
                        public void onTimeout() {
                            Log.w(TAG, "recognizer timeout");
                        }
                    });
            Log.i(TAG, "vosk engine listening for \"" + target + "\"");
        } catch (IOException e) {
            Log.e(TAG, "recognizer start failed", e);
            running = false;
        }
    }

    private void emit(Listener listener, String phrase, double confidence) {
        mainHandler.post(() -> listener.onPhrase(phrase, confidence));
    }

    @Override
    public void stop() {
        running = false;
        try {
            if (speechService != null) {
                speechService.stop();
                speechService.shutdown();
            }
        } catch (Exception e) {
            Log.w(TAG, "speech service stop failed", e);
        } finally {
            speechService = null;
        }
        try {
            if (recognizer != null) {
                recognizer.close();
            }
        } catch (Exception e) {
            Log.w(TAG, "recognizer close failed", e);
        } finally {
            recognizer = null;
        }
        // sharedModel is kept for the process lifetime: re-unpacking ~70 MB
        // on every start would stall the alert path by seconds.
    }

    /** Lowercase words only — the grammar must match the model vocabulary. */
    private static String sanitize(String phrase) {
        String clean = phrase == null ? "" : phrase.toLowerCase().replaceAll("[^a-z ]", "").trim();
        if (clean.isEmpty()) {
            clean = "help me";
        }
        return clean.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static boolean containsTarget(String hypothesis, String key, String target) {
        try {
            String text = new JSONObject(hypothesis).optString(key, "").toLowerCase();
            return (" " + text + " ").contains(" " + target + " ");
        } catch (Exception e) {
            return false;
        }
    }

    /** Best word-level confidence for the target, or 0 when absent. */
    private static double wordConfidence(String hypothesis, String target) {
        try {
            JSONObject root = new JSONObject(hypothesis);
            JSONArray words = root.optJSONArray("result");
            if (words != null) {
                double best = 0;
                for (int i = 0; i < words.length(); i++) {
                    JSONObject w = words.getJSONObject(i);
                    if (target.equals(w.optString("word", "").toLowerCase())) {
                        best = Math.max(best, w.optDouble("conf", 0));
                    }
                }
                if (best > 0) {
                    return best;
                }
            }
            // Grammar-mode finals carry text but no word array (measured
            // 2026-10-10: {"text": "help help"} scores 0 above). A
            // word-boundary match on finalized text is strong evidence —
            // endpointed silence finalizes as "", not as the phrase.
            if (containsTarget(hypothesis, "text", target)) {
                return CONFIDENCE_FINAL_TEXT;
            }
            return 0;
        } catch (Exception e) {
            return 0;
        }
    }
}
