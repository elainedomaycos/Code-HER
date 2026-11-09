import { describe, expect, it, vi } from "vitest";

// The real loader dynamically imports vosk-browser; mock the module so the
// test never touches WASM or Workers.
const created: string[] = [];
vi.mock("vosk-browser", () => {
  class Model {
    constructor(url: string) {
      created.push(url);
    }
    on(event: string, listener: (m: unknown) => void): void {
      if (event === "load") queueMicrotask(() => listener({ event: "load", result: true }));
    }
    get KaldiRecognizer() {
      return class {
        on(): void {}
        setWords(): void {}
        acceptWaveform(): void {}
        remove(): void {}
      };
    }
    terminate(): void {}
  }
  return { Model, createModel: vi.fn() };
});

import { createWebListeningService, VOSK_MODEL_FILE } from "./webVoiceService";

describe("default vosk-browser loader", () => {
  it("dynamically imports vosk-browser and loads the same-origin model", async () => {
    const ctx = {
      state: "running",
      sampleRate: 16000,
      destination: {},
      resume: async () => undefined,
      close: async () => undefined,
      createMediaStreamSource: () => ({ connect: () => undefined, disconnect: () => undefined }),
      createScriptProcessor: () => ({ connect: () => undefined, disconnect: () => undefined }),
    };
    const svc = createWebListeningService({
      unsupportedReason: () => null,
      getUserMedia: async () => ({ getTracks: () => [] }) as unknown as MediaStream,
      // Fake implements only what the service touches.
      createAudioContext: () => ctx as unknown as AudioContext,
      // No network in unit tests; the preflight has its own tests.
      probeModel: async () => "ok",
    });
    await svc.start();
    expect(svc.getEngineState().status).toBe("listening");
    expect(created).toEqual([`${window.location.origin}/models/${VOSK_MODEL_FILE}`]);
    await svc.stop();
  });
});
