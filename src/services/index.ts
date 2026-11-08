// Single service selector (codeHER.md §4): native implementations when
// explicitly enabled AND running inside Capacitor; mock implementations
// otherwise (browser dev, demo, tests). UI components import services from
// here — never from "./voiceService" etc., and never a Capacitor plugin.
// Listening is the exception to "mock in the browser": the web build runs
// the real offline Vosk WASM engine (./webVoiceService.ts).
import { withCoarseEngineState } from "./voiceService";
import { webListeningService } from "./webVoiceService";
import type { VoiceEngineState } from "./types";
import { mockLocationService } from "./locationService";
import { mockSmsService, setMockNoSignal } from "./smsService";
import { mockStorageService } from "./storageService";
import { mockStatusService } from "./statusService";
import {
  nativeGetBuildInfo,
  nativeListeningService,
  nativeLocationService,
  nativeRequestBatteryExemption,
  nativeSmsService,
  nativeStatusService,
  nativeStorageService,
} from "./native";
export type { BuildInfo } from "./native";
export type { VoiceEngineState, VoiceEngineStatus, VoiceUnavailableReason } from "./types";
export { webSmsHandoff, type SmsHandoffDraft, type SmsPlatform } from "./smsService";
// Phrase rules shared by the phrase field and the keyword engine, so the UI
// shows and saves exactly what the engine listens for.
export {
  DEFAULT_PHRASE,
  PHRASE_MAX_WORDS,
  sanitizePhrase as effectivePhrase,
  validatePhrase,
  type PhraseCheck,
  type PhraseProblem,
} from "./voskGrammar";
import type { BuildInfo } from "./native";

declare global {
  interface Window {
    Capacitor?: unknown;
  }
}

const useNative =
  import.meta.env["VITE_CODEHER_NATIVE"] === "1" &&
  typeof window !== "undefined" &&
  typeof window.Capacitor !== "undefined";

const nativeVoice = withCoarseEngineState(nativeListeningService);

export const listeningService = useNative ? nativeVoice.service : webListeningService;
export const locationService = useNative ? nativeLocationService : mockLocationService;
export const smsService = useNative ? nativeSmsService : mockSmsService;
export const storageService = useNative ? nativeStorageService : mockStorageService;
export const statusService = useNative ? nativeStatusService : mockStatusService;

/** True when the native service layer is active (device WebView). */
export const isNativeActive = useNative;

/** Current voice engine readiness (drives "Preparing voice engine" / "Listening" / "Mic blocked"). */
export function getVoiceEngineState(): VoiceEngineState {
  return useNative ? nativeVoice.getEngineState() : webListeningService.getEngineState();
}

/** Subscribe to voice engine readiness changes. Returns an unsubscribe. */
export function onVoiceEngineStateChange(cb: (s: VoiceEngineState) => void): () => void {
  return useNative
    ? nativeVoice.onEngineStateChange(cb)
    : webListeningService.onEngineStateChange(cb);
}

/** Mock-only: mirror the "simulate no signal" setting. No-op on native. */
export function setSmsNoSignal(v: boolean): void {
  if (!useNative) setMockNoSignal(v);
}

/**
 * Open the system battery-exemption prompt. Native only — no-op in the
 * browser (no web API exists). Used by the Settings permissions fix action.
 */
export function requestBatteryExemption(): Promise<void> {
  if (!useNative) return Promise.resolve();
  return nativeRequestBatteryExemption();
}

/** Build identity for the Settings About row (debuggability). */
export function getBuildInfo(): Promise<BuildInfo> {
  if (!useNative) {
    return Promise.resolve({ buildTag: "browser", versionName: "dev", appId: "browser" });
  }
  return nativeGetBuildInfo();
}
