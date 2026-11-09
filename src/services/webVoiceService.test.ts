import { afterEach, describe, expect, it, vi } from "vitest";
import type { PhraseDetection, VoiceEngineState } from "./types";
import {
  createWebListeningService,
  probeModelUrl,
  type VoskModelCtor,
  type VoskModelLike,
  type VoskRecognizerLike,
  type WebVoiceDeps,
} from "./webVoiceService";

// ---- Fakes -----------------------------------------------------------------
type Listener = (message: unknown) => void;

class FakeRecognizer implements VoskRecognizerLike {
  static all: FakeRecognizer[] = [];
  listeners = new Map<string, Listener[]>();
  words = false;
  removed = false;
  constructor(
    readonly sampleRate: number,
    readonly grammar?: string,
  ) {
    FakeRecognizer.all.push(this);
  }
  on(event: string, listener: Listener): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
  }
  setWords(words: boolean): void {
    this.words = words;
  }
  acceptWaveform(): void {}
  remove(): void {
    this.removed = true;
  }
  fire(event: string, message: unknown): void {
    (this.listeners.get(event) ?? []).forEach((l) => l(message));
  }
}

type LoadOutcome = "ok" | "fail" | { error: string } | "never";

function fakeModelCtor(
  outcome: LoadOutcome,
): VoskModelCtor & { urls: string[]; meta: { terminated: number } } {
  const urls: string[] = [];
  const meta = { terminated: 0 };
  class FakeModel implements VoskModelLike {
    readonly KaldiRecognizer = FakeRecognizer;
    constructor(url: string) {
      urls.push(url);
    }
    on(event: "load" | "error", listener: Listener): void {
      queueMicrotask(() => {
        if (outcome === "never") return;
        if (event === "load" && (outcome === "ok" || outcome === "fail")) {
          listener({ event: "load", result: outcome === "ok" });
        }
        if (event === "error" && typeof outcome === "object") {
          listener({ event: "error", error: outcome.error });
        }
      });
    }
    terminate(): void {
      meta.terminated += 1;
    }
  }
  return Object.assign(FakeModel, { urls, meta });
}

function fakeAudioContext(initial: AudioContextState = "running") {
  const ctx = {
    // "interrupted" is Safari only and not in the DOM lib type.
    state: initial as AudioContextState | "interrupted",
    sampleRate: 48000,
    destination: {},
    closed: false,
    onstatechange: null as (() => void) | null,
    /** OS side state change (suspend, interruption) with its statechange event. */
    osSets(next: AudioContextState | "interrupted") {
      ctx.state = next;
      ctx.onstatechange?.();
    },
    resume: vi.fn((): Promise<void> => {
      if (ctx.hangResume) return new Promise<void>(() => undefined);
      if (ctx.resumable && ctx.state !== "running") ctx.osSets("running");
      return Promise.resolve();
    }),
    resumable: true,
    hangResume: false,
    close: vi.fn(async () => {
      ctx.closed = true;
    }),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    createScriptProcessor: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null as unknown,
    })),
  };
  return ctx;
}

function fakeStream() {
  const track = {
    stop: vi.fn(),
    readyState: "live" as MediaStreamTrackState,
    onended: null as (() => void) | null,
    /** Mic taken by a call, unplugged, or permission revoked. */
    end() {
      track.readyState = "ended";
      track.onended?.();
    },
    muted: false,
    onmute: null as (() => void) | null,
    onunmute: null as (() => void) | null,
    /** OS or another app takes the mic: the track stays live but sends silence. */
    mute(on: boolean) {
      track.muted = on;
      (on ? track.onmute : track.onunmute)?.();
    },
  };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  return { stream: stream as unknown as MediaStream, track };
}

function setup(
  over: Partial<WebVoiceDeps> & { outcome?: LoadOutcome; ctxState?: AudioContextState } = {},
) {
  const { outcome = "ok", ctxState = "running", ...rest } = over;
  const Model = fakeModelCtor(outcome);
  const ctx = fakeAudioContext(ctxState);
  const { stream, track } = fakeStream();
  let gesture: (() => void) | null = null;
  let visible: (() => void) | null = null;
  const deps: Partial<WebVoiceDeps> = {
    loadVosk: async () => Model,
    modelUrl: () => "http://localhost/models/model.tar.gz",
    getUserMedia: vi.fn(async () => stream),
    // The fake implements only what the service touches.
    createAudioContext: () => ctx as unknown as AudioContext,
    unsupportedReason: () => null,
    onUserGesture: (cb) => {
      gesture = cb;
      return () => {
        gesture = null;
      };
    },
    onVisible: (cb) => {
      visible = cb;
      return () => {
        visible = null;
      };
    },
    probeModel: async () => "ok",
    modelLoadTimeoutMs: 1000,
    resumeTimeoutMs: 20,
    ...rest,
  };
  const svc = createWebListeningService(deps);
  const states: VoiceEngineState[] = [];
  svc.onEngineStateChange((s) => states.push(s));
  const seen: PhraseDetection[] = [];
  svc.onPhraseDetected((e) => seen.push(e));
  return {
    svc,
    Model,
    ctx,
    track,
    states,
    seen,
    deps,
    tapPage: () => gesture?.(),
    hasTapListener: () => gesture !== null,
    returnToPage: () => visible?.(),
  };
}

const confidentFinal = (text: string, conf = 0.97) => ({
  event: "result",
  result: { text, result: text.split(" ").map((word) => ({ word, conf, start: 0, end: 1 })) },
});

afterEach(() => {
  FakeRecognizer.all = [];
  vi.restoreAllMocks();
});

// ---- Tests -------------------------------------------------------------------
describe("web voice service: happy path", () => {
  it("goes loading-model → listening and builds a restricted grammar recognizer", async () => {
    const { svc, Model, states } = setup();
    await svc.start();
    expect(states.map((s) => s.status)).toEqual(["loading-model", "listening"]);
    expect(await svc.getStatus()).toBe("listening");
    expect(Model.urls).toEqual(["http://localhost/models/model.tar.gz"]);
    const rec = FakeRecognizer.all[0]!;
    expect(rec.sampleRate).toBe(48000);
    expect(JSON.parse(rec.grammar!)).toEqual(["help me", "[unk]"]);
    expect(rec.words).toBe(true);
  });

  it("emits only confident finals for the configured phrase", async () => {
    const { svc, seen } = setup();
    await svc.start();
    const rec = FakeRecognizer.all[0]!;
    rec.fire("partialresult", { event: "partialresult", result: { partial: "help me" } });
    rec.fire("result", confidentFinal("help me", 0.5));
    rec.fire("result", confidentFinal("[unk]", 1));
    expect(seen).toEqual([]);
    rec.fire("result", confidentFinal("help me", 0.97));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ phrase: "help me", confidence: 0.97 });
  });

  it("setPhrase rebuilds the recognizer grammar and the model is reused", async () => {
    const { svc, Model, seen } = setup();
    await svc.start();
    await svc.setPhrase("Red Apple!");
    expect(FakeRecognizer.all).toHaveLength(2);
    const [old, current] = FakeRecognizer.all;
    expect(old!.removed).toBe(true);
    expect(JSON.parse(current!.grammar!)).toEqual(["red apple", "[unk]"]);
    current!.fire("result", confidentFinal("red apple"));
    expect(seen[0]?.phrase).toBe("red apple");
    expect(Model.urls).toHaveLength(1);
  });

  it("setPhrase before start is used when the recognizer is created", async () => {
    const { svc } = setup();
    await svc.setPhrase("help");
    await svc.start();
    expect(JSON.parse(FakeRecognizer.all[0]!.grammar!)).toEqual(["help", "[unk]"]);
  });

  it("stop releases the mic and audio graph but keeps the model for a fast restart", async () => {
    const { svc, Model, ctx, track } = setup();
    await svc.start();
    await svc.stop();
    expect(track.stop).toHaveBeenCalled();
    expect(ctx.close).toHaveBeenCalled();
    expect(FakeRecognizer.all[0]!.removed).toBe(true);
    expect(svc.getEngineState().status).toBe("off");
    expect(await svc.getStatus()).toBe("stopped");
    await svc.start();
    expect(Model.urls).toHaveLength(1);
    expect(svc.getEngineState().status).toBe("listening");
  });

  it("stop during model load aborts cleanly", async () => {
    const { svc, track } = setup({ outcome: "never" });
    const starting = svc.start();
    await vi.waitFor(() => expect(svc.getEngineState().status).toBe("loading-model"));
    await svc.stop();
    expect(svc.getEngineState().status).toBe("off");
    expect(track.stop).toHaveBeenCalled();
    await starting.catch(() => undefined);
  });
});

describe("web voice service: autoplay gesture", () => {
  it("reports needs-gesture until the user taps, then listens", async () => {
    const { svc, ctx, tapPage } = setup({ ctxState: "suspended" });
    ctx.resumable = false;
    await svc.start();
    expect(svc.getEngineState().status).toBe("needs-gesture");
    expect(await svc.getStatus()).toBe("starting");
    ctx.resumable = true;
    tapPage();
    await vi.waitFor(() => expect(svc.getEngineState().status).toBe("listening"));
  });

  it("a resume() that never settles still reaches needs-gesture with a tap listener", async () => {
    const { svc, ctx, hasTapListener, tapPage } = setup({ ctxState: "suspended" });
    ctx.hangResume = true;
    // Not awaited on purpose: before the fix start() hung in loading-model.
    void svc.start();
    await vi.waitFor(() => expect(svc.getEngineState().status).toBe("needs-gesture"));
    expect(hasTapListener()).toBe(true);
    ctx.hangResume = false;
    tapPage();
    await vi.waitFor(() => expect(svc.getEngineState().status).toBe("listening"));
  });
});

describe("web voice service: staying honest after going live", () => {
  it("OS suspend while listening drops to needs-gesture; a tap resumes", async () => {
    const { svc, ctx, tapPage } = setup();
    await svc.start();
    expect(svc.getEngineState().status).toBe("listening");
    ctx.resumable = false;
    ctx.osSets("suspended");
    expect(svc.getEngineState().status).toBe("needs-gesture");
    ctx.resumable = true;
    tapPage();
    await vi.waitFor(() => expect(svc.getEngineState().status).toBe("listening"));
  });

  it("Safari interruption (call) drops to needs-gesture", async () => {
    const { svc, ctx } = setup();
    await svc.start();
    ctx.resumable = false;
    ctx.osSets("interrupted");
    expect(svc.getEngineState().status).toBe("needs-gesture");
  });

  it("start() while listening resumes a silently suspended context", async () => {
    const { svc, ctx } = setup();
    await svc.start();
    ctx.state = "suspended"; // no statechange event fired
    await svc.start();
    expect(ctx.resume).toHaveBeenCalled();
    expect(ctx.state).toBe("running");
    expect(svc.getEngineState().status).toBe("listening");
  });

  it("start() reports needs-gesture when the silent suspend cannot be resumed", async () => {
    const { svc, ctx } = setup();
    await svc.start();
    ctx.resumable = false;
    ctx.state = "suspended";
    await svc.start();
    expect(svc.getEngineState().status).toBe("needs-gesture");
  });

  it("mic track ended drops to needs-gesture; start() re-acquires the mic", async () => {
    const first = fakeStream();
    const getUserMedia = vi.fn(async () => fakeStream().stream).mockResolvedValueOnce(first.stream);
    const { svc, deps, ctx } = setup({ getUserMedia });
    await svc.start();
    first.track.end();
    expect(svc.getEngineState().status).toBe("needs-gesture");
    await svc.start();
    expect(first.track.stop).toHaveBeenCalled();
    expect(deps.getUserMedia).toHaveBeenCalledTimes(2);
    expect(ctx.close).toHaveBeenCalled();
    expect(svc.getEngineState().status).toBe("listening");
  });

  it("a muted mic track drops to needs-gesture and unmute brings back listening", async () => {
    const { svc, track, hasTapListener } = setup();
    await svc.start();
    track.mute(true);
    expect(svc.getEngineState().status).toBe("needs-gesture");
    expect(hasTapListener()).toBe(true);
    track.mute(false);
    expect(svc.getEngineState().status).toBe("listening");
    expect(hasTapListener()).toBe(false);
  });

  it("start() on a muted mic re-acquires it; stop clears the mute watchers", async () => {
    const first = fakeStream();
    const getUserMedia = vi.fn(async () => fakeStream().stream).mockResolvedValueOnce(first.stream);
    const { svc, deps } = setup({ getUserMedia });
    await svc.start();
    first.track.mute(true);
    await svc.start();
    expect(deps.getUserMedia).toHaveBeenCalledTimes(2);
    expect(first.track.onmute).toBeNull();
    expect(first.track.onunmute).toBeNull();
    expect(svc.getEngineState().status).toBe("listening");
  });

  it("a tap after the mic ended restarts the session", async () => {
    const first = fakeStream();
    const getUserMedia = vi.fn(async () => fakeStream().stream).mockResolvedValueOnce(first.stream);
    const { svc, deps, tapPage } = setup({ getUserMedia });
    await svc.start();
    first.track.end();
    tapPage();
    await vi.waitFor(() => expect(svc.getEngineState().status).toBe("listening"));
    expect(deps.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("a tap and the Start button after the mic ended share one restart", async () => {
    const first = fakeStream();
    let grant: (s: MediaStream) => void = () => undefined;
    const getUserMedia = vi
      .fn(() => new Promise<MediaStream>((resolve) => (grant = resolve)))
      .mockResolvedValueOnce(first.stream);
    const { svc, deps, tapPage } = setup({ getUserMedia });
    await svc.start();
    first.track.end();
    // pointerdown reaches the page tap listener, then click runs the button.
    tapPage();
    const fromButton = svc.start();
    expect(deps.getUserMedia).toHaveBeenCalledTimes(2);
    // The old "Tap to start listening" copy must not stay up after the tap.
    expect(svc.getEngineState().status).toBe("loading-model");
    grant(fakeStream().stream);
    await fromButton;
    expect(svc.getEngineState().status).toBe("listening");
    expect(deps.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("returning to the page rechecks a context suspended without an event", async () => {
    const { svc, ctx, returnToPage } = setup();
    await svc.start();
    ctx.resumable = false;
    ctx.state = "suspended";
    returnToPage();
    await vi.waitFor(() => expect(svc.getEngineState().status).toBe("needs-gesture"));
    ctx.resumable = true;
    returnToPage();
    await vi.waitFor(() => expect(svc.getEngineState().status).toBe("listening"));
  });

  it("stop removes the lifecycle watchers", async () => {
    const { svc, ctx, track, returnToPage } = setup();
    await svc.start();
    await svc.stop();
    expect(ctx.onstatechange).toBeNull();
    expect(track.onended).toBeNull();
    returnToPage();
    expect(svc.getEngineState().status).toBe("off");
  });
});

describe("web voice service: fallbacks (never crash)", () => {
  it("mic permission denied → mic-blocked", async () => {
    const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    const { svc, seen } = setup({ getUserMedia: vi.fn(async () => Promise.reject(denied)) });
    await expect(svc.start()).resolves.toBeUndefined();
    expect(svc.getEngineState()).toEqual({ status: "mic-blocked", native: false });
    expect(await svc.getStatus()).toBe("error");
    expect(seen).toEqual([]);
  });

  it("no microphone → unavailable/no-mic", async () => {
    const none = Object.assign(new Error("none"), { name: "NotFoundError" });
    const { svc } = setup({ getUserMedia: vi.fn(async () => Promise.reject(none)) });
    await svc.start();
    expect(svc.getEngineState()).toEqual({
      status: "unavailable",
      reason: "no-mic",
      native: false,
    });
  });

  it("model 404 → unavailable/model-missing and releases the mic", async () => {
    const { svc, track, Model } = setup({ outcome: { error: "HTTP error! status: 404" } });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await svc.start();
    expect(svc.getEngineState()).toEqual({
      status: "unavailable",
      reason: "model-missing",
      native: false,
    });
    expect(track.stop).toHaveBeenCalled();
    expect(Model.meta.terminated).toBe(1);
  });

  it("SPA fallback (index.html with 200) → model-missing before loading the engine", async () => {
    const loadVosk = vi.fn(async () => fakeModelCtor("never"));
    const probeModel = vi.fn(async () => "missing" as const);
    const { svc, track } = setup({ loadVosk, probeModel });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await svc.start();
    expect(probeModel).toHaveBeenCalledWith("http://localhost/models/model.tar.gz");
    expect(loadVosk).not.toHaveBeenCalled();
    expect(svc.getEngineState()).toEqual({
      status: "unavailable",
      reason: "model-missing",
      native: false,
    });
    expect(track.stop).toHaveBeenCalled();
  });

  it("an unknown probe (offline) still tries the cached model", async () => {
    const { svc } = setup({ probeModel: async () => "unknown" });
    await svc.start();
    expect(svc.getEngineState().status).toBe("listening");
  });

  it("failed model load → engine-error, and a later start retries", async () => {
    let calls = 0;
    const okModel = fakeModelCtor("ok");
    const badModel = fakeModelCtor("fail");
    const { svc } = setup({
      loadVosk: async () => (++calls === 1 ? badModel : okModel),
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await svc.start();
    expect(svc.getEngineState()).toMatchObject({ status: "unavailable", reason: "engine-error" });
    await svc.start();
    expect(svc.getEngineState().status).toBe("listening");
  });

  it("vosk import failure → engine-error", async () => {
    const { svc } = setup({ loadVosk: () => Promise.reject(new Error("chunk load failed")) });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await svc.start();
    expect(svc.getEngineState()).toMatchObject({ status: "unavailable", reason: "engine-error" });
  });

  it("model load timeout → engine-error", async () => {
    const { svc } = setup({ outcome: "never", modelLoadTimeoutMs: 5 });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await svc.start();
    expect(svc.getEngineState()).toMatchObject({ status: "unavailable", reason: "engine-error" });
  });

  it("insecure context → unavailable without touching the mic or model", async () => {
    const loadVosk = vi.fn(async () => fakeModelCtor("ok"));
    const getUserMedia = vi.fn(async () => fakeStream().stream);
    const { svc } = setup({
      unsupportedReason: () => "insecure-context",
      loadVosk,
      getUserMedia,
    });
    await svc.start();
    expect(svc.getEngineState()).toEqual({
      status: "unavailable",
      reason: "insecure-context",
      native: false,
    });
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(loadVosk).not.toHaveBeenCalled();
  });

  it("jsdom defaults (no mediaDevices) degrade to unavailable", async () => {
    const svc = createWebListeningService();
    await expect(svc.start()).resolves.toBeUndefined();
    expect(svc.getEngineState().status).toBe("unavailable");
    await svc.stop();
  });
});

describe("model URL preflight", () => {
  const respond = (body: BodyInit | null, init: ResponseInit) =>
    vi.fn(async () => new Response(body, init)) as unknown as typeof fetch;
  const gzipHead = new Uint8Array([0x1f, 0x8b, 0x08, 0x00]);

  it("index.html served with 200 is missing", async () => {
    const f = respond("<!doctype html><html></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
    expect(await probeModelUrl("/m.tar.gz", f)).toBe("missing");
  });

  it("html bytes behind a wrong content type are missing", async () => {
    const f = respond("<!doctype html>", {
      status: 200,
      headers: { "content-type": "application/octet-stream" },
    });
    expect(await probeModelUrl("/m.tar.gz", f)).toBe("missing");
  });

  it("404 is missing", async () => {
    expect(await probeModelUrl("/m.tar.gz", respond(null, { status: 404 }))).toBe("missing");
  });

  it("gzip magic bytes (ranged 206) are ok and the request is ranged", async () => {
    const f = respond(gzipHead, { status: 206, headers: { "content-type": "application/gzip" } });
    expect(await probeModelUrl("/m.tar.gz", f)).toBe("ok");
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("range")).toBe("bytes=0-1");
  });

  it("network failure or server error is unknown, never missing", async () => {
    const offline = vi.fn(async () => Promise.reject(new TypeError("offline")));
    expect(await probeModelUrl("/m.tar.gz", offline as unknown as typeof fetch)).toBe("unknown");
    expect(await probeModelUrl("/m.tar.gz", respond(null, { status: 500 }))).toBe("unknown");
  });
});

describe("gesture events", () => {
  it("only uses events that grant user activation on touch screens", async () => {
    const { GESTURE_EVENTS } = await import("./webVoiceService");
    // A touch pointerdown carries no activation: resume() there fails on iOS.
    expect(GESTURE_EVENTS).not.toContain("pointerdown");
    expect(GESTURE_EVENTS).toEqual(expect.arrayContaining(["pointerup", "touchend", "keydown"]));
  });
});
