// End to end through the real listener path: Vosk final result → grammar
// gate → webListeningService listeners → store TRIGGER_CONFIDENCE gate →
// alert. Only the engine edges (WASM model, mic, AudioContext) are faked.
import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";

type Listener = (message: unknown) => void;

const engine = vi.hoisted(() => ({
  recognizers: [] as Array<{ grammar: string | undefined; fire: (m: unknown) => void }>,
}));

vi.mock("@/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services")>();
  const { createWebListeningService } = await import("@/services/webVoiceService");
  class FakeRecognizer {
    private readonly listeners = new Map<string, Listener[]>();
    constructor(_rate: number, grammar?: string) {
      engine.recognizers.push({
        grammar,
        fire: (m) => (this.listeners.get("result") ?? []).forEach((l) => l(m)),
      });
    }
    on(event: string, l: Listener): void {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), l]);
    }
    setWords(): void {}
    acceptWaveform(): void {}
    remove(): void {}
  }
  class FakeModel {
    readonly KaldiRecognizer = FakeRecognizer;
    on(event: string, l: Listener): void {
      if (event === "load") queueMicrotask(() => l({ event: "load", result: true }));
    }
    terminate(): void {}
  }
  const ctx = {
    state: "running",
    sampleRate: 16000,
    destination: {},
    onstatechange: null,
    resume: async () => undefined,
    close: async () => undefined,
    createMediaStreamSource: () => ({ connect: () => undefined, disconnect: () => undefined }),
    createScriptProcessor: () => ({ connect: () => undefined, disconnect: () => undefined }),
  };
  const track = { stop: () => undefined, readyState: "live", onended: null };
  const listeningService = createWebListeningService({
    loadVosk: async () => FakeModel,
    modelUrl: () => "http://localhost/models/model.tar.gz",
    probeModel: async () => "ok",
    unsupportedReason: () => null,
    getUserMedia: async () => ({ getTracks: () => [track] }) as unknown as MediaStream,
    // The fake implements only what the service touches.
    createAudioContext: () => ctx as unknown as AudioContext,
    onUserGesture: () => () => undefined,
    onVisible: () => () => undefined,
  });
  return { ...actual, listeningService, getVoiceEngineState: listeningService.getEngineState };
});

import { listeningService } from "@/services";
import { CodeHerProvider, TRIGGER_CONFIDENCE, useCodeHer } from "@/components/codeher/store";
import { MIN_FINAL_CONFIDENCE } from "./voskGrammar";

function Phase() {
  return <p data-testid="phase">{useCodeHer().phase}</p>;
}

const final = (text: string, conf: number) => ({
  event: "result",
  result: { text, result: text.split(" ").map((word) => ({ word, conf })) },
});

describe("voice detection pipeline", () => {
  it("keeps the engine gate and the store gate in sync", () => {
    expect(MIN_FINAL_CONFIDENCE).toBe(TRIGGER_CONFIDENCE);
  });

  it("a confident final for the phrase starts an alert; weak or other speech does not", async () => {
    localStorage.clear();
    render(
      <CodeHerProvider>
        <Phase />
      </CodeHerProvider>,
    );
    await vi.waitFor(() => expect(engine.recognizers.length).toBeGreaterThan(0));
    await vi.waitFor(async () => expect(await listeningService.getStatus()).toBe("listening"));
    const rec = engine.recognizers.at(-1)!;
    expect(JSON.parse(rec.grammar!)).toEqual(["help me", "[unk]"]);

    act(() => {
      rec.fire(final("help me", TRIGGER_CONFIDENCE - 0.05));
      rec.fire(final("[unk]", 1));
      rec.fire({ event: "partialresult", result: { partial: "help me" } });
    });
    expect(screen.getByTestId("phase").textContent).toBe("listening");

    act(() => rec.fire(final("help me", 0.97)));
    expect(screen.getByTestId("phase").textContent).toBe("detected");
  });
});
