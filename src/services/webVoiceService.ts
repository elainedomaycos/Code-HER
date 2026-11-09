// Browser ListeningService: real offline keyword trigger with Vosk WASM
// (vosk-browser, the same Kaldi/Vosk engine the Android build uses).
//
// Privacy: the model is served from this app's own origin
// (public/models/, fetched by `bun run fetch:model`) and cached by the
// engine in IndexedDB. Audio frames go mic → AudioContext → the Vosk Web
// Worker in memory; nothing is recorded, stored, or sent anywhere.
//
// Degrades instead of crashing: no mic, permission denied, missing model,
// insecure context, or SSR all leave the service "started" with a clear
// engine state, so test mode and manual SOS still work.
//
// Stays honest after it goes live: an AudioContext the OS suspends or
// interrupts (call, screen lock, switching to Messages) or a mic track that
// ends drops the state back to "needs-gesture", and the next tap or start()
// resumes or re-acquires the mic. It never keeps saying "listening" while
// no audio reaches the recognizer.
import type {
  ListeningService,
  ListeningStatus,
  PhraseDetection,
  VoiceEngineState,
  VoiceUnavailableReason,
} from "./types";
import { buildGrammar, gateFinal, sanitizePhrase } from "./voskGrammar";

export const VOSK_MODEL_FILE = "vosk-model-small-en-us-0.15.tar.gz";

/** First load copies ~41 MB into IndexedDB and unpacks it; later loads hit the cache. */
const MODEL_LOAD_TIMEOUT_MS = 180_000;
/** Without a user gesture resume() can stay pending forever; stop waiting after this. */
const RESUME_TIMEOUT_MS = 1_500;
/** The model preflight is a tiny ranged request; never let it block start for long. */
const MODEL_PROBE_TIMEOUT_MS = 8_000;
const GZIP_MAGIC = [0x1f, 0x8b] as const;
const HTML_START = 0x3c; // "<"
const PROCESSOR_BUFFER_SIZE = 4096;

// ---- Minimal structural view of vosk-browser (keeps mocks simple) --------
export interface VoskRecognizerLike {
  on(event: "result" | "partialresult" | "error", listener: (message: unknown) => void): void;
  setWords(words: boolean): void;
  acceptWaveform(buffer: AudioBuffer): void;
  remove(): void;
}
export interface VoskModelLike {
  on(event: "load" | "error", listener: (message: unknown) => void): void;
  readonly KaldiRecognizer: new (sampleRate: number, grammar?: string) => VoskRecognizerLike;
  terminate(): void;
}
export type VoskModelCtor = new (modelUrl: string, logLevel?: number) => VoskModelLike;

export interface WebVoiceDeps {
  /** Loads the vosk-browser Model constructor (dynamic import, client only). */
  loadVosk: () => Promise<VoskModelCtor>;
  /** Absolute same-origin model URL. */
  modelUrl: () => string;
  getUserMedia: (c: MediaStreamConstraints) => Promise<MediaStream>;
  createAudioContext: () => AudioContext;
  /** Environment check; returns the reason the engine cannot run, or null. */
  unsupportedReason: () => VoiceUnavailableReason | null;
  /** Registers a one-shot "user tapped" callback; returns an unsubscribe. */
  onUserGesture: (cb: () => void) => () => void;
  /** Registers a "page became visible again" callback; returns an unsubscribe. */
  onVisible: (cb: () => void) => () => void;
  /** Checks the model URL serves the archive, not an SPA index.html fallback. */
  probeModel: (url: string) => Promise<ModelProbe>;
  modelLoadTimeoutMs: number;
  resumeTimeoutMs: number;
}

/** "missing" only when the server clearly does not have the archive. */
export type ModelProbe = "ok" | "missing" | "unknown";

export interface WebListeningService extends ListeningService {
  getEngineState(): VoiceEngineState;
  onEngineStateChange(cb: (s: VoiceEngineState) => void): () => void;
}

// ---- Default browser dependencies ----------------------------------------
async function loadVoskModule(): Promise<VoskModelCtor> {
  // Client only: vosk-browser touches Worker/Blob at import time.
  if (typeof window === "undefined") throw new Error("vosk-browser is client only");
  const mod: unknown = await import("vosk-browser");
  const pick = (m: unknown): VoskModelCtor | null =>
    typeof m === "object" && m !== null && "Model" in m && typeof m.Model === "function"
      ? (m.Model as VoskModelCtor) // structural subset of vosk-browser's Model
      : null;
  const ctor =
    pick(mod) ??
    (typeof mod === "object" && mod !== null && "default" in mod ? pick(mod.default) : null);
  if (!ctor) throw new Error("vosk-browser: Model export not found");
  return ctor;
}

function browserUnsupportedReason(): VoiceUnavailableReason | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return "unsupported";
  if (window.isSecureContext === false) return "insecure-context";
  if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
    return "unsupported";
  }
  if (typeof AudioContext === "undefined" || typeof Worker === "undefined") return "unsupported";
  if (typeof WebAssembly === "undefined") return "unsupported";
  return null;
}

// Events that carry user activation (HTML spec): a touch pointerdown does
// not, so resuming audio there fails on iOS and eats the tap. pointerup is
// activating for touch and pen, and a mouse press already activated on
// mousedown, so pointerup works for every pointer type.
export const GESTURE_EVENTS = ["pointerup", "keydown", "touchend"] as const;

function browserOnUserGesture(cb: () => void): () => void {
  const handler = () => {
    off();
    cb();
  };
  const off = () => GESTURE_EVENTS.forEach((e) => document.removeEventListener(e, handler, true));
  GESTURE_EVENTS.forEach((e) => document.addEventListener(e, handler, true));
  return off;
}

function browserOnVisible(cb: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  const handler = () => {
    if (document.visibilityState === "visible") cb();
  };
  document.addEventListener("visibilitychange", handler);
  window.addEventListener("pageshow", handler);
  return () => {
    document.removeEventListener("visibilitychange", handler);
    window.removeEventListener("pageshow", handler);
  };
}

async function firstBytes(res: Response, count: number): Promise<Uint8Array | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  try {
    const { value } = await reader.read();
    return value ? value.subarray(0, count) : null;
  } finally {
    // The server may ignore Range; never download the whole archive here.
    reader.cancel().catch(() => undefined);
  }
}

/**
 * Preflight for the model archive. A dev server or static host with an SPA
 * fallback answers a missing file with index.html and status 200, which the
 * engine would only report as an opaque unpack error. Unknown (offline,
 * odd server) never blocks: the engine then tries the cached model itself.
 */
export async function probeModelUrl(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = MODEL_PROBE_TIMEOUT_MS,
): Promise<ModelProbe> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { Range: "bytes=0-1" },
      cache: "no-store",
      signal: abort.signal,
    });
    if (res.status === 404 || res.status === 410) return "missing";
    if (!res.ok) return "unknown";
    if ((res.headers.get("content-type") ?? "").toLowerCase().includes("text/html")) {
      return "missing";
    }
    const head = await firstBytes(res, GZIP_MAGIC.length);
    if (!head || head.length === 0) return "unknown";
    if (head[0] === GZIP_MAGIC[0] && head[1] === GZIP_MAGIC[1]) return "ok";
    return head[0] === HTML_START ? "missing" : "unknown";
  } catch {
    return "unknown";
  } finally {
    clearTimeout(timer);
  }
}

const defaultDeps: WebVoiceDeps = {
  loadVosk: loadVoskModule,
  modelUrl: () =>
    new URL(`${import.meta.env.BASE_URL}models/${VOSK_MODEL_FILE}`, window.location.href).href,
  getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
  createAudioContext: () => new AudioContext(),
  unsupportedReason: browserUnsupportedReason,
  onUserGesture: browserOnUserGesture,
  onVisible: browserOnVisible,
  probeModel: (url) => probeModelUrl(url),
  modelLoadTimeoutMs: MODEL_LOAD_TIMEOUT_MS,
  resumeTimeoutMs: RESUME_TIMEOUT_MS,
};

// ---- Service ---------------------------------------------------------------
interface Session {
  id: number;
  stream: MediaStream | null;
  ctx: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  processor: ScriptProcessorNode | null;
  recognizer: VoskRecognizerLike | null;
  offGesture: (() => void) | null;
  offVisible: (() => void) | null;
}

class SessionAborted extends Error {}
class ModelMissing extends Error {}

/**
 * True when the session can no longer hear: mic track ended or muted (the
 * OS or another app took the mic, so only silence arrives), or the context
 * closed. An unmute event rechecks, so a short mute heals by itself.
 */
function isDead(s: Session): boolean {
  if (!s.ctx || s.ctx.state === "closed" || !s.stream) return true;
  return s.stream.getTracks().some((t) => t.readyState === "ended" || t.muted === true);
}

/** resume() that gives up after timeoutMs instead of hanging without a gesture. */
async function resumeWithin(ctx: AudioContext, timeoutMs: number): Promise<void> {
  if (ctx.state === "running") return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    ctx.resume().catch(() => undefined),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
}

function micErrorStatus(e: unknown): VoiceEngineState {
  const name = e instanceof Error || e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return { status: "mic-blocked", native: false };
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") {
    return { status: "unavailable", reason: "no-mic", native: false };
  }
  return { status: "unavailable", reason: "engine-error", native: false };
}

function modelErrorReason(e: unknown): VoiceUnavailableReason {
  if (e instanceof ModelMissing) return "model-missing";
  return /\b404\b|not found/i.test(errorText(e)) ? "model-missing" : "engine-error";
}

function errorText(message: unknown): string {
  if (typeof message === "object" && message !== null && "error" in message) {
    return String(message.error);
  }
  return message instanceof Error ? message.message : String(message ?? "");
}

const LISTENING_STATUS: Record<VoiceEngineState["status"], ListeningStatus> = {
  off: "stopped",
  "loading-model": "starting",
  "needs-gesture": "starting",
  listening: "listening",
  "mic-blocked": "error",
  unavailable: "error",
};

export function createWebListeningService(
  overrides: Partial<WebVoiceDeps> = {},
): WebListeningService {
  const deps: WebVoiceDeps = { ...defaultDeps, ...overrides };
  const listeners = new Set<(e: PhraseDetection) => void>();
  const stateListeners = new Set<(s: VoiceEngineState) => void>();
  let state: VoiceEngineState = { status: "off", native: false };
  let phrase = sanitizePhrase(null);
  let session: Session | null = null;
  let nextId = 1;
  let modelPromise: Promise<VoskModelLike> | null = null;

  const setState = (next: VoiceEngineState) => {
    state = next;
    stateListeners.forEach((l) => l(state));
  };

  const emit = (confidence: number) => {
    const event: PhraseDetection = { phrase, confidence, at: Date.now() };
    listeners.forEach((l) => l(event));
  };

  const loadModel = (): Promise<VoskModelLike> => {
    if (modelPromise) return modelPromise;
    const attempt = (async () => {
      const url = deps.modelUrl();
      if ((await deps.probeModel(url)) === "missing") {
        throw new ModelMissing(`model not served at ${url}`);
      }
      const Model = await deps.loadVosk();
      const model = new Model(url, -1);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("model load timed out")),
          deps.modelLoadTimeoutMs,
        );
        model.on("load", (m) => {
          clearTimeout(timer);
          const ok = typeof m === "object" && m !== null && "result" in m && m.result === true;
          if (ok) resolve();
          else reject(new Error("model load failed"));
        });
        model.on("error", (m) => {
          clearTimeout(timer);
          reject(new Error(errorText(m)));
        });
      }).catch((e: unknown) => {
        model.terminate();
        throw e;
      });
      return model;
    })();
    modelPromise = attempt;
    // A failed load must not poison later attempts (e.g. model fetched after boot).
    attempt.catch(() => {
      if (modelPromise === attempt) modelPromise = null;
    });
    return attempt;
  };

  const release = (s: Session) => {
    s.offGesture?.();
    s.offVisible?.();
    if (s.ctx) s.ctx.onstatechange = null;
    s.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.onmute = null;
      t.onunmute = null;
    });
    if (s.processor) s.processor.onaudioprocess = null;
    try {
      s.source?.disconnect();
      s.processor?.disconnect();
    } catch {
      // Nodes already disconnected.
    }
    s.stream?.getTracks().forEach((t) => t.stop());
    s.ctx?.close().catch(() => undefined);
    try {
      s.recognizer?.remove();
    } catch {
      // Recognizer already removed with its model.
    }
    s.stream = null;
    s.ctx = null;
    s.source = null;
    s.processor = null;
    s.recognizer = null;
    s.offGesture = null;
    s.offVisible = null;
  };

  const buildRecognizer = (model: VoskModelLike, sampleRate: number): VoskRecognizerLike => {
    const recognizer = new model.KaldiRecognizer(sampleRate, buildGrammar(phrase));
    recognizer.setWords(true);
    // Finals only: partials are never fired (parity with Android).
    recognizer.on("result", (message) => {
      const conf = gateFinal(message, phrase);
      if (conf !== null) emit(conf);
    });
    recognizer.on("error", (message) => console.error("voice engine:", errorText(message)));
    return recognizer;
  };

  /** Waits for one tap, then runs onTap (only if s is still the session). */
  const awaitGesture = (s: Session, onTap: () => void) => {
    s.offGesture?.();
    s.offGesture = deps.onUserGesture(() => {
      s.offGesture = null;
      if (session === s) onTap();
    });
  };

  /**
   * Single source of truth for "can the phrase trigger right now". A dead
   * session (mic ended, context closed) needs a full restart; a suspended
   * or interrupted context needs a resume, which a tap allows.
   */
  const markLive = (s: Session) => {
    if (session !== s || !s.ctx) return;
    if (isDead(s)) {
      if (state.status !== "needs-gesture") setState({ status: "needs-gesture", native: false });
      awaitGesture(s, () => {
        service.start().catch((e: unknown) => console.error("voice engine restart:", e));
      });
      return;
    }
    const ctx = s.ctx;
    if (ctx.state === "running") {
      s.offGesture?.();
      s.offGesture = null;
      if (state.status !== "listening") setState({ status: "listening", native: false });
      return;
    }
    if (state.status !== "needs-gesture") setState({ status: "needs-gesture", native: false });
    awaitGesture(s, () => {
      resumeWithin(ctx, deps.resumeTimeoutMs)
        .then(() => markLive(s))
        .catch((e: unknown) => console.error("voice engine resume:", e));
    });
  };

  /** Keeps the state honest once live: OS suspends, interruptions, mic loss, page return. */
  const watch = (s: Session, ctx: AudioContext, stream: MediaStream) => {
    const recheck = () => {
      if (session === s) markLive(s);
    };
    ctx.onstatechange = recheck;
    stream.getTracks().forEach((t) => {
      t.onended = recheck;
      t.onmute = recheck;
      t.onunmute = recheck;
    });
    s.offVisible = deps.onVisible(() => {
      if (session !== s || !s.ctx) return;
      if (isDead(s)) {
        markLive(s);
        return;
      }
      // Some browsers allow resume on return without a tap; try, then report.
      resumeWithin(s.ctx, deps.resumeTimeoutMs)
        .then(() => markLive(s))
        .catch((e: unknown) => console.error("voice engine resume:", e));
    });
  };

  const run = async (s: Session) => {
    const alive = () => {
      if (session !== s) throw new SessionAborted();
    };
    const unsupported = deps.unsupportedReason();
    if (unsupported) {
      setState({ status: "unavailable", reason: unsupported, native: false });
      return;
    }
    let stream: MediaStream;
    try {
      stream = await deps.getUserMedia({
        video: false,
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (e: unknown) {
      alive();
      setState(micErrorStatus(e));
      return;
    }
    s.stream = stream;
    alive();
    setState({ status: "loading-model", native: false });
    let model: VoskModelLike;
    try {
      model = await loadModel();
    } catch (e: unknown) {
      alive();
      console.error("voice engine model:", errorText(e));
      release(s);
      setState({ status: "unavailable", reason: modelErrorReason(e), native: false });
      return;
    }
    alive();
    const ctx = deps.createAudioContext();
    s.ctx = ctx;
    s.recognizer = buildRecognizer(model, ctx.sampleRate);
    s.source = ctx.createMediaStreamSource(stream);
    s.processor = ctx.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
    s.processor.onaudioprocess = (ev) => {
      try {
        s.recognizer?.acceptWaveform(ev.inputBuffer);
      } catch (err: unknown) {
        console.error("voice engine acceptWaveform:", err);
      }
    };
    s.source.connect(s.processor);
    // ScriptProcessor only runs when connected; its output buffer is silent.
    s.processor.connect(ctx.destination);
    watch(s, ctx, stream);
    // A suspended context reports needs-gesture with a tap listener right
    // away. resume() is only tried in the background: without a gesture it
    // can stay pending forever, and onstatechange reports it if it works.
    markLive(s);
    if (ctx.state !== "running") {
      resumeWithin(ctx, deps.resumeTimeoutMs)
        .then(() => markLive(s))
        .catch((e: unknown) => console.error("voice engine resume:", e));
    }
  };

  /** One start at a time: a page tap and the Start button often both call it. */
  let starting: Promise<void> | null = null;

  const startOnce = async (): Promise<void> => {
    const prev = session;
    if (prev) {
      const live = state.status === "listening" || state.status === "needs-gesture";
      if (live && prev.ctx && !isDead(prev)) {
        // Called again (often from a tap): resume a suspended or
        // interrupted context instead of trusting a stale "listening".
        await resumeWithin(prev.ctx, deps.resumeTimeoutMs);
        markLive(prev);
        return;
      }
      // Still starting up: let the running attempt finish.
      if (!live && state.status !== "mic-blocked" && state.status !== "unavailable") return;
      // Retry after a failure (permission changed, model fetched since) or
      // restart a dead session (mic track ended, context closed).
      session = null;
      release(prev);
      // A dead session said "Tap to start"; after the tap it is starting again.
      if (live) setState({ status: "loading-model", native: false });
    }
    const s: Session = {
      id: nextId++,
      stream: null,
      ctx: null,
      source: null,
      processor: null,
      recognizer: null,
      offGesture: null,
      offVisible: null,
    };
    session = s;
    try {
      await run(s);
    } catch (e: unknown) {
      if (e instanceof SessionAborted) {
        release(s);
        return;
      }
      console.error("voice engine start:", e);
      release(s);
      if (session === s) setState({ status: "unavailable", reason: "engine-error", native: false });
    }
  };

  const service: WebListeningService = {
    start(): Promise<void> {
      if (starting) return starting;
      const attempt = startOnce().finally(() => {
        if (starting === attempt) starting = null;
      });
      starting = attempt;
      return attempt;
    },

    async stop(): Promise<void> {
      starting = null;
      const s = session;
      session = null;
      if (s) release(s);
      setState({ status: "off", native: false });
    },

    async getStatus(): Promise<ListeningStatus> {
      return LISTENING_STATUS[state.status];
    },

    async setPhrase(p: string): Promise<void> {
      const next = sanitizePhrase(p);
      if (next === phrase) return;
      phrase = next;
      // Rebuild the grammar on a live recognizer; the model stays loaded.
      const s = session;
      if (!s?.recognizer || !s.ctx || !modelPromise) return;
      const model = await modelPromise;
      if (session !== s || !s.ctx) return;
      const old = s.recognizer;
      s.recognizer = buildRecognizer(model, s.ctx.sampleRate);
      try {
        old.remove();
      } catch {
        // Already removed.
      }
    },

    onPhraseDetected(cb: (e: PhraseDetection) => void): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    getEngineState(): VoiceEngineState {
      return state;
    },

    onEngineStateChange(cb: (s: VoiceEngineState) => void): () => void {
      stateListeners.add(cb);
      return () => {
        stateListeners.delete(cb);
      };
    },
  };
  return service;
}

/** App-wide browser instance used by the selector in ./index.ts. */
export const webListeningService = createWebListeningService();
