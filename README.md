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

## Download (judges' build v1.0-alpha)

Get the signed APK from the
[Releases page](https://github.com/elainedomaycos/Code-HER/releases)
(`CodeHER-v1.0-alpha.apk`, ~82 MB, Android 7.0+). Verify the SHA-256
checksum published alongside it, then install: Android will ask you to allow
"Install unknown apps" once. On first launch, grant Microphone, Location,
and SMS; add 1–2 trusted contacts in the Contacts tab and rehearse with
Settings → Test mode. This is an alpha demo build: detection accuracy is
still being measured (see `docs/ACCURACY_TEST.md`), and SMS needs cellular
coverage.

See [`codeHER.md`](./codeHER.md) (scope + architecture rules),
[`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) (one-slide diagram),
[`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md) (60–90 s demo),
[`docs/ACCURACY_TEST.md`](./docs/ACCURACY_TEST.md) (measurement protocol),
[`docs/PROGRESS.md`](./docs/PROGRESS.md) (running log).

## Web version (try it in a browser)

The same app also runs in a phone or laptop browser, so it can be tested
without building the Android app. Work is on branch `feat/web-ready-ui`
([PR #1](https://github.com/elainedomaycos/Code-HER/pull/1)).

### What the web version does

- **Hears your phrase offline.** The same speech engine as the Android app
  (Vosk) runs inside the browser. Your voice never leaves the device.
- **Sends the alert through Messages.** A website cannot send a text by
  itself, so after the countdown it opens your Messages app with the
  contacts and alert already filled in. You just tap Send. On a laptop it
  shows the message with a Copy button.
- **Keeps the screen on.** A browser stops hearing you when the screen
  locks, so the app keeps the screen on while it listens and while an alert
  runs. Home tells you: "Keep this page open."
- **3 simple tabs:** Home (status, setup steps, hold to send SOS, test
  alert), Contacts, Settings (name, phrase, message preview, test mode).
- **Test mode** runs the whole alert but never sends anything.

### How to try it

```sh
bun install
bun run fetch:model   # one time: downloads the 41 MB voice model
bun run dev           # laptop: open http://localhost:8080/
bun run dev:https     # phone: open the "Network: https://..." link it prints
```

On the phone (same Wi-Fi), the browser shows a security warning once
because the certificate is made on your laptop. Tap Advanced, then Proceed.

### What was done (2026-11-08)

1. Offline voice trigger in the browser, Messages handoff, and the 3 tab
   redesign.
2. `bun run dev:https` so the microphone works when testing on a phone.
3. Bug fixes from a code review:
   - a cancelled alert could still be sent later by mistake
   - after cancelling, voice stayed off while the app said it was listening
   - on iPhone, tapping to turn on voice did nothing
   - adding a contact failed on plain http
   - removed a "Simulate no signal" setting that did nothing on Android
   - the voice model download is now checked against a fixed fingerprint
4. Screen stays on while listening or sending an alert (web only).

Checked with 233 automated tests, type check, and lint. Full details are in
[`docs/PROGRESS.md`](./docs/PROGRESS.md).

### Still to do

- Test on a real phone: say the phrase, check Messages opens filled in, and
  try iPhone Safari.
- Run the accuracy test in [`docs/ACCURACY_TEST.md`](./docs/ACCURACY_TEST.md)
  to get real numbers for how often the phrase is heard.
- Update the project brief: it names Android SpeechRecognizer, but the app
  uses Vosk (works offline on every phone and in the browser).
- A public web link needs the voice model hosted separately (it is bigger
  than Cloudflare's 25 MB file limit).

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

## Web voice trigger (dev notes)

The browser build runs the same offline engine as Android: Vosk compiled to
WebAssembly ([`vosk-browser`](https://github.com/ccoreilly/vosk-browser)),
with a restricted grammar of the safe phrase plus `[unk]`. Only final
results with word confidence of 0.9 or higher fire, as on the phone.

Fetch the model once per machine (~41 MB, git-ignored, saved to
`public/models/`):

```sh
bun run fetch:model    # add --force to re-download
```

- The model is served from the app's own origin (`/models/vosk-model-small-en-us-0.15.tar.gz`)
  and cached by the engine in IndexedDB after the first load. Audio stays in
  memory on the device. Nothing is recorded or uploaded.
- The mic needs a secure context: `http://localhost:8080` works, a LAN IP
  such as `http://192.168.x.x:8080` on a phone does not. To test on a phone
  browser, run `bun run dev:https` and open the `Network: https://...` URL it
  prints from a phone on the same Wi-Fi. The cert is self-signed, so the phone
  shows a warning once: tap Advanced, then Proceed (Chrome) or Show Details,
  then visit this website (Safari). If the phone cannot connect, allow port
  8080 for private networks in Windows Firewall.
- Without a mic, with mic permission denied, or with the model missing, the
  app keeps working in simulate only mode: test mode "Simulate phrase" and
  manual SOS still trigger the alert.
- Code: `src/services/webVoiceService.ts` (engine lifecycle),
  `src/services/voskGrammar.ts` (grammar and confidence gating).

## How to run (developers)

Prerequisites: [Bun](https://bun.sh/), Android Studio + SDK, JDK 21, a
physical Android phone (emulators can't do mic/SMS reliably).

```sh
bun install
bun run dev          # web preview at http://localhost:8080/
bun run dev:https    # same over HTTPS, for phone browsers on your Wi-Fi
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
