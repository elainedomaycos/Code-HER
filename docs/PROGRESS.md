# Code:HER — Progress Log

Running log per codeHER.md §9 rule 11: what is done, what is blocked, what was
learned (especially accuracy test results once the native layer exists).

## 2026-11-08 HTTPS dev server for phone testing

- `bun run dev:https` sets `CODEHER_HTTPS=1`, which adds
  `@vitejs/plugin-basic-ssl` to the dev server only (never to builds). Serves
  `https://<LAN IP>:8080/` with a self-signed cert cached in
  `node_modules/.vite/basic-ssl`, so the mic works in a phone browser after
  one "proceed anyway". Verified: page 200 and the 41 MB model 200 over TLS on
  the LAN IP. Real phone run (voice trigger + Messages handoff) still to do.

## 2026-11-08 Branch code review fixes

Review of feat/web-ready-ui against main; 8 of 10 findings fixed.

- A real alert cancelled while locating could come back inside a later test
  and open Messages. The locating run is now tied to its `alertRun` and only
  continues while the phase is locating/sending (`alertRun.test.tsx`).
- The queued retry drops its result if she left the queued screen.
- Cancel restarts the voice engine (manual SOS from paused left it off while
  the UI said listening).
- Messages "opened" detection: hide listeners stay mounted and the platform
  is recorded before `open()`, so a hide before the handoff render counts.
- "Simulate no signal" removed. It was shown only on native, where it did
  nothing except a misleading header; the stored flag no longer blocks retry.
- Voice "tap to start" listens on pointerup/touchend/keydown. A touch
  pointerdown has no user activation, so iOS never resumed audio.
- Contact ids use `newId()` (`src/lib/id.ts`): `crypto.randomUUID` is missing
  on plain http LAN pages.
- `fetch:model` pins the archive SHA-256. `ignoreRepeat` shared from
  `src/lib/keys.ts`.
- Not done (low): `autoOpenAttempted` is derivable from `platform`.

## 2026-11-08 Review fixes (alert copy, handoff status, timers, SMS text, APK size)

- Zero contacts: only the web handoff says "You will choose who to text after
  the countdown". On native, Home and the countdown say "Add a contact first.
  No one will get this alert." Native SOS is not blocked (the flow still ends
  on the failed result screen). Copy lives in `components/codeher/format.ts`.
- Handoff "opened" now needs a page hide within 2 s of an open attempt (auto
  open or a link tap) on a phone. Desktop never counts; a desktop link click
  records nothing. Chip reads "Messages opened"; otherwise "Not sent yet" and
  the leave confirm stay.
- The 400 ms detected to countdown step carries an alert run id
  (`countdownStart`); the reducer ignores it unless the phase is still
  "detected" for that run, and cancel clears the timer. A cancelled test can
  no longer come back as a real countdown.
- One `joinNames` helper and one `COUNTDOWN_SECONDS` (exported from store).
- Alert text in plain words: "Location: 14.59950,120.98420 at 10:29 PM.",
  "Last known location: ...", and "within about 120 m" only when accuracy is
  worse than 50 m. Coarse fixes (over 100 m) still round coordinates.
  `fmtTime` maps non ASCII spaces (Chrome's U+202F before PM) to a plain
  space so the SMS stays GSM 7-bit. Maps link default stays off everywhere;
  a handoff-only default would need `storageService` defaults and stored
  settings cannot tell a default from a user choice, so it was left.
- `bun run build:android` drops `public/models` from `dist/client` (vite
  plugin, android mode only), so the 41 MB web model no longer lands in the
  APK. The web build still ships `.output/public/models/`.

## 2026-11-08 — Web-ready UI: offline voice in the browser + SMS handoff + 3 tabs

### Done

- **Offline voice trigger on web**: `src/services/webVoiceService.ts` runs
  Vosk compiled to WASM (`vosk-browser`, same Kaldi/Vosk engine as Android)
  with the restricted grammar (safe phrase + `[unk]`) and the same finals-only,
  word conf ≥ 0.9 gate (`src/services/voskGrammar.ts`). Model
  `vosk-model-small-en-us-0.15.tar.gz` (~41 MB) is fetched once per machine
  with `bun run fetch:model` (`scripts/fetch-vosk-model.ts`) into
  git-ignored `public/models/`, served same-origin and cached in IndexedDB
  (verified: one fetch, reload hits the cache, no console errors, Home shows
  "Listening for “help me”"). Degrades to simulate-only (test mode + manual
  SOS) when the mic is blocked, the model is missing or the context is
  insecure. Engine readiness exposed via `getVoiceEngineState` /
  `onVoiceEngineStateChange` in `src/services/index.ts`.
- **Web SMS handoff**: a browser cannot send SMS, so after the countdown
  `HandoffScreen` opens the Messages app through an `sms:` link prefilled
  with every recipient and the alert text (`src/lib/smsLink.ts`, per
  platform URI format); the user taps Send. Desktop shows the exact message
  with a Copy button. Exposed as `webSmsHandoff` from the services barrel;
  native still sends via SmsManager.
- **Navigation = 3 tabs** (`Shell.tsx`, `CodeHerApp.tsx`): Home (status,
  setup checklist, hold-to-send SOS, test alert), Contacts (contacts only),
  Settings (name, safe phrase, message preview with segment counter, maps
  link toggle, test mode, privacy, permissions, about). The old
  `Screens.tsx` monolith was split into one file per screen/panel.
- Onboarding rewritten as a plain "how it works" + permission step; test
  alert runs the full countdown and ends on a "nothing was sent" preview.
- UI copy pass: no leading dashes/decorative rules, no em dashes in UI
  strings under `src/components/codeher`.
- Verified: `bun run test` 150/150 (21 files), `bunx tsc --noEmit` clean,
  `bun run lint` 0 errors (11 pre-existing fast-refresh warnings),
  `bun run build` ✓.

### Blocked / Next

- Phone-browser testing needs HTTPS (mic requires a secure context; a LAN IP
  over http does not work). Use a tunnel or a local cert.
- The 41 MB model is copied into `.output/public/models/` by the build; it
  exceeds Cloudflare's 25 MiB per-asset limit, so a hosted web deploy needs
  the model on separate static storage (same origin path) or split.
- Accuracy matrix (§11) still to run for the browser engine; thresholds are
  shared with Android but WebAudio resampling may shift confidence.

## 2026-10-09 — Web foundation + Lovable decoupling + service layer

### Done

- Repo runs locally with **bun** (`bun install` ~1–30s vs `npm install` ~5m;
  `bun run dev` → http://localhost:8080/). Tests 5/5 → now 25+ (see below).
- Design tokens in place (Plus Jakarta Sans, coral/cream/charcoal theme,
  rounded cards, large touch targets). Logo `1.png` moved to
  `public/codeher-logo.png` and wired into the header (transparent bg verified).
- Project renamed `pixel-perfect-display` → `codeHER`; `package.json` name →
  `codeher`; README/AGENTS rewritten for local-only work.
- **Lovable decoupled**: deleted error-reporting shim, orphaned `asset.json`,
  `.lovable/`, stale `package-lock.json`; `vite.config.ts` rewritten on stock
  plugins (Start, React, Tailwind v4, tsconfig-paths, Nitro build). Verified:
  `tsc` clean, tests green, dev 200s, `bun run build` ✓ in ~4s.
- Dev-speed tuning: `optimizeDeps` pre-bundles only the 10 deps the app
  imports; heavy template deps (recharts, embla, day-picker, cmdk, vaul,
  input-otp) excluded — they live in unused `src/components/ui/*`.
- **Service layer per §4**: `src/services/types.ts` contracts
  (Listening/Location/Sms/Storage/Status); mock implementations +
  `native.ts` fail-loud stubs + single selector in `src/services/index.ts`
  (`VITE_CODEHER_NATIVE=1` + Capacitor runtime check). Web UI runs on mocks.
- `StatusService` added (connectivity + permissions; data wired into store
  context, no permissions screen yet — see Next).
- **SMS template per §5**: fresh / last-known / no-location variants, raw
  coords as text + maps link, ≤160 chars for the default profile.
- **Unit tests**: reducer state-machine flows, SMS template variants, mock
  listening/location/status contracts. (`bunx vitest run` green.)

### Blocked / Next

- ~~Permissions + onboarding screens (§6/§7)~~ done 2026-10-09: first-run
  `OnboardingScreen` (gated on `settings.onboarded`), shared
  `PermissionsList` with fix actions (mic/location prompt in browser, SMS and
  battery-exemption marked Android-only), `SettingsScreen` (privacy card,
  permissions, test mode with simulate-phrase + no-signal toggle moved out of
  Contacts). `refreshPermissions` in store context.
- `SplashScreen` (stacked `2.png` → `public/codeher-splash.png`, headerless
  frame): simple fade in/out, auto-dismiss ~2.3s, tap to skip,
  `prefers-reduced-motion` disables it.
- **Capacitor shell** (2026-10-09): `@capacitor/{core,cli,android}@8.5.3`,
  `appId` `com.codeher.app`, `android/` platform added and synced. `bun run
  build:android` emits a static SPA bundle to `dist/client` — two config
  discoveries: Start's prerender preview server demands the default `dist/`
  layout (custom `outDir` breaks it with a missing `dist/server/server.js`),
  and the SPA shell path must be overridden to `/index`
  (`spa.prerender.outputPath`) or no `index.html` is emitted for the WebView.
  Verified `index.html` + assets land in
  `android/app/src/main/assets/public`. No JDK/SDK on this machine — APK
  builds and device runs happen in Android Studio.
- **`HerNative` plugin skeleton** (2026-10-09, uncompiled — no JDK here):
  `HerNativePlugin` (start/stop/status/setPhrase + mic runtime-permission
  flow + `phraseDetected` event bridge), `HerListeningService` (foreground
  service, microphone type, persistent notification, START_STICKY),
  `KeywordDetector` interface with a no-op `StubKeywordDetector` (Vosk lands
  here next). Manifest declares mic/FGS/mic-FGS/notification/vibrate +
  service. JS `nativeListeningService` calls the bridge via
  `@capacitor/core`; location/SMS/status stay fail-loud stubs. Device bundle
  forces `VITE_CODEHER_NATIVE=1`; store degrades gracefully (null location →
  no-location SMS, rejected sends → failed, never stalls).
- Deviation: plugin written in Java, not Kotlin (codeHER.md says Kotlin) —
  the template has no Kotlin toolchain and it can't be verified without a
  JDK; zero Gradle changes were needed. Trivial to convert later.
- **Native location + SMS + status** (2026-10-09, uncompiled — no JDK here):
  `HerLocationProvider` (framework LocationManager, GPS single-update, 8s
  cap, last-known fallback, null when empty — zero new deps by design),
  `HerSmsSender` (SmsManager single/multipart, PH validation, retry outbox
  persisted in SharedPreferences), plugin methods getCurrentLocation /
  sendSms / queueSms / flushSmsQueue / getConnectivity / getPermissions /
  requestBatteryExemption (each with runtime-permission flow; reads use
  ContextCompat, no prompt). Manifest adds location/SMS/network-state/
  battery-optimization permissions. JS native bridges map results defensively
  (empty object → null fix, unknown SMS error → send-failed). Device bundle
  forces `VITE_CODEHER_NATIVE=1`; store try/catches every native call so a
  rejection degrades (failed status, no-location SMS) instead of stalling.
- Remaining native work: delivery receipts for per-contact sent/delivered
  status, battery-exemption UI wiring (`requestBatteryExemption` is ready).
- **English-first phrase + Vosk engine** (2026-10-09, uncompiled — no JDK
  here): default distress phrase is now **"help"** (presets help / help me /
  SOS; spec + mocks + tests + native defaults updated, Tagalog dropped).
  `VoskKeywordDetector` implements the `KeywordDetector` seam (small English
  model `vosk-model-small-en-us-0.15`, downloaded + zip-validated, extracted
  to `android/.../assets/model-en-us`, git-ignored with fetch commands in
  README), restricted grammar phrase + `[unk]` filler, partial 0.85 /
  word-level final confidence, main-thread event delivery. Gradle:
  `com.alphacephei:vosk-android:0.3.75` (latest verified on Maven Central
  same day). Service now drives Vosk (stub kept as fallback). Accuracy
  protocol in `docs/ACCURACY_TEST.md` — run on the phone before claiming
  anything.
- Phase 2 native (needs a physical Android phone — emulators unreliable for
  mic/SMS): HerNative plugin done (Java, see deviation) → Vosk wired, needs
  on-device accuracy run → location/SMS done, need device test.
- **Device debugging notes**: builds require JDK 21 (Gradle 8.14 fails on
  Studio's JBR 25; JDK 17 can't compile Capacitor 8.5.3's source-21 code).
  Installed JDKs live outside the repo; Studio → Settings → Build Tools →
  Gradle → Gradle JDK must also point at 21 or Studio builds fail the same
  way. A non-fatal React hydration #418 shows in logcat on launch (backlog).
  Caution: the app persists the safe phrase in localStorage — new defaults
  only take effect after Clear Storage or an in-app phrase change.
- **False-alarm pair resolved without code changes** (2026-10-10): voice —
  device grammar was "help me" (user set it in UI) while tests said "help";
  log-verified the engine hears correctly. SMS `RESULT_ERROR_GENERIC_FAILURE`
  with healthy radio traced to dual-SIM routing: system default SMS
  subscription (`multi_sim_sms_slot=0`) vs the loaded SIM possibly in the
  other slot — the app correctly follows the system default, so the fix is
  Settings → SIM manager → preferred SIM for SMS, not code.
- **Your-name field + content-filter test** (2026-10-10): `userName` had no
  UI editor (stuck at the "Kassandra" default), so every test SMS was
  byte-identical — exactly what carrier spam filters eat. Added the field to
  Contacts (persisted, 30 chars, tested). If a renamed SOS still fails while
  stock SMS works, the fallback is subscription-fallback retry in
  `HerSmsSender`.
- **Subscription fallback retry** (2026-10-10): renamed SOS still failed, so
  routing is the bug. Sends now go via the framework default manager first
  (stock-app parity) and, on generic radio failure only, retry once via the
  explicitly resolved subscription — same token, logged path
  ("sending via …" / "retrying via …"), no-signal/invalid-number stay
  terminal. Build-tagged APK installed; awaiting live SOS receipt capture.
- **Root cause: carrier URL filtering, not code** (2026-10-10): receipts
  proved both routing paths fail identically while stock SMS works, and the
  same SOS text pasted into stock Messages also fails. PH carriers drop
  URL-bearing SMS as spam. Fix: `includeMapLink` setting (default off) with
  a Contacts toggle; coordinates-only text delivers. Also replaced "±" with
  "~" (GSM-7bit, single segment) with a pinning test. Spec §5 updated.
  **Confirmed working on-device 2026-10-10: SOS → "Alert sent", SMS
  delivered.** SMS track closed pending the accuracy-matrix period.
- **Judges' release v1.0-alpha** (2026-10-10): test data removed from
  defaults (empty contacts), versionCode 2 / versionName 1.0-alpha, upload
  keystore generated outside the repo (30-yr RSA, creds in gitignored
  `android/local.properties`), conditional release signing in Gradle,
  signed + verified APK (~82 MB) published as a GitHub Release with SHA-256
  and judge install notes. README links the Releases page.
- **GSM-7bit template + destination isolation** (2026-10-10): receipts
  proved both routing paths fail with `RESULT_ERROR_GENERIC_FAILURE` while
  stock SMS works — and revealed our "±" forced every message into UCS-2
  (3 segments). Template now uses "~" with a unit test pinning GSM-only
  output. Remaining suspect is the destination itself (DITO 0993 vs Smart
  on-net promo scope): stock SMS to Elaine is the control experiment.
- **False-trigger fix + demo contact** (2026-10-09): device fired SOS on
  ambient noise — partial hypotheses decoded "help" frame-by-frame and the
  store gated on nothing. Now finals-only with word conf ≥ 0.9
  (`MIN_FINAL_CONFIDENCE`, partials logged-not-fired, no-data-no-fire) plus
  JS `TRIGGER_CONFIDENCE` 0.9 defense in depth. Demo contact is now Elaine
  Domaycos +639933950898 alone (fresh installs only — clear app storage on
  the test phone or edit in-app).
- **Delivery receipts + battery UI + demo assets** (2026-10-09, Java
  uncompiled): `SmsStatusReceiver` (sent/delivered intents, multipart
  counting, no-service/radio-off → no-signal mapping), keep-alive
  `sendSms(token)` resolved by `smsStatus` events correlated in `native.ts`
  (30s backstop, validation verdicts settle immediately), battery-exemption
  fix action in Settings (native only, mock no-op). Docs:
  `docs/ARCHITECTURE.md` (one-slide on-device diagram) + `docs/DEMO_SCRIPT.md`
  (§12 beats with fallbacks + video shot list).
- Accuracy test (§11, not started): ≥20 trials/condition (quiet, TV/music,
  outdoors/traffic, whispered) + 20 non-trigger trials; tune threshold.

### Deviations from codeHER.md (intentional, recorded)

- SMS tail is "Sent by Code:HER." not "Sent automatically by Code:HER." — the
  spec sentence pushes the default profile to 162 chars, breaking the ≤160
  single-segment rule. Revisit if segment budget changes.
- Cancel is disabled once sending starts (was already so); countdown-cancel
  still stops everything per the state machine.
- Manual SOS / long-press logo trigger the alert flow directly, even when
  paused — the button is the §7 backup path and must not depend on the mic.
- Mock `cellular: true` is an assumption (web can't observe the radio);
  `send()` is the real signal check. Native must implement properly.
- Extra `paused`/`locating` phases vs the §3 diagram (pause toggle needs a
  resting state; locating separates GPS wait from SMS send).

### Learned

- `vite dev` "ready" ≠ loaded: first paint blocked on esbuild pre-bundle of
  the whole dep tree; `optimizeDeps.include` moves that cost to startup.
- Any lockfile change invalidates the pre-bundle cache ("Re-optimizing…",
  one-time ~10–25s). Keep one lockfile (`bun.lock`); don't flip managers.
- `lucide-react` barrel is the biggest single pre-bundle cost; per-icon
  imports are the next lever if startup regresses.
- Windows Defender + NTFS make `node_modules` I/O the dominant install cost;
  bun is an order of magnitude faster than npm here.
