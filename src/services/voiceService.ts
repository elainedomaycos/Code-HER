// Mock voice layer. A native Android implementation can replace these functions.
type Cb = (phrase: string) => void;
let listeners: Cb[] = [];
let listening = false;

export async function startListening(): Promise<void> { listening = true; }
export async function stopListening(): Promise<void> { listening = false; }
export function isListening() { return listening; }

export function onPhraseDetected(cb: Cb): () => void {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

/** Dev/demo: fire a detection event. */
export function simulateDetection(phrase: string) {
  if (!listening) return;
  listeners.forEach((l) => l(phrase));
}
