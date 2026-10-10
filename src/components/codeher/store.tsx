import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import {
  listeningService,
  locationService,
  setSmsNoSignal,
  smsService,
  statusService,
  storageService,
} from "@/services";
import { defaultContacts, defaultSettings } from "@/services/storageService";
import type { Contact, ContactResult, LocationFix, Settings } from "@/services/types";
import { buildMessage } from "@/services/messageBuilder";

export type Phase =
  | "paused"
  | "listening"
  | "detected"
  | "countdown"
  | "locating"
  | "sending"
  | "sent"
  | "queued"
  | "failed";
export type Tab = "home" | "sos" | "contacts" | "settings";

/**
 * Defense in depth: ignore detector events below this confidence even if a
 * future engine emits them. Mirrors MIN_FINAL_CONFIDENCE in
 * VoskKeywordDetector (keep the two in sync).
 */
export const TRIGGER_CONFIDENCE = 0.9;

export interface PermissionsState {
  mic: boolean;
  location: boolean;
  sms: boolean;
  batteryExempt: boolean;
}

export interface EmergencyState {
  phase: Phase;
  tab: Tab;
  countdown: number;
  contacts: Contact[];
  settings: Settings;
  location: LocationFix | null;
  results: ContactResult[];
  sentAt: number | null;
  online: boolean;
  permissions: PermissionsState | null;
}

export type EmergencyAction =
  | { type: "hydrate"; contacts: Contact[]; settings: Settings }
  | { type: "phase"; phase: Phase }
  | { type: "tick" }
  | { type: "tab"; tab: Tab }
  | { type: "contacts"; contacts: Contact[] }
  | { type: "settings"; settings: Settings }
  | { type: "location"; location: LocationFix | null }
  | { type: "results"; results: ContactResult[]; phase: Phase }
  | { type: "online"; online: boolean }
  | { type: "permissions"; permissions: PermissionsState };

export const initialEmergencyState: EmergencyState = {
  phase: "listening",
  tab: "home",
  countdown: 10,
  contacts: defaultContacts,
  settings: defaultSettings,
  location: null,
  results: [],
  sentAt: null,
  online: true,
  permissions: null,
};

export function emergencyReducer(s: EmergencyState, a: EmergencyAction): EmergencyState {
  switch (a.type) {
    case "hydrate":
      return { ...s, contacts: a.contacts, settings: a.settings };
    case "phase":
      return { ...s, phase: a.phase, countdown: a.phase === "countdown" ? 10 : s.countdown };
    case "tick":
      return { ...s, countdown: Math.max(0, s.countdown - 1) };
    case "tab":
      return { ...s, tab: a.tab };
    case "contacts":
      return { ...s, contacts: a.contacts };
    case "settings":
      return { ...s, settings: a.settings };
    case "location":
      return { ...s, location: a.location };
    case "results":
      return { ...s, results: a.results, phase: a.phase, sentAt: Date.now() };
    case "online":
      return { ...s, online: a.online };
    case "permissions":
      return { ...s, permissions: a.permissions };
  }
}

interface Ctx extends EmergencyState {
  trigger: () => void;
  cancel: () => void;
  togglePause: () => void;
  backHome: () => void;
  setTab: (t: Tab) => void;
  setContacts: (c: Contact[]) => void;
  setSettings: (s: Settings) => void;
  refreshPermissions: () => void;
}
const C = createContext<Ctx | null>(null);

/** Send via the SmsService, mapping per-contact results for the sent screen. */
async function sendToContacts(contacts: Contact[], body: string): Promise<ContactResult[]> {
  const out: ContactResult[] = [];
  for (const contact of contacts) {
    let r;
    try {
      r = await smsService.send(contact.phone, body);
    } catch (e: unknown) {
      // Native method missing or bridge error: surface as failed, never stall.
      console.error(e);
      out.push({ contact, status: "failed" });
      continue;
    }
    if (r.ok) {
      out.push({ contact, status: "sent" });
    } else if (r.error === "no-signal") {
      try {
        await smsService.queueForRetry(contact.phone, body);
      } catch (e: unknown) {
        console.error(e);
      }
      out.push({ contact, status: "queued" });
    } else {
      out.push({ contact, status: "failed" });
    }
  }
  return out;
}

function beginAlert(d: React.Dispatch<EmergencyAction>): void {
  navigator.vibrate?.([300, 100, 300]);
  d({ type: "phase", phase: "detected" });
  setTimeout(() => d({ type: "phase", phase: "countdown" }), 400);
}

export function CodeHerProvider({ children }: { children: ReactNode }) {
  const [s, d] = useReducer(emergencyReducer, initialEmergencyState);
  const ref = useRef(s);
  ref.current = s;
  const runRef = useRef(0);

  useEffect(() => {
    Promise.all([storageService.getContacts(), storageService.getSettings()]).then(
      ([contacts, settings]) => d({ type: "hydrate", contacts, settings }),
    );
    locationService
      .getCurrent()
      .then((location) => {
        if (location) d({ type: "location", location });
      })
      .catch((e: unknown) => console.error(e));
    statusService
      .getConnectivity()
      .then((c) => d({ type: "online", online: c.internet }))
      .catch((e: unknown) => console.error(e));
    statusService
      .getPermissions()
      .then((permissions) => d({ type: "permissions", permissions }))
      .catch((e: unknown) => console.error(e));
    listeningService.start().catch((e: unknown) => console.error(e));
    const off = listeningService.onPhraseDetected((e) => {
      if (ref.current.phase !== "listening") return;
      if (e.confidence < TRIGGER_CONFIDENCE) return;
      beginAlert(d);
    });
    const on = () => {
      statusService
        .getConnectivity()
        .then((c) => d({ type: "online", online: c.internet }))
        .catch((e: unknown) => console.error(e));
    };
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      off();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      listeningService.stop().catch((e: unknown) => console.error(e));
    };
  }, []);

  // Keep the keyword engine on the configured phrase (matters for native).
  useEffect(() => {
    listeningService.setPhrase(s.settings.safePhrase).catch((e: unknown) => console.error(e));
  }, [s.settings.safePhrase]);

  // Keep the displayed fix fresh: a one-shot fetch goes stale (movement,
  // first-fix timeout), so re-poll while the app is open and visible.
  useEffect(() => {
    const refresh = () => {
      locationService
        .getCurrent()
        .then((location) => {
          if (location) d({ type: "location", location });
        })
        .catch((e: unknown) => console.error(e));
    };
    const t = setInterval(() => {
      if (!document.hidden) refresh();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Countdown → locating → sending → result
  useEffect(() => {
    if (s.phase !== "countdown") return;
    if (s.countdown === 0) {
      d({ type: "phase", phase: "locating" });
      return;
    }
    const t = setTimeout(() => d({ type: "tick" }), 1000);
    return () => clearTimeout(t);
  }, [s.phase, s.countdown]);

  useEffect(() => {
    if (s.phase !== "locating") return;
    const run = ++runRef.current;
    const live = () => runRef.current === run && ref.current.phase !== "listening";
    (async () => {
      const st = ref.current;
      setSmsNoSignal(st.settings.simulateNoSignal);
      // Native location/SMS land after listening: a rejection must degrade
      // (no-location SMS, failed status), never stall the flow.
      const fix = await locationService.getCurrent().catch((e: unknown) => {
        console.error(e);
        return null;
      });
      if (!live()) return;
      if (fix) d({ type: "location", location: fix });
      d({ type: "phase", phase: "sending" });
      const results = await sendToContacts(
        st.contacts,
        buildMessage(st.settings.userName, fix, { includeMapLink: st.settings.includeMapLink }),
      );
      if (!live()) return;
      const phase: Phase = results.some((r) => r.status === "sent")
        ? "sent"
        : results.some((r) => r.status === "queued")
          ? "queued"
          : "failed";
      d({ type: "results", results, phase });
    })();
  }, [s.phase]);

  // Retry queued messages when signal returns
  useEffect(() => {
    if (s.phase !== "queued" || s.settings.simulateNoSignal) return;
    const t = setTimeout(async () => {
      try {
        await smsService.flushQueue();
      } catch (e: unknown) {
        console.error(e);
      }
      setSmsNoSignal(false);
      const st = ref.current;
      const results = await sendToContacts(
        st.contacts,
        buildMessage(st.settings.userName, st.location, {
          includeMapLink: st.settings.includeMapLink,
        }),
      );
      const phase: Phase = results.some((r) => r.status === "sent") ? "sent" : "failed";
      d({ type: "results", results, phase });
    }, 1500);
    return () => clearTimeout(t);
  }, [s.phase, s.settings.simulateNoSignal]);

  const ctx: Ctx = {
    ...s,
    // Manual SOS backup (codeHER.md §7): always available, independent of the mic.
    trigger: () => beginAlert(d),
    cancel: () => d({ type: "phase", phase: "listening" }),
    togglePause: () => {
      if (s.phase === "paused") {
        listeningService.start().catch((e: unknown) => console.error(e));
        d({ type: "phase", phase: "listening" });
      } else {
        listeningService.stop().catch((e: unknown) => console.error(e));
        d({ type: "phase", phase: "paused" });
      }
    },
    backHome: () => {
      listeningService.start().catch((e: unknown) => console.error(e));
      d({ type: "phase", phase: "listening" });
      d({ type: "tab", tab: "home" });
    },
    setTab: (tab) => d({ type: "tab", tab }),
    setContacts: (contacts) => {
      storageService.saveContacts(contacts);
      d({ type: "contacts", contacts });
    },
    setSettings: (settings) => {
      storageService.saveSettings(settings);
      d({ type: "settings", settings });
    },
    refreshPermissions: () => {
      statusService
        .getPermissions()
        .then((permissions) => d({ type: "permissions", permissions }))
        .catch((e: unknown) => console.error(e));
    },
  };
  return <C.Provider value={ctx}>{children}</C.Provider>;
}

export function useCodeHer() {
  const c = useContext(C);
  if (!c) throw new Error("useCodeHer outside provider");
  return c;
}
