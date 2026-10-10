# Code:HER — Architecture (one-slide reference)

Everything that matters runs **on the phone**. There is no backend, no
account, no cloud AI call in the alert path.

```
┌──────────────────────────── Android phone ────────────────────────────┐
│                                                                       │
│  WebView (Capacitor)              │  Native — HerNative plugin (Java) │
│  ─────────────────────            │  ─────────────────────────────────│
│  React screens                    │  HerListeningService              │
│    splash → onboarding → home     │    foreground service, mic type   │
│    → countdown → sent             │    persistent notification        │
│         │                         │         │                         │
│  src/services/ (typed boundary)   │  VoskKeywordDetector              │
│    Listening · Location · Sms     │    small-en model, grammar:       │
│    Storage · Status               │    ["help", "[unk]"]              │
│         │                         │         │                         │
│  @capacitor/core bridge ───────────┼── HerNativePlugin ────────────────┤
│  (phraseDetected / smsStatus)     │    │                              │
│                                   │    ├─ HerLocationProvider (GPS)    │
│  localStorage (contacts/settings) │    └─ HerSmsSender (SmsManager)   │
│                                   │                                   │
│  Mocks implement the same         │  StubKeywordDetector (fallback)   │
│  interfaces for browser/dev       │                                   │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                          SMS over cellular ──→ trusted contacts
                          (no internet required)
```

## Data flow: phrase → SMS

1. `HerListeningService` holds the mic; Vosk matches "help" above threshold
2. `phraseDetected { phrase, confidence, at }` → JS `ListeningService`
3. Store: `listening → detected → countdown` (10 s, cancelable, vibrates)
4. No cancel → `LocationService.getCurrent()` (≤8 s, else last-known, else null)
5. `buildMessage()` → `SmsService.send()` per contact → sent/queued/failed
6. `smsStatus` receipts confirm radio handoff per message token

## Honesty notes (for the pitch)

- SMS needs **cellular coverage**, not internet. Never claim "no signal".
- Audio is consumed frame-by-frame by Vosk; nothing is recorded or uploaded.
- Accuracy is measured per `docs/ACCURACY_TEST.md`, not asserted.
- Android only for the MVP; continuous listening costs battery.
