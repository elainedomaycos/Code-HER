import { describe, it, expect } from "vitest";
import { mockListeningService, emitMockDetection } from "./voiceService";

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
