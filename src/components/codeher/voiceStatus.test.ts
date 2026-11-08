import { describe, it, expect } from "vitest";
import type { VoiceEngineState, VoiceEngineStatus, VoiceUnavailableReason } from "@/services/types";
import { describeVoice } from "./voiceStatus";

const st = (status: VoiceEngineStatus, reason?: VoiceUnavailableReason): VoiceEngineState =>
  reason ? { status, reason, native: false } : { status, native: false };

describe("voice status copy", () => {
  it("names the phrase while listening, with no fix action", () => {
    const c = describeVoice(st("listening"), false, "help me");
    expect(c.tone).toBe("ok");
    expect(c.title).toBe("Listening for “help me”");
    expect(c.action).toBeUndefined();
  });

  it("pause wins over the engine state and offers resume", () => {
    const c = describeVoice(st("listening"), true, "help me");
    expect(c.title).toBe("Listening is paused");
    expect(c.action).toBe("resume");
  });

  it("explains model loading in plain words", () => {
    expect(describeVoice(st("loading-model"), false, "x").title).toBe("Preparing voice engine");
  });

  it("asks for a tap when the browser needs a gesture", () => {
    const c = describeVoice(st("needs-gesture"), false, "x");
    expect(c.title).toBe("Tap to start listening");
    expect(c.action).toBe("start");
  });

  it("offers retry when the mic is blocked", () => {
    const c = describeVoice(st("mic-blocked"), false, "x");
    expect(c.tone).toBe("warn");
    expect(c.title).toBe("Microphone blocked");
    expect(c.action).toBe("retry");
  });

  it.each([
    ["insecure-context", "Voice cannot start on this page"],
    ["model-missing", "Voice is not set up on this site yet"],
    ["no-mic", "No microphone found"],
    ["unsupported", "Voice not available in this browser"],
    ["engine-error", "Voice not available in this browser"],
  ] as const)("unavailable %s reads %s and says SOS still works", (reason, title) => {
    const c = describeVoice(st("unavailable", reason), false, "x");
    expect(c.title).toBe(title);
    expect(c.detail).toContain("SOS");
  });

  it("a missing model never claims it is downloading", () => {
    // model-missing means the server does not have the file (404 or an SPA
    // index.html), so going online will not fix it.
    const c = describeVoice(st("unavailable", "model-missing"), false, "x");
    expect(`${c.title} ${c.detail}`).not.toMatch(/download|internet/i);
    expect(c.action).toBe("retry");
  });

  it("shows the phrase the engine really listens for", () => {
    expect(describeVoice(st("listening"), false, "  Code RED! ").title).toBe(
      "Listening for “code red”",
    );
    expect(describeVoice(st("listening"), false, "911").title).toBe("Listening for “help me”");
  });

  it("native copy never mentions a browser", () => {
    const nat = (status: VoiceEngineStatus, reason?: VoiceUnavailableReason): VoiceEngineState => ({
      ...st(status, reason),
      native: true,
    });
    for (const s of [nat("unavailable", "engine-error"), nat("unavailable"), nat("mic-blocked")]) {
      const c = describeVoice(s, false, "help me");
      expect(`${c.title} ${c.detail}`).not.toMatch(/browser/i);
      expect(c.detail).toContain("SOS");
    }
    expect(describeVoice(nat("unavailable", "engine-error"), false, "x").title).toBe(
      "Voice could not start",
    );
  });

  it("off offers to turn voice on", () => {
    expect(describeVoice(st("off"), false, "x").action).toBe("start");
  });

  it("never uses dashes in copy", () => {
    const states: VoiceEngineState[] = [
      st("off"),
      st("loading-model"),
      st("needs-gesture"),
      st("listening"),
      st("mic-blocked"),
      st("unavailable", "no-mic"),
    ];
    for (const s of states) {
      const c = describeVoice(s, false, "help me");
      expect(`${c.title} ${c.detail} ${c.actionLabel ?? ""}`).not.toMatch(/[–—]| - /);
    }
  });
});
