import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import type { Contact, ContactResult, Location, Settings } from "@/services/types";
import * as storage from "@/services/storageService";
import * as voice from "@/services/voiceService";
import { getCurrentLocation, getLastKnown } from "@/services/locationService";
import { sendSMS, retryQueued } from "@/services/smsService";
import { buildMessage } from "@/services/messageBuilder";

export type Phase = "paused" | "listening" | "detected" | "countdown" | "locating" | "sending" | "sent" | "queued" | "failed";
export type Tab = "home" | "sos" | "contacts";

interface State {
  phase: Phase;
  tab: Tab;
  countdown: number;
  contacts: Contact[];
  settings: Settings;
  location: Location;
  results: ContactResult[];
  sentAt: number | null;
  online: boolean;
}

type Action =
  | { type: "hydrate"; contacts: Contact[]; settings: Settings }
  | { type: "phase"; phase: Phase }
  | { type: "tick" }
  | { type: "tab"; tab: Tab }
  | { type: "contacts"; contacts: Contact[] }
  | { type: "settings"; settings: Settings }
  | { type: "location"; location: Location }
  | { type: "results"; results: ContactResult[]; phase: Phase }
  | { type: "online"; online: boolean };

const initial: State = {
  phase: "listening", tab: "home", countdown: 10,
  contacts: storage.defaultContacts, settings: storage.defaultSettings,
  location: getLastKnown(), results: [], sentAt: null, online: true,
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "hydrate": return { ...s, contacts: a.contacts, settings: a.settings };
    case "phase": return { ...s, phase: a.phase, countdown: a.phase === "countdown" ? 10 : s.countdown };
    case "tick": return { ...s, countdown: Math.max(0, s.countdown - 1) };
    case "tab": return { ...s, tab: a.tab };
    case "contacts": return { ...s, contacts: a.contacts };
    case "settings": return { ...s, settings: a.settings };
    case "location": return { ...s, location: a.location };
    case "results": return { ...s, results: a.results, phase: a.phase, sentAt: Date.now() };
    case "online": return { ...s, online: a.online };
  }
}

interface Ctx extends State {
  trigger: () => void;
  cancel: () => void;
  togglePause: () => void;
  backHome: () => void;
  setTab: (t: Tab) => void;
  setContacts: (c: Contact[]) => void;
  setSettings: (s: Settings) => void;
}
const C = createContext<Ctx | null>(null);

export function CodeHerProvider({ children }: { children: ReactNode }) {
  const [s, d] = useReducer(reducer, initial);
  const ref = useRef(s);
  ref.current = s;

  useEffect(() => {
    Promise.all([storage.loadContacts(), storage.loadSettings()]).then(([contacts, settings]) =>
      d({ type: "hydrate", contacts, settings }),
    );
    getCurrentLocation().then((location) => d({ type: "location", location }));
    voice.startListening();
    const off = voice.onPhraseDetected(() => {
      if (ref.current.phase !== "listening") return;
      navigator.vibrate?.([300, 100, 300]);
      d({ type: "phase", phase: "detected" });
      setTimeout(() => d({ type: "phase", phase: "countdown" }), 400);
    });
    const on = () => d({ type: "online", online: navigator.onLine });
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => { off(); window.removeEventListener("online", on); window.removeEventListener("offline", on); };
  }, []);

  // Countdown → locating → sending → result
  useEffect(() => {
    if (s.phase !== "countdown") return;
    if (s.countdown === 0) { d({ type: "phase", phase: "locating" }); return; }
    const t = setTimeout(() => d({ type: "tick" }), 1000);
    return () => clearTimeout(t);
  }, [s.phase, s.countdown]);

  useEffect(() => {
    if (s.phase !== "locating") return;
    let live = true;
    (async () => {
      const loc = await getCurrentLocation();
      if (!live) return;
      d({ type: "location", location: loc });
      d({ type: "phase", phase: "sending" });
      const st = ref.current;
      const results = await sendSMS(st.contacts, buildMessage(st.settings.userName, loc), { noSignal: st.settings.simulateNoSignal });
      if (!live) return;
      const phase: Phase = results.some((r) => r.status === "sent") ? "sent"
        : results.some((r) => r.status === "queued") ? "queued" : "failed";
      d({ type: "results", results, phase });
    })();
    return () => { live = false; };
  }, [s.phase]);

  // Retry queued messages when signal returns
  useEffect(() => {
    if (s.phase !== "queued" || s.settings.simulateNoSignal) return;
    const t = setTimeout(async () => {
      const r = await retryQueued({ noSignal: false });
      if (r) d({ type: "results", results: r, phase: r.some((x) => x.status === "sent") ? "sent" : "failed" });
    }, 1500);
    return () => clearTimeout(t);
  }, [s.phase, s.settings.simulateNoSignal]);

  const ctx: Ctx = {
    ...s,
    trigger: useCallback(() => voice.simulateDetection(ref.current.settings.safePhrase), []),
    cancel: () => d({ type: "phase", phase: "listening" }),
    togglePause: () => {
      if (s.phase === "paused") { voice.startListening(); d({ type: "phase", phase: "listening" }); }
      else { voice.stopListening(); d({ type: "phase", phase: "paused" }); }
    },
    backHome: () => { voice.startListening(); d({ type: "phase", phase: "listening" }); d({ type: "tab", tab: "home" }); },
    setTab: (tab) => d({ type: "tab", tab }),
    setContacts: (contacts) => { storage.saveContacts(contacts); d({ type: "contacts", contacts }); },
    setSettings: (settings) => { storage.saveSettings(settings); d({ type: "settings", settings }); },
  };
  return <C.Provider value={ctx}>{children}</C.Provider>;
}

export function useCodeHer() {
  const c = useContext(C);
  if (!c) throw new Error("useCodeHer outside provider");
  return c;
}
