import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import {
  isNativeActive,
  listeningService,
  locationService,
  setSmsNoSignal,
  smsService,
  statusService,
  storageService,
  webSmsHandoff,
  type SmsPlatform,
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
  | "handoff"
  | "sent"
  | "queued"
  | "failed"
  | "tested";
export type Tab = "home" | "contacts" | "settings";

/** codeHER.md §2: one or two trusted contacts for the MVP. */
export const MAX_CONTACTS = 2;

/**
 * Defense in depth: ignore detector events below this confidence even if a
 * future engine emits them. Mirrors MIN_FINAL_CONFIDENCE in
 * VoskKeywordDetector (keep the two in sync).
 */
export const TRIGGER_CONFIDENCE = 0.9;

/** Seconds she gets to cancel an alert (codeHER.md §7). Shared by every screen. */
export const COUNTDOWN_SECONDS = 10;

/** Pause between "detected" (vibration) and the countdown screen. */
export const DETECT_TO_COUNTDOWN_MS = 400;

/**
 * The page hiding counts as "Messages opened" only this soon after an open
 * attempt (auto open or a tap on the link). Any other hide (app switch,
 * screen lock) says nothing about Messages.
 */
export const OPEN_ATTEMPT_WINDOW_MS = 2000;

/**
 * How the alert leaves the phone. "native": SmsManager sends it directly
 * (Android shell). "handoff": web build, the alert is prefilled in the
 * phone's Messages app through an `sms:` link and the user taps Send.
 */
export type SmsMode = "native" | "handoff";
export const smsMode: SmsMode = isNativeActive ? "native" : "handoff";

/**
 * Honest web status. "ready": the message is prepared, nothing has left the
 * phone yet. "opened": the page was hidden within OPEN_ATTEMPT_WINDOW_MS of
 * an open attempt on a phone, so Messages most likely opened; the user still
 * has to tap Send there. The web build can never confirm delivery, so there
 * is no "sent" here.
 */
export type HandoffStatus = "ready" | "opened";

export interface SmsHandoffState {
  /** `sms:` URI for the "Open Messages" anchor. */
  href: string;
  /** Exact alert text, shown on screen and copied by "Copy message". */
  body: string;
  platform: SmsPlatform;
  /** Contacts prefilled as recipients (one shared Messages thread). */
  recipients: Contact[];
  status: HandoffStatus;
  /** True when the store already tried one automatic open. */
  autoOpenAttempted: boolean;
  preparedAt: number;
}

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
  /** Web handoff draft; non-null only while phase is "handoff". */
  handoff: SmsHandoffState | null;
  online: boolean;
  permissions: PermissionsState | null;
  /**
   * True while a test alert runs (Home or Settings test button). A test
   * uses the same countdown but never opens Messages and never calls the
   * SMS service; it ends on the "tested" screen.
   */
  isTest: boolean;
  /** The text a test run would have sent; non-null only when "tested". */
  testBody: string | null;
  /**
   * Id of the latest alert run. The delayed "detected" to "countdown" step
   * only applies to the run that scheduled it, so a cancel (or a new alert)
   * in that window can never restart an old countdown.
   */
  alertRun: number;
}

export type EmergencyAction =
  | { type: "hydrate"; contacts: Contact[]; settings: Settings }
  | { type: "phase"; phase: Phase }
  | { type: "alert"; isTest: boolean; runId: number }
  | { type: "countdownStart"; runId: number }
  | { type: "testDone"; body: string }
  | { type: "tick" }
  | { type: "tab"; tab: Tab }
  | { type: "contacts"; contacts: Contact[] }
  | { type: "settings"; settings: Settings }
  | { type: "location"; location: LocationFix | null }
  | { type: "results"; results: ContactResult[]; phase: Phase }
  | { type: "handoff"; handoff: SmsHandoffState }
  | { type: "handoffOpened" }
  | { type: "online"; online: boolean }
  | { type: "permissions"; permissions: PermissionsState };

export const initialEmergencyState: EmergencyState = {
  phase: "listening",
  tab: "home",
  countdown: COUNTDOWN_SECONDS,
  contacts: defaultContacts,
  settings: defaultSettings,
  location: null,
  results: [],
  sentAt: null,
  handoff: null,
  online: true,
  permissions: null,
  isTest: false,
  testBody: null,
  alertRun: 0,
};

export function emergencyReducer(s: EmergencyState, a: EmergencyAction): EmergencyState {
  switch (a.type) {
    case "hydrate":
      return { ...s, contacts: a.contacts, settings: a.settings };
    case "phase":
      return {
        ...s,
        phase: a.phase,
        countdown: a.phase === "countdown" ? COUNTDOWN_SECONDS : s.countdown,
        handoff: a.phase === "handoff" ? s.handoff : null,
        // Back to idle ends any test run.
        isTest: a.phase === "listening" || a.phase === "paused" ? false : s.isTest,
        testBody: null,
      };
    case "alert":
      return {
        ...s,
        phase: "detected",
        isTest: a.isTest,
        testBody: null,
        handoff: null,
        alertRun: a.runId,
      };
    case "countdownStart":
      // Stale timer (cancelled, or superseded by a newer alert): no-op.
      if (s.phase !== "detected" || s.alertRun !== a.runId) return s;
      return { ...s, phase: "countdown", countdown: COUNTDOWN_SECONDS };
    case "testDone":
      // Only a test run may end here; a real alert is never swallowed.
      if (!s.isTest) return s;
      return { ...s, phase: "tested", testBody: a.body, handoff: null };
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
      return { ...s, results: a.results, phase: a.phase, sentAt: Date.now(), handoff: null };
    case "handoff":
      return {
        ...s,
        phase: "handoff",
        handoff: a.handoff,
        results: [],
        sentAt: a.handoff.preparedAt,
      };
    case "handoffOpened":
      if (!s.handoff || s.handoff.status === "opened") return s;
      return { ...s, handoff: { ...s.handoff, status: "opened" } };
    case "online":
      return { ...s, online: a.online };
    case "permissions":
      return { ...s, permissions: a.permissions };
  }
}

interface Ctx extends EmergencyState {
  trigger: () => void;
  /** Run the alert flow as a test: countdown, then a result. Never sends. */
  startTest: () => void;
  cancel: () => void;
  togglePause: () => void;
  backHome: () => void;
  setTab: (t: Tab) => void;
  setContacts: (c: Contact[]) => void;
  setSettings: (s: Settings) => void;
  refreshPermissions: () => void;
  /** "native" sends directly; "handoff" prefills the phone's Messages app. */
  smsMode: SmsMode;
  /**
   * Call from the "Open Messages" anchor's onClick (keep the real href).
   * Records an open attempt only; the status flips to "opened" when the page
   * hides right after it. Ignored on desktop (no Messages app).
   */
  noteOpenAttempt: () => void;
  /** Copy the alert text; resolves false when every clipboard path failed. */
  copyMessage: () => Promise<boolean>;
  /** The exact alert text contacts would get right now (Settings preview). */
  previewMessage: () => string;
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

/** Build the web handoff state for these contacts and alert text. */
export function prepareHandoff(
  contacts: Contact[],
  body: string,
  opts: { platform?: SmsPlatform; now?: number } = {},
): SmsHandoffState {
  const draft = webSmsHandoff.prepare(
    contacts.map((c) => c.phone),
    body,
    opts.platform,
  );
  return {
    href: draft.href,
    body: draft.body,
    platform: draft.platform,
    recipients: contacts,
    status: "ready",
    // Desktop has no Messages app to open; it shows the text with Copy.
    autoOpenAttempted: draft.platform !== "desktop",
    preparedAt: opts.now ?? Date.now(),
  };
}

/**
 * True when a page hide at `now` means Messages opened: a phone platform and
 * an open attempt at most OPEN_ATTEMPT_WINDOW_MS earlier. Desktop never counts.
 */
export function hideMeansOpened(
  platform: SmsPlatform,
  attemptAt: number | null,
  now: number,
): boolean {
  if (platform === "desktop" || attemptAt === null) return false;
  const since = now - attemptAt;
  return since >= 0 && since <= OPEN_ATTEMPT_WINDOW_MS;
}

export function CodeHerProvider({ children }: { children: ReactNode }) {
  const [s, d] = useReducer(emergencyReducer, initialEmergencyState);
  const ref = useRef(s);
  ref.current = s;
  const runRef = useRef(0);
  const alertRunRef = useRef(0);
  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openAttemptRef = useRef<number | null>(null);
  const handoffPlatformRef = useRef<SmsPlatform | null>(null);

  const clearAlertTimer = () => {
    if (alertTimerRef.current !== null) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = null;
  };
  const beginAlert = (isTest: boolean) => {
    navigator.vibrate?.(isTest ? [100] : [300, 100, 300]);
    clearAlertTimer();
    const runId = ++alertRunRef.current;
    d({ type: "alert", isTest, runId });
    alertTimerRef.current = setTimeout(() => {
      alertTimerRef.current = null;
      d({ type: "countdownStart", runId });
    }, DETECT_TO_COUNTDOWN_MS);
  };
  // The phrase listener is registered once; it calls the latest beginAlert.
  const beginAlertRef = useRef(beginAlert);
  beginAlertRef.current = beginAlert;

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
      beginAlertRef.current(false);
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
      if (alertTimerRef.current !== null) clearTimeout(alertTimerRef.current);
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
    // Tie this run to the alert that started it: after a cancel, a newer
    // alert or test gets a new alertRun, so the old run can never resume.
    const alertId = ref.current.alertRun;
    const live = () =>
      runRef.current === run &&
      ref.current.alertRun === alertId &&
      (ref.current.phase === "locating" || ref.current.phase === "sending");
    (async () => {
      const st = ref.current;
      // Native location/SMS land after listening: a rejection must degrade
      // (no-location SMS, failed status), never stall the flow.
      const fix = await locationService.getCurrent().catch((e: unknown) => {
        console.error(e);
        return null;
      });
      if (!live()) return;
      if (fix) d({ type: "location", location: fix });
      const body = buildMessage(st.settings.userName, fix, {
        includeMapLink: st.settings.includeMapLink,
      });
      // Test run: show what would go out. Never open Messages, never send.
      if (st.isTest) {
        d({ type: "testDone", body });
        return;
      }
      if (smsMode === "handoff") {
        const handoff = prepareHandoff(st.contacts, body);
        d({ type: "handoff", handoff });
        // One automatic attempt; the UI always renders the tap target too.
        if (handoff.autoOpenAttempted) {
          // Set before open(): the page can hide before the handoff render.
          handoffPlatformRef.current = handoff.platform;
          openAttemptRef.current = Date.now();
          webSmsHandoff.open(handoff.href);
        }
        return;
      }
      d({ type: "phase", phase: "sending" });
      const results = await sendToContacts(st.contacts, body);
      if (!live()) return;
      const phase: Phase = results.some((r) => r.status === "sent")
        ? "sent"
        : results.some((r) => r.status === "queued")
          ? "queued"
          : "failed";
      d({ type: "results", results, phase });
    })();
  }, [s.phase]);

  // Web handoff: the page going hidden right after an open attempt is the
  // best signal the browser gives that Messages opened. A hide at any other
  // time (app switch, screen lock) or on desktop proves nothing.
  // Listeners stay mounted so a hide that lands before the handoff render
  // commits (fast sms: intent) is still seen; the refs say whether it counts.
  useEffect(() => {
    const check = () => {
      const platform = handoffPlatformRef.current;
      if (platform && hideMeansOpened(platform, openAttemptRef.current, Date.now())) {
        d({ type: "handoffOpened" });
      }
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") check();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", check);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", check);
    };
  }, []);

  useEffect(() => {
    if (s.phase === "handoff") {
      handoffPlatformRef.current = s.handoff?.platform ?? null;
      return;
    }
    // Phase left handoff (or never reached it): nothing to attribute a hide to.
    if (s.phase !== "locating") {
      handoffPlatformRef.current = null;
      openAttemptRef.current = null;
    }
  }, [s.phase, s.handoff?.platform]);

  // Retry queued messages when signal returns
  useEffect(() => {
    // The "simulate no signal" toggle was removed: a stored value from an older
    // build must not block the retry, so the flag is no longer read here.
    if (s.phase !== "queued") return;
    const alertId = ref.current.alertRun;
    // She may leave the queued screen while the retry runs: drop its result.
    const live = () => ref.current.phase === "queued" && ref.current.alertRun === alertId;
    const t = setTimeout(async () => {
      try {
        await smsService.flushQueue();
      } catch (e: unknown) {
        console.error(e);
      }
      if (!live()) return;
      setSmsNoSignal(false);
      const st = ref.current;
      const results = await sendToContacts(
        st.contacts,
        buildMessage(st.settings.userName, st.location, {
          includeMapLink: st.settings.includeMapLink,
        }),
      );
      if (!live()) return;
      const phase: Phase = results.some((r) => r.status === "sent") ? "sent" : "failed";
      d({ type: "results", results, phase });
    }, 1500);
    return () => clearTimeout(t);
  }, [s.phase]);

  const ctx: Ctx = {
    ...s,
    smsMode,
    noteOpenAttempt: () => {
      if (ref.current.handoff?.platform === "desktop") return;
      openAttemptRef.current = Date.now();
    },
    copyMessage: () => {
      const text = ref.current.handoff?.body;
      if (!text) return Promise.resolve(false);
      return webSmsHandoff.copy(text);
    },
    previewMessage: () =>
      buildMessage(s.settings.userName, s.location, {
        includeMapLink: s.settings.includeMapLink,
      }),
    // Manual SOS backup (codeHER.md §7): always available, independent of the mic.
    trigger: () => beginAlert(false),
    startTest: () => {
      if (ref.current.phase !== "listening") return;
      beginAlert(true);
    },
    cancel: () => {
      clearAlertTimer();
      // Manual SOS works while paused (pause stopped the engine), and cancel
      // lands on "listening", so make the engine match. start() is idempotent.
      listeningService.start().catch((e: unknown) => console.error(e));
      d({ type: "phase", phase: "listening" });
    },
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
