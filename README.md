# Code:HER — Offline Voice SOS for Android

## The problem

In a dangerous moment, unlocking a screen, opening an app, or finding a
signal is often impossible — and cloud-based assistants fail the moment the
internet drops, and can't be trusted to listen to private audio all day.
People need a way to call for help **without touching their phone**, that
works when the network doesn't, and that never sends their voice anywhere.

## What this is

Code:HER is an offline, voice-activated emergency app for Android that lets
people call for help without touching their phone. In a dangerous moment,
unlocking a screen, opening an app, or finding a signal is often impossible,
and cloud-based assistants fail the moment the internet drops or can't be
trusted to listen to private audio all day. Code:HER solves this by running
a small speech-recognition model directly on the device, so it listens for a
personal distress phrase without sending any audio anywhere. When it hears
the phrase, it starts a short cancelable countdown, then automatically texts
the user's trusted contacts a preformatted SMS with their current location,
working without internet and keeping the user's voice completely private.

- **Trigger:** distress phrase (default "help me") detected on-device
- **Flow:** detect → 10 s cancelable countdown → location → SMS → per-contact status
- **SMS:** preformatted, single segment when possible, coordinates as text
  (maps link optional — some carriers filter URL-bearing SMS)
- **Privacy:** audio is consumed frame-by-frame on the phone; nothing is
  recorded or uploaded. SMS needs cellular coverage, not internet.

See [`codeHER.md`](./codeHER.md) (scope + architecture rules),
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (one-slide diagram),
[`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md) (60–90 s demo),
[`docs/ACCURACY_TEST.md`](./docs/ACCURACY_TEST.md) (measurement protocol),
[`docs/PROGRESS.md`](./docs/PROGRESS.md) (running log).

## Tools used

| Layer | Stack |
|---|---|
| UI | React 19, Tailwind CSS v4, TanStack Router + Start + Query, Vite 8 |
| Bridge | Capacitor 8 (`com.codeher.app`) |
| On-device AI | Vosk (`vosk-android:0.3.75`) + small English model, restricted grammar |
| Native | Android (Java), Gradle 8.14 — **builds require JDK 21** (Gradle 8.14 fails on newer, Capacitor 8 needs source-21) |
| Toolchain | Bun 1.3+, TypeScript (strict), Vitest, ESLint + Prettier |
| IDE | Android Studio (set Gradle JDK to 21: Settings → Build Tools → Gradle) |

## Assets & models

- `public/codeher-logo.png` — header logo (wide lockup)
- `public/codeher-splash.png` — splash logo (stacked lockup)
- `public/favicon.png`
- Vosk model `vosk-model-small-en-us-0.15` (~70 MB) — **git-ignored**, fetch once per machine (PowerShell, resume-safe):

```powershell
curl.exe -L -C - -o "$env:TEMP\vosk-model-small-en-us-0.15.zip" `
  "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
Expand-Archive "$env:TEMP\vosk-model-small-en-us-0.15.zip" "$env:TEMP\vosk-model" -Force
Copy-Item "$env:TEMP\vosk-model\vosk-model-small-en-us-0.15\*" `
  "android\app\src\main\assets\model-en-us" -Recurse -Force
```

## How to run (developers)

Prerequisites: [Bun](https://bun.sh/), Android Studio + SDK, JDK 21, a
physical Android phone (emulators can't do mic/SMS reliably).

```sh
bun install
bun run dev          # web preview at http://localhost:8080/
bun run build        # web production build
bunx tsc --noEmit    # typecheck
bunx vitest run      # tests
```

Android APK (WebView loads a static SPA bundle — no dev server on device):

```sh
bun run build:android   # static bundle → dist/client (+ index.html)
bunx cap sync android   # copy web assets into the native project
# then in android/: ./gradlew assembleDebug (JDK 21), install, run
```

Native pieces live in `android/app/src/main/java/com/codeher/app/`:
`HerNativePlugin` (bridge + runtime permissions), `HerListeningService`
(foreground mic service), `VoskKeywordDetector` (keyword engine),
`HerLocationProvider` (GPS fix, 8 s cap), `HerSmsSender` (SmsManager +
retry outbox + delivery receipts), `SmsStatusReceiver`.

## First-time use (on the phone)

1. Install the APK (or Run from Android Studio) and open **Code:HER**.
2. The splash fades, then **onboarding** explains the app — grant
   **Microphone** (listening), **Location** (coordinates), and **SMS**
   (sending) when asked. SMS and background-running permissions are marked
   where the OS handles them.
3. Tap **Start protecting me**, then open the **Contacts** tab: add up to two
   trusted contacts, set **your name**, pick your **safe phrase**.
4. Try **Settings → Test mode → Simulate phrase** to rehearse the full flow
   (cancel the countdown to stop it), and the **SOS tab** for the manual
   backup button.
5. Real use: say your phrase → phone vibrates → countdown → SMS with your
   location goes out automatically. Cancel within 10 seconds to stop it.
