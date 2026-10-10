// Mock ListeningService: works in the browser for dev and demo.
// The native Android implementation (Phase 2) replaces this behind the
// selector in src/services/index.ts: foreground service + mic + Vosk keyword
// engine with a restricted grammar, emitting phraseDetected events to JS.
import type { ListeningService, ListeningStatus, PhraseDetection } from "./types";

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
