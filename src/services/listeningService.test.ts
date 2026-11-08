import { describe, it, expect } from "vitest";
import type { ListeningService } from "./types";
import {
  emitMockDetection,
  isPermissionDenied,
  mockListeningService,
  withCoarseEngineState,
} from "./voiceService";

describe("mock listening service (§4 contract)", () => {
  it("reports status transitions and fires detection events", async () => {
    expect(await mockListeningService.getStatus()).toBe("stopped");
    await mockListeningService.start();
    expect(await mockListeningService.getStatus()).toBe("listening");

    const seen: string[] = [];
    const off = mockListeningService.onPhraseDetected((e) => {
      seen.push(e.phrase);
      expect(e.confidence).toBe(1);
      expect(e.at).toBeGreaterThan(0);
    });
    await mockListeningService.setPhrase("help");
    emitMockDetection();
    expect(seen).toEqual(["help"]);

    off();
    emitMockDetection();
    expect(seen).toEqual(["help"]);

    await mockListeningService.stop();
    expect(await mockListeningService.getStatus()).toBe("stopped");
  });

  it("ignores simulated detections while stopped", async () => {
    await mockListeningService.stop();
    let fired = false;
    const off = mockListeningService.onPhraseDetected(() => {
      fired = true;
    });
    emitMockDetection();
    expect(fired).toBe(false);
    off();
  });
});

function rejectingService(error: unknown): ListeningService {
  return { ...mockListeningService, start: () => Promise.reject(error) };
}

describe("native coarse engine state", () => {
  it("a denied mic on Android reads mic-blocked, not unavailable", async () => {
    // HerNativePlugin: call.reject("Microphone permission denied")
    const coarse = withCoarseEngineState(
      rejectingService(new Error("Microphone permission denied")),
    );
    await expect(coarse.service.start()).rejects.toThrow();
    expect(coarse.getEngineState()).toEqual({ status: "mic-blocked", native: true });
  });

  it("other start failures stay unavailable/engine-error", async () => {
    const coarse = withCoarseEngineState(rejectingService(new Error("Could not start listening")));
    await expect(coarse.service.start()).rejects.toThrow();
    expect(coarse.getEngineState()).toEqual({
      status: "unavailable",
      reason: "engine-error",
      native: true,
    });
  });

  it("start resolved reads listening, stop reads off", async () => {
    const coarse = withCoarseEngineState(mockListeningService);
    await coarse.service.start();
    expect(coarse.getEngineState().status).toBe("listening");
    await coarse.service.stop();
    expect(coarse.getEngineState().status).toBe("off");
  });

  it.each([
    [Object.assign(new Error("x"), { name: "NotAllowedError" }), true],
    [{ message: "User denied access" }, true],
    [new Error("Could not start listening"), false],
    ["denied", false],
    [null, false],
  ])("isPermissionDenied(%o) is %s", (e, expected) => {
    expect(isPermissionDenied(e)).toBe(expected);
  });
});
