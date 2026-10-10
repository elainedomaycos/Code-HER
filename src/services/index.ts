// Single service selector (codeHER.md §4): native implementations when
// explicitly enabled AND running inside Capacitor; mock implementations
// otherwise (browser dev, demo, tests). UI components import services from
// here — never from "./voiceService" etc., and never a Capacitor plugin.
import { mockListeningService, emitMockDetection } from "./voiceService";
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

export const listeningService = useNative ? nativeListeningService : mockListeningService;
export const locationService = useNative ? nativeLocationService : mockLocationService;
export const smsService = useNative ? nativeSmsService : mockSmsService;
export const storageService = useNative ? nativeStorageService : mockStorageService;
export const statusService = useNative ? nativeStatusService : mockStatusService;

/** True when the native service layer is active (device WebView). */
export const isNativeActive = useNative;

/** Mock-only debug hook (§4 "Simulate phrase"). No-op on native or when paused. */
export function simulatePhraseDetection(): void {
  if (!useNative) emitMockDetection();
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
