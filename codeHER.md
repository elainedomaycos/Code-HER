# Code:HER — Project Brief for OpenCode

> Read this file fully before making any change. It is the source of truth for scope, architecture, and workflow. If a request conflicts with this file, say so and ask before proceeding.

## 1. What we are building

**Code:HER** is an offline, voice-activated emergency trigger for Android. When the user says a configured distress phrase, the app detects it **on the device**, shows a short cancelable countdown, then sends a preformatted SMS with the user's current location to trusted contacts. No internet is required.

**Hackathon context:** Local AI hackathon. The core AI task (distress phrase detection) must run on-device. Judging: Problem & Usefulness 25%, Local AI Implementation 25%, Technical Quality 20%, Innovation 15%, Product & Demo 15%. A flashy demo alone is not enough; the local AI must be real and demonstrable.

**One-line pitch:** AI turns the human voice into an instant, hands-free emergency trigger, and it runs locally because the moments you need it most are the ones where the network and your hands are unavailable.

## 2. MVP scope (do not expand)

One trigger. One emergency workflow. One working demonstration.

1. One locally detected distress phrase (default: "help me" — two words decode far more reliably than one against noise; "help" as a configurable alternative, but only one active at a time for the MVP)
2. One or two preconfigured trusted contacts
3. Current available location (best available fix; see fallbacks)
4. Preformatted emergency SMS
5. Clear privacy and connectivity status on screen

### Explicitly out of scope for the MVP
Do not build these unless the user asks in a later phase:
- Speaker verification, scream/sound classification, accelerometer/gyroscope triggers
- Safe-route mapping, crime heatmaps, any map or routing SDK
- Responder dispatch, ambulance tracking, any backend, accounts, or cloud sync
- iOS support
- Multiple simultaneous phrases, phrase training/fine-tuning UI
- Analytics, telemetry, or any network call carrying user data

If tempted to add a feature, add it to the "Later" list in section 10 instead.

## 3. Architecture

Three layers. Keep them separate.

```
┌──────────────────────────────────────────────┐
│  UI layer (React + Tailwind, from Lovable)   │
│  screens, state machine view, local storage  │
└───────────────▲──────────────────────────────┘
                │ typed service interface
┌───────────────┴──────────────────────────────┐
│  services/ (TypeScript)                      │
│  listening, location, sms, storage, status   │
│  mock implementations + native implementations│
└───────────────▲──────────────────────────────┘
                │ Capacitor plugin bridge
┌───────────────┴──────────────────────────────┐
│  Native Android plugin (Kotlin)              │
│  foreground service + mic, on-device keyword │
│  engine, GPS, SMS                            │
└──────────────────────────────────────────────┘
```

- **UI:** React + Tailwind, mobile-first, generated in Lovable and refined here.
- **Bridge:** Capacitor. The web UI runs inside an Android WebView.
- **Native:** Kotlin Capacitor plugin named `HerNative` (or similar) handling everything the web layer cannot do: continuous microphone capture in a foreground service, keyword detection, location, and SMS.
- **On-device keyword engine:** **Vosk** (small English model) using a **restricted grammar** limited to the configured phrase(s) plus filler. Alternatives to evaluate only if Vosk fails accuracy tests: openWakeWord, Porcupine. Report measured accuracy honestly; tune the confidence threshold accordingly.
- **Platform target:** Android only, tested on a physical device. Emulators are unreliable for mic and SMS.

### Core state machine

```
idle → listening → detected → countdown → sending → sent
                      │           │           │
                      └─ false ───┴─ cancel ──┴─ failed → retry queue
```

States:
- `idle`: app open, not listening
- `listening`: foreground service running, mic open, local engine active
- `detected`: phrase matched above confidence threshold
- `countdown`: ~10 second cancelable countdown with vibration and a large Cancel button
- `sending`: obtaining location, composing and sending SMS
- `sent`: per-contact delivery status shown
- `failed`: SMS could not be sent (no signal, permission missing); message queued for retry

Implement this as a single typed state machine (e.g., a reducer or small state library). The UI renders from state; it does not own detection logic.

## 4. Service interfaces (stub first, wire native later)

All app logic goes through `src/services/`. Each service has a TypeScript interface, a **mock** implementation (for browser/dev), and a **native** implementation (Capacitor plugin). Select via a single config flag or runtime check. Never call Capacitor plugins directly from components.

```ts
// src/services/types.ts
export type ListeningStatus = 'stopped' | 'starting' | 'listening' | 'error';

export interface ListeningService {
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<ListeningStatus>;
  setPhrase(phrase: string): Promise<void>;
  onPhraseDetected(cb: (e: { phrase: string; confidence: number; at: number }) => void): () => void;
}

export interface LocationService {
  getCurrent(): Promise<{ lat: number; lng: number; accuracyM: number; at: number; source: 'gps' | 'last_known' } | null>;
}

export interface SmsService {
  send(to: string, body: string): Promise<{ ok: boolean; error?: string }>;
  queueForRetry(to: string, body: string): Promise<void>;
  flushQueue(): Promise<void>;
}

export interface StorageService {
  getContacts(): Promise<Contact[]>;        // max 2 for MVP
  saveContacts(c: Contact[]): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
}

export interface StatusService {
  getConnectivity(): Promise<{ internet: boolean; cellular: boolean }>;
  getPermissions(): Promise<{ mic: boolean; location: boolean; sms: boolean; batteryExempt: boolean }>;
}
```

The mock `ListeningService` must expose a debug button or key shortcut ("Simulate phrase") so the UI flow can be developed and demoed without the native layer.

## 5. Emergency SMS

Preformatted, plain text, under 160 characters when possible (single SMS segment):

```
EMERGENCY: [Name] may need help. Location: https://maps.google.com/?q=LAT,LNG (±Xm, HH:MM). Sent automatically by Code:HER.
```

Rules:
- Include raw coordinates as text as well as the link, because the link needs data to open:
  `LAT,LNG` should always appear in the message.
- The link is optional per a user setting (default off): carriers that filter
  URL-bearing SMS as spam drop the whole message, and coordinates-only text
  delivers everywhere. Measured 2026-10-10 on SMART PH.
- If no fix is available, send with last known location and label it `last known`; if none, send without location and say so.
- Never block sending on a slow GPS fix. Timeout (about 8 seconds), then send with the best available data.
- Message text is a single template function with unit tests.

## 6. Privacy and connectivity status (must be visible in the UI)

A persistent status area on the home screen showing:
- **Listening:** on/off, with the logo ripple animated only while actually listening
- **Privacy:** "Audio is processed on this device. Nothing is recorded or uploaded."
- **Connectivity:** Internet (on/off) and Cellular (on/off), updated live
- **Permissions:** mic, location, SMS, battery optimization, with clear fix actions

Honesty rules (important for judging):
- SMS works over the cellular network without internet. Do **not** claim the app works with "no signal at all." Say "works without internet."
- Do not store or log raw audio. Do not send audio anywhere.
- Never write copy that overstates accuracy or guarantees safety.

## 7. Screens (MVP)

Build only these, in this order:
1. **Onboarding and permissions:** mic, location, SMS, battery-optimization exemption
2. **Home:** pulsing "Listening" indicator, status area, manual SOS button as a backup, link to settings
3. **Phrase and contacts setup:** choose the phrase, add one or two contacts
4. **Countdown:** full-screen ring (~10 seconds), vibration, huge Cancel button
5. **Sent / failed:** per-contact status, coordinates sent, retry state
6. **Settings:** privacy explanation, permissions, test mode

Do not build a responders/ambulance/map screen.

## 8. Design system

Brand: **Code:HER**, logo is a location pin fused with a sound ripple.

- Colors: coral `#F25555` (primary), soft coral `#FF8F8A`, peach `#F6D8C8`, cream `#FAF0E8` (background), charcoal `#2B2D3A` (text)
- Font: **Plus Jakarta Sans** (bold for headings and wordmark, regular for body)
- Style: rounded cards, soft shadows, large touch targets (min 48px, the Cancel and SOS buttons much larger), high contrast
- Define colors and fonts once as Tailwind theme tokens. Do not hardcode hex values in components.
- Emergency screens must be usable one-handed, in panic, with minimal text.
- Respect reduced-motion settings for the ripple animation.

## 9. Workflow rules for OpenCode

1. **Read before editing.** Inspect the existing structure and follow its conventions.
2. **Small, reviewable changes.** One concern per change. Explain what changed and why in a few lines.
3. **Stay in scope.** Check every task against section 2. Park out-of-scope ideas in section 10.
4. **Services boundary.** UI components never import native plugins directly.
5. **Mocks first.** Every feature works in the browser with mocks before native wiring.
6. **No new heavy dependencies** without asking. Prefer what is already installed.
7. **No network calls with user data.** The app must make no cloud AI calls for the core flow.
8. **Type safety.** Strict TypeScript. No `any` unless commented why.
9. **Test what matters.** Unit tests for the state machine and the SMS template. Manual checklist for native behavior (section 11).
10. **Do not delete or restructure Lovable-generated screens wholesale.** Refactor incrementally.
11. **Keep a running log** in `docs/PROGRESS.md`: what is done, what is blocked, what was learned (especially accuracy test results).
12. **When uncertain about Android behavior** (foreground service types, SMS permissions, background limits), say what you are unsure about and propose a quick test on a real device rather than guessing.

## 10. Plan

### Phase 0: Setup
- [ ] Confirm repo runs locally (`npm install`, dev server)
- [ ] Apply design tokens (colors, font) as Tailwind theme
- [ ] Create `src/services/` with interfaces from section 4 and mock implementations
- [ ] Create the state machine with unit tests

### Phase 1: UI on mocks
- [ ] Onboarding and permissions screen
- [ ] Home with status area and ripple
- [ ] Phrase and contacts setup with local persistence
- [ ] Countdown screen with cancel
- [ ] Sent / failed screen
- [ ] "Simulate phrase" debug control
- [ ] End-to-end flow works in browser with mocks

### Phase 2: Native Android (highest risk, start early in parallel)
- [ ] Add Capacitor, generate Android project, run on a physical phone
- [ ] Kotlin plugin: foreground service with persistent notification and mic access
- [ ] Integrate Vosk with restricted grammar; emit `phraseDetected` events to JS
- [ ] Accuracy test (see section 11) and record results in `docs/PROGRESS.md`
- [ ] Native location service (fused or GPS with timeout and last-known fallback)
- [ ] Native SMS send with delivery result and retry queue
- [ ] Runtime permission flow, including battery optimization exemption

### Phase 3: Integration
- [ ] Replace mocks with native services via the service layer
- [ ] Full flow: detect → countdown → location → SMS → status
- [ ] Connectivity and permission status live in the UI
- [ ] Handle failure cases: no permission, no location, no signal

### Phase 4: Demo polish
- [ ] Run full flow with Wi-Fi and mobile data off (cellular SMS still works)
- [ ] Record a backup demo video
- [ ] One-slide architecture diagram: what runs on-device
- [ ] Demo script (see section 12)

### Later (not in MVP)
Additional phrases, scream/distress sound classification, speaker verification, accelerometer second trigger, Bluetooth or mesh fallback, iOS.

## 11. Definition of done and test checklist

The MVP is done when all of these pass on a physical Android phone:

- [ ] App keeps listening with the screen off for at least 10 minutes via the foreground service
- [ ] Saying the phrase triggers `detected` and then the countdown within ~2 seconds
- [ ] Cancel during countdown stops everything and returns to `listening`
- [ ] With no cancel, an SMS is sent to each configured contact with the correct template and coordinates
- [ ] Works with Wi-Fi and mobile data turned off
- [ ] Missing permissions are explained clearly and fixable from the app
- [ ] No audio is stored or transmitted (verify no network requests during listening)
- [ ] UI shows listening state, privacy statement, and connectivity status correctly

**Accuracy test (record results):** at least 20 trials per condition for the target phrase: quiet room, background TV/music, outdoors/traffic noise, whispered. Also 20 trials of non-trigger speech to estimate false positives. Report the detection rate and false positives honestly; tune the confidence threshold accordingly.

## 12. Demo script (about 60 to 90 seconds)

1. Show phone with Wi-Fi and mobile data off; point out the connectivity status
2. Lock the screen or put the phone away
3. Say the phrase aloud
4. Phone vibrates, countdown starts; briefly show Cancel, then let it run once
5. Second phone receives the SMS with coordinates and link
6. Close: audio never left the device, and this works when the cloud disappears

## 13. Honest limitations to state in the pitch

- Android only for the MVP; iOS restricts background microphone access
- SMS requires cellular coverage, though not internet
- One phrase, tested accuracy reported as measured, not claimed
- Continuous listening has a battery cost; mitigated with a small always-on model
