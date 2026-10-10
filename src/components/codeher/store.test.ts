import { describe, it, expect } from "vitest";
import { emergencyReducer, initialEmergencyState, type EmergencyState } from "./store";
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
