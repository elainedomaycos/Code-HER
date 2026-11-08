// Mock ListeningService: in-memory stand-in for unit tests (the browser app
// uses the real Vosk WASM engine in ./webVoiceService.ts).
// The native Android implementation (Phase 2) replaces this behind the
// selector in src/services/index.ts: foreground service + mic + Vosk keyword
// engine with a restricted grammar, emitting phraseDetected events to JS.
import type { ListeningService, ListeningStatus, PhraseDetection, VoiceEngineState } from "./types";

type Cb = (e: PhraseDetection) => void;

const listeners = new Set<Cb>();
let status: ListeningStatus = "stopped";
let phrase = "help me";

export const mockListeningService: ListeningService = {
  async start(): Promise<void> {
    status = "listening";
  },
  async stop(): Promise<void> {
    status = "stopped";
  },
  async getStatus(): Promise<ListeningStatus> {
    return status;
  },
  async setPhrase(p: string): Promise<void> {
    phrase = p;
  },
  onPhraseDetected(cb: Cb): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

/** Mock-only debug hook (codeHER.md §4 "Simulate phrase"). No-op unless listening. */
export function emitMockDetection(): void {
  if (status !== "listening") return;
  const event: PhraseDetection = { phrase, confidence: 1, at: Date.now() };
  listeners.forEach((l) => l(event));
}

/**
 * True when a native start() rejection means the user denied the mic.
 * HerNativePlugin rejects with "Microphone permission denied"; web style
 * errors (NotAllowedError) are matched too.
 */
export function isPermissionDenied(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const name = "name" in e ? String(e.name) : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return true;
  const text = [
    "message" in e ? String(e.message) : "",
    "code" in e ? String(e.code) : "",
    "errorMessage" in e ? String(e.errorMessage) : "",
  ].join(" ");
  return /permission|denied|not allowed/i.test(text);
}

/**
 * Coarse engine state for a ListeningService that reports none itself (the
 * native Android engine): start resolved → listening, permission denied →
 * mic-blocked, other rejections → unavailable, stop → off. Returns a
 * wrapped service plus the state API.
 */
export function withCoarseEngineState(inner: ListeningService): {
  service: ListeningService;
  getEngineState: () => VoiceEngineState;
  onEngineStateChange: (cb: (s: VoiceEngineState) => void) => () => void;
} {
  let state: VoiceEngineState = { status: "off", native: true };
  const subs = new Set<(s: VoiceEngineState) => void>();
  const set = (next: VoiceEngineState) => {
    state = next;
    subs.forEach((s) => s(state));
  };
  const service: ListeningService = {
    ...inner,
    async start(): Promise<void> {
      try {
        await inner.start();
        set({ status: "listening", native: true });
      } catch (e: unknown) {
        set(
          isPermissionDenied(e)
            ? { status: "mic-blocked", native: true }
            : { status: "unavailable", reason: "engine-error", native: true },
        );
        throw e;
      }
    },
    async stop(): Promise<void> {
      await inner.stop();
      set({ status: "off", native: true });
    },
  };
  return {
    service,
    getEngineState: () => state,
    onEngineStateChange: (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };
}
