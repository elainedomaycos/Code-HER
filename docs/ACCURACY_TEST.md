# Accuracy test protocol (codeHER.md §11)

The distress-phrase detector is the core AI claim of this project. Its
accuracy is **measured, never asserted**. Run this protocol on a physical
Android phone after every engine change (model, grammar, threshold) and log
results in `docs/PROGRESS.md`.

## Setup

- Build: `bun run build:android && bunx cap sync android`, install on phone.
- App open, listening active (persistent notification visible), screen off
  between trials is fine — the foreground service holds the mic.
- Watch `adb logcat -s HerListening:V Capacitor:V` — a detection logs the
  phrase + confidence and the phone vibrates + countdown starts.
- Detection counts only if the countdown starts **within ~2 seconds** of the
  spoken phrase (§11 definition of done).

## Trial matrix (target phrase: the configured safe phrase, default "help me")

| # | Condition | Trials | How |
|---|-----------|--------|-----|
| 1 | Quiet room | 20 | Normal speaking voice, 1–3 m from phone |
| 2 | Background TV/music | 20 | TV at conversation volume, same distance |
| 3 | Outdoors / traffic | 20 | Street noise, same distance |
| 4 | Whispered | 20 | Quiet room, whispered phrase |
| 5 | Non-trigger speech (false positives) | 20 | Talk *around* the phrase for 30 s each ("help me with…", "the help desk…", unrelated chat) — count unwanted triggers |

Say the phrase once per trial, cancel the countdown, wait ~5 s, next trial.

## Reporting

```
Engine: Vosk 0.3.75 + vosk-model-small-en-us-0.15, grammar ["help me"]
Partial conf 0.85 / final word-conf, threshold: JS fires on any event
Quiet 19/20 · TV 16/20 · Outdoors 14/20 · Whisper 9/20 · False positives 2/20
Median trigger latency: ~1.2 s (logcat at-timestamps vs spoken time)
```

## Change log

- 2026-10-10: default phrase "help" → "help me". Single-word "help"
  decoded from idle noise in endless partials with empty finals, so no
  threshold could discriminate. Two-word phrase carries far more evidence.

## Tuning levers (change one at a time, re-run the matrix)

1. `CONFIDENCE_PARTIAL` / final fallback in `VoskKeywordDetector.java`
2. Grammar: phrase-only `["help"]` (stricter) vs plus `[unk]` filler (default)
3. JS threshold: currently any detector event triggers; gate on
   `confidence >= X` in the store's detection handler if false positives bite
4. If Vosk plateaus below demo-acceptable rates, evaluate openWakeWord /
   Porcupine per codeHER.md §3 — same `KeywordDetector` seam, no UI changes

## Change log

- 2026-10-09: partial-result firing removed after noise-triggered SOS on
  device. Baseline is now finals-only, word confidence ≥ 0.9
  (`MIN_FINAL_CONFIDENCE`), JS gate `TRIGGER_CONFIDENCE` 0.9. Re-run the
  full matrix before claiming anything.
- 2026-10-10: grammar narrowed to phrase-only (`["help"]`, no `[unk]`
  filler) after idle partials looped "help" for minutes and starved
  endpointing — no finals ever arrived. If spoken "help" stops registering,
  restore `[unk]` and retune instead. Added `empty final` debug logging.
