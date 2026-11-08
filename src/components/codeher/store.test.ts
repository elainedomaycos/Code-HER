import { describe, it, expect } from "vitest";
import {
  COUNTDOWN_SECONDS,
  emergencyReducer,
  hideMeansOpened,
  initialEmergencyState,
  OPEN_ATTEMPT_WINDOW_MS,
  prepareHandoff,
  smsMode,
  type EmergencyState,
} from "./store";
import type { ContactResult, LocationFix } from "@/services/types";

function state(over: Partial<EmergencyState>): EmergencyState {
  return { ...initialEmergencyState, ...over };
}

const FIX: LocationFix = { lat: 13.7, lng: 121.0, accuracyM: 10, at: 1, source: "gps" };
const RESULTS: ContactResult[] = [
  { contact: { id: "c1", name: "Mia Santos", phone: "+639172840612" }, status: "sent" },
];

describe("emergency state machine", () => {
  it("starts listening with a full countdown", () => {
    expect(initialEmergencyState.phase).toBe("listening");
    expect(initialEmergencyState.countdown).toBe(10);
  });

  it("entering countdown resets the timer", () => {
    const s = emergencyReducer(state({ phase: "detected", countdown: 0 }), {
      type: "phase",
      phase: "countdown",
    });
    expect(s.phase).toBe("countdown");
    expect(s.countdown).toBe(10);
  });

  it("ticks down and floors at zero", () => {
    const s1 = emergencyReducer(state({ phase: "countdown", countdown: 3 }), { type: "tick" });
    expect(s1.countdown).toBe(2);
    const s0 = emergencyReducer(state({ phase: "countdown", countdown: 0 }), { type: "tick" });
    expect(s0.countdown).toBe(0);
  });

  it("cancel returns to listening", () => {
    const s = emergencyReducer(state({ phase: "countdown", countdown: 4 }), {
      type: "phase",
      phase: "listening",
    });
    expect(s.phase).toBe("listening");
  });

  it("records per-contact results with a timestamp", () => {
    const before = Date.now();
    const s = emergencyReducer(state({ phase: "sending" }), {
      type: "results",
      results: RESULTS,
      phase: "sent",
    });
    expect(s.phase).toBe("sent");
    expect(s.results).toEqual(RESULTS);
    expect(s.sentAt).toBeGreaterThanOrEqual(before);
  });

  it("stores the location fix when one arrives", () => {
    const s = emergencyReducer(state({ location: null }), { type: "location", location: FIX });
    expect(s.location).toEqual(FIX);
  });

  it("hydrates contacts and settings from storage", () => {
    const s = emergencyReducer(state({ contacts: [] }), {
      type: "hydrate",
      contacts: [{ id: "x", name: "A", phone: "+639000000000" }],
      settings: {
        userName: "Z",
        safePhrase: "Help me",
        simulateNoSignal: true,
        onboarded: true,
        includeMapLink: false,
      },
    });
    expect(s.contacts).toHaveLength(1);
    expect(s.settings.safePhrase).toBe("Help me");
    expect(s.settings.onboarded).toBe(true);
  });
});

describe("web SMS handoff", () => {
  const CONTACTS = [
    { id: "c1", name: "Mia Santos", phone: "+639172840612" },
    { id: "c2", name: "Leo Cruz", phone: "+63 918 555 0101" },
  ];
  const BODY = "EMERGENCY: Ana may need help. Location: 13.70000,121.00000 at 10:00 PM.";

  it("uses the handoff path outside the native shell", () => {
    expect(smsMode).toBe("handoff");
  });

  it("prepares a ready handoff with every contact and the exact body", () => {
    const h = prepareHandoff(CONTACTS, BODY, { platform: "android", now: 42 });
    expect(h.status).toBe("ready");
    expect(h.recipients).toEqual(CONTACTS);
    expect(h.body).toBe(BODY);
    expect(h.href).toBe(`sms:+639172840612,+639185550101?body=${encodeURIComponent(BODY)}`);
    expect(h.autoOpenAttempted).toBe(true);
    expect(h.preparedAt).toBe(42);
  });

  it("uses the iOS group form and skips auto open on desktop", () => {
    expect(prepareHandoff(CONTACTS, "x", { platform: "ios" }).href).toBe(
      "sms:/open?addresses=+639172840612,+639185550101&body=x",
    );
    expect(prepareHandoff(CONTACTS, "x", { platform: "desktop" }).autoOpenAttempted).toBe(false);
  });

  it("locating moves to handoff without fake per contact results", () => {
    const h = prepareHandoff(CONTACTS, BODY, { platform: "android", now: 7 });
    const s = emergencyReducer(state({ phase: "locating", results: RESULTS }), {
      type: "handoff",
      handoff: h,
    });
    expect(s.phase).toBe("handoff");
    expect(s.handoff).toEqual(h);
    expect(s.results).toEqual([]);
    expect(s.sentAt).toBe(7);
  });

  it("marks the handoff opened once, and ignores it with no handoff", () => {
    const h = prepareHandoff(CONTACTS, BODY, { platform: "android" });
    const ready = emergencyReducer(state({}), { type: "handoff", handoff: h });
    const opened = emergencyReducer(ready, { type: "handoffOpened" });
    expect(opened.handoff?.status).toBe("opened");
    expect(emergencyReducer(opened, { type: "handoffOpened" })).toBe(opened);
    const idle = state({});
    expect(emergencyReducer(idle, { type: "handoffOpened" })).toBe(idle);
  });

  it("going back to listening clears the handoff", () => {
    const h = prepareHandoff(CONTACTS, BODY, { platform: "android" });
    const ready = emergencyReducer(state({}), { type: "handoff", handoff: h });
    const back = emergencyReducer(ready, { type: "phase", phase: "listening" });
    expect(back.phase).toBe("listening");
    expect(back.handoff).toBeNull();
  });

  it("native results clear any stale handoff", () => {
    const h = prepareHandoff(CONTACTS, BODY, { platform: "android" });
    const ready = emergencyReducer(state({}), { type: "handoff", handoff: h });
    const s = emergencyReducer(ready, { type: "results", results: RESULTS, phase: "sent" });
    expect(s.handoff).toBeNull();
  });
});

describe("test alerts never send", () => {
  it("a test alert is flagged from the first step", () => {
    const s = emergencyReducer(state({}), { type: "alert", isTest: true, runId: 1 });
    expect(s.phase).toBe("detected");
    expect(s.isTest).toBe(true);
  });

  it("a real alert is never flagged as a test", () => {
    const s = emergencyReducer(state({ isTest: true }), { type: "alert", isTest: false, runId: 1 });
    expect(s.isTest).toBe(false);
  });

  it("the flag survives the countdown and ends on the tested screen", () => {
    let s = emergencyReducer(state({}), { type: "alert", isTest: true, runId: 1 });
    s = emergencyReducer(s, { type: "phase", phase: "countdown" });
    s = emergencyReducer(s, { type: "phase", phase: "locating" });
    expect(s.isTest).toBe(true);
    s = emergencyReducer(s, { type: "testDone", body: "EMERGENCY: test" });
    expect(s.phase).toBe("tested");
    expect(s.testBody).toBe("EMERGENCY: test");
    expect(s.handoff).toBeNull();
  });

  it("a real alert cannot be ended as a test", () => {
    const s = emergencyReducer(state({ phase: "locating", isTest: false }), {
      type: "testDone",
      body: "x",
    });
    expect(s.phase).toBe("locating");
  });

  it("going back home clears the test flag", () => {
    const s = emergencyReducer(state({ phase: "tested", isTest: true, testBody: "x" }), {
      type: "phase",
      phase: "listening",
    });
    expect(s.isTest).toBe(false);
    expect(s.testBody).toBeNull();
  });
});

describe("delayed countdown start is tied to its alert run", () => {
  it("starts the countdown for the run that scheduled it", () => {
    let s = emergencyReducer(state({}), { type: "alert", isTest: false, runId: 1 });
    s = emergencyReducer(s, { type: "countdownStart", runId: 1 });
    expect(s.phase).toBe("countdown");
    expect(s.countdown).toBe(COUNTDOWN_SECONDS);
  });

  it("a cancel inside the delay is never undone by the old timer", () => {
    let s = emergencyReducer(state({}), { type: "alert", isTest: true, runId: 1 });
    s = emergencyReducer(s, { type: "phase", phase: "listening" });
    const after = emergencyReducer(s, { type: "countdownStart", runId: 1 });
    expect(after).toBe(s);
    expect(after.phase).toBe("listening");
    expect(after.isTest).toBe(false);
  });

  it("a stale timer from an older run is ignored", () => {
    let s = emergencyReducer(state({}), { type: "alert", isTest: true, runId: 1 });
    s = emergencyReducer(s, { type: "phase", phase: "listening" });
    s = emergencyReducer(s, { type: "alert", isTest: false, runId: 2 });
    expect(emergencyReducer(s, { type: "countdownStart", runId: 1 })).toBe(s);
    expect(emergencyReducer(s, { type: "countdownStart", runId: 2 }).phase).toBe("countdown");
  });
});

describe("handoff counts as opened only right after an open attempt", () => {
  it("a hide within the window after an attempt on a phone counts", () => {
    expect(hideMeansOpened("android", 1000, 1000 + OPEN_ATTEMPT_WINDOW_MS)).toBe(true);
    expect(hideMeansOpened("ios", 1000, 1500)).toBe(true);
  });

  it("a hide with no attempt, or long after one, does not count", () => {
    expect(hideMeansOpened("android", null, 5000)).toBe(false);
    expect(hideMeansOpened("android", 1000, 1001 + OPEN_ATTEMPT_WINDOW_MS)).toBe(false);
    expect(hideMeansOpened("android", 2000, 1000)).toBe(false);
  });

  it("never counts on desktop", () => {
    expect(hideMeansOpened("desktop", 1000, 1100)).toBe(false);
  });
});
