// Native service implementations (Phase 2): the §4 contracts against the
// `HerNative` Capacitor plugin — foreground listening service, GPS location,
// SmsManager sending, and radio/permission reads.
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type {
  ListeningService,
  ListeningStatus,
  LocationFix,
  LocationService,
  PhraseDetection,
  SmsResult,
  SmsService,
  StatusService,
  StorageService,
} from "./types";

interface HerNativePlugin {
  startListening(): Promise<void>;
  stopListening(): Promise<void>;
  getStatus(): Promise<{ status: string }>;
  setPhrase(options: { phrase: string }): Promise<void>;
  addListener(
    eventName: "phraseDetected",
    listener: (e: { phrase: string; confidence: number; at: number }) => void,
  ): Promise<PluginListenerHandle>;
  getCurrentLocation(): Promise<{
    lat?: number;
    lng?: number;
    accuracyM?: number;
    at?: number;
    source?: string;
  }>;
  sendSms(options: {
    to: string;
    body: string;
    token: string;
  }): Promise<{ ok: boolean; error?: string }>;
  queueSms(options: { to: string; body: string }): Promise<void>;
  flushSmsQueue(): Promise<void>;
  addListener(
    eventName: "smsStatus",
    listener: (e: { token: string; phase: string; error?: string }) => void,
  ): Promise<PluginListenerHandle>;
  getConnectivity(): Promise<{ internet?: boolean; cellular?: boolean }>;
  getPermissions(): Promise<{
    mic?: boolean;
    location?: boolean;
    sms?: boolean;
    batteryExempt?: boolean;
  }>;
  requestBatteryExemption(): Promise<void>;
  getBuildInfo(): Promise<{ buildTag: string; versionName: string; appId: string }>;
}

const HerNative = registerPlugin<HerNativePlugin>("HerNative");

const LISTENING_STATUSES: readonly string[] = ["stopped", "starting", "listening", "error"];

export const nativeListeningService: ListeningService = {
  start: () => HerNative.startListening(),
  stop: () => HerNative.stopListening(),
  getStatus: async (): Promise<ListeningStatus> => {
    const { status } = await HerNative.getStatus();
    return LISTENING_STATUSES.includes(status) ? (status as ListeningStatus) : "error";
  },
  setPhrase: (phrase: string) => HerNative.setPhrase({ phrase }),
  onPhraseDetected: (cb: (e: PhraseDetection) => void): (() => void) => {
    let handle: PluginListenerHandle | undefined;
    let cancelled = false;
    HerNative.addListener("phraseDetected", (e) => cb(e)).then((h) => {
      if (cancelled) {
        h.remove().catch((err: unknown) => console.error(err));
      } else {
        handle = h;
      }
    });
    return () => {
      cancelled = true;
      if (handle) {
        handle.remove().catch((err: unknown) => console.error(err));
      }
    };
  },
};

export const nativeLocationService: LocationService = {
  getCurrent: async (): Promise<LocationFix | null> => {
    const r = await HerNative.getCurrentLocation();
    // Empty object = no fix; the SMS goes out without coordinates (§5).
    if (typeof r.lat !== "number" || typeof r.lng !== "number") return null;
    return {
      lat: r.lat,
      lng: r.lng,
      accuracyM: typeof r.accuracyM === "number" ? r.accuracyM : 0,
      at: typeof r.at === "number" ? r.at : Date.now(),
      source: r.source === "gps" ? "gps" : "last_known",
    };
  },
};

const SMS_ERRORS: readonly string[] = ["no-signal", "invalid-number", "send-failed"];

function mapSmsError(error: string | undefined): NonNullable<SmsResult["error"]> {
  const e = error ?? "send-failed";
  return SMS_ERRORS.includes(e) ? (e as NonNullable<SmsResult["error"]>) : "send-failed";
}

// Delivery receipts arrive as smsStatus events correlated by token. The
// native call stays alive until the sent/delivery broadcast resolves it;
// the 30s timeout below is a backstop for a lost broadcast.
const pendingSms = new Map<string, (r: SmsResult) => void>();
let smsStatusArmed = false;

function armSmsStatus(): void {
  if (smsStatusArmed) return;
  smsStatusArmed = true;
  HerNative.addListener("smsStatus", (e) => {
    const settle = pendingSms.get(e.token);
    if (!settle) return;
    if (e.phase === "sent" || e.phase === "delivered") {
      settle({ ok: true });
    } else {
      settle({ ok: false, error: mapSmsError(e.error) });
    }
  }).catch((err: unknown) => console.error(err));
}

function newSmsToken(): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000)}`;
}

export const nativeSmsService: SmsService = {
  send: (to: string, body: string): Promise<SmsResult> => {
    armSmsStatus();
    const token = newSmsToken();
    return new Promise<SmsResult>((resolve) => {
      const settle = (r: SmsResult): void => {
        if (pendingSms.delete(token)) resolve(r);
      };
      pendingSms.set(token, settle);
      setTimeout(() => settle({ ok: false, error: "send-failed" }), 30_000);
      HerNative.sendSms({ to, body, token })
        .then((r) => {
          // Immediate verdicts (validation errors) settle here; receipt
          // verdicts arrive via smsStatus and settle through the map.
          if (!r.ok) settle({ ok: false, error: mapSmsError(r.error) });
        })
        .catch(() => settle({ ok: false, error: "send-failed" }));
    });
  },
  queueForRetry: (to: string, body: string) => HerNative.queueSms({ to, body }),
  flushQueue: () => HerNative.flushSmsQueue(),
};

export function nativeRequestBatteryExemption(): Promise<void> {
  return HerNative.requestBatteryExemption();
}

export interface BuildInfo {
  buildTag: string;
  versionName: string;
  appId: string;
}

export function nativeGetBuildInfo(): Promise<BuildInfo> {
  return HerNative.getBuildInfo();
}

export const nativeStatusService: StatusService = {
  getConnectivity: async () => {
    const r = await HerNative.getConnectivity();
    return { internet: r.internet === true, cellular: r.cellular === true };
  },
  getPermissions: async () => {
    const r = await HerNative.getPermissions();
    return {
      mic: r.mic === true,
      location: r.location === true,
      sms: r.sms === true,
      batteryExempt: r.batteryExempt === true,
    };
  },
};

// Storage needs no native implementation: localStorage works in the WebView.
export { mockStorageService as nativeStorageService } from "./storageService";
export type { StorageService };
