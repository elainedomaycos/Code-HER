// Pure helpers for the Vosk keyword trigger: phrase sanitizing, the
// restricted grammar, and confidence gating of final results. Shared logic
// kept free of browser APIs so it can be unit tested directly.
//
// Parity with android/.../VoskKeywordDetector.java:
// - phrase is lowercased and reduced to [a-z ] (the grammar must match the
//   model vocabulary), empty falls back to "help me"
// - only FINAL results can fire; partials are unstable and caused
//   noise-triggered SOS on device (2026-10-09)
// - a final fires only when its word-level confidence reaches
//   MIN_FINAL_CONFIDENCE; a grammar-mode final with text but no word array
//   is credited CONFIDENCE_FINAL_TEXT

export const DEFAULT_PHRASE = "help me";

/**
 * Fire threshold for finals. Keep in sync with TRIGGER_CONFIDENCE in
 * src/components/codeher/store.tsx and MIN_FINAL_CONFIDENCE in
 * VoskKeywordDetector.java.
 */
export const MIN_FINAL_CONFIDENCE = 0.9;

/** Confidence credited to a word-boundary text match when no word array is present. */
export const CONFIDENCE_FINAL_TEXT = 0.95;

/** Vosk filler token: anything that is not the phrase decodes to this. */
export const UNK_TOKEN = "[unk]";

export interface VoskWord {
  word: string;
  conf: number;
}

export interface VoskFinal {
  text: string;
  words: VoskWord[];
}

export function sanitizePhrase(phrase: string | null | undefined): string {
  const clean = (phrase ?? "")
    .toLowerCase()
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean === "" ? DEFAULT_PHRASE : clean;
}

/** Most words a custom phrase may have. Longer phrases rarely decode cleanly. */
export const PHRASE_MAX_WORDS = 3;

export type PhraseProblem = "empty" | "not-letters" | "too-many-words";
export type PhraseCheck = { ok: true; phrase: string } | { ok: false; problem: PhraseProblem };

/**
 * Validation for a phrase the user types. Stricter than sanitizePhrase on
 * purpose: input that sanitizing would change ("911", "tulong po!") is
 * rejected instead of silently becoming something else. On success the
 * phrase is already normalized, so sanitizePhrase(phrase) === phrase.
 */
export function validatePhrase(input: string): PhraseCheck {
  const phrase = input.toLowerCase().replace(/\s+/g, " ").trim();
  if (phrase === "") return { ok: false, problem: "empty" };
  if (!/^[a-z ]+$/.test(phrase)) return { ok: false, problem: "not-letters" };
  if (phrase.split(" ").length > PHRASE_MAX_WORDS) return { ok: false, problem: "too-many-words" };
  return { ok: true, phrase };
}

/**
 * Restricted grammar JSON for KaldiRecognizer: the phrase plus the [unk]
 * filler, so other speech and noise decode to [unk] instead of being forced
 * onto the phrase.
 */
export function buildGrammar(phrase: string): string {
  return JSON.stringify([sanitizePhrase(phrase), UNK_TOKEN]);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Extracts a final result from a vosk-browser "result" message
 * ({ event, result: { text, result: [{ word, conf }] } }). Returns null for
 * anything else (partials, errors, malformed payloads).
 */
export function parseFinalMessage(message: unknown): VoskFinal | null {
  if (!isRecord(message) || message["event"] !== "result") return null;
  const body = message["result"];
  if (!isRecord(body)) return null;
  const text = typeof body["text"] === "string" ? body["text"] : "";
  const raw = Array.isArray(body["result"]) ? (body["result"] as unknown[]) : [];
  const words: VoskWord[] = raw.flatMap((w) =>
    isRecord(w) && typeof w["word"] === "string" && typeof w["conf"] === "number"
      ? [{ word: w["word"].toLowerCase(), conf: w["conf"] }]
      : [],
  );
  return { text, words };
}

function containsPhrase(text: string, target: string): boolean {
  return ` ${text.toLowerCase().trim()} `.includes(` ${target} `);
}

/**
 * Best confidence that the final contains the phrase, or 0 when absent.
 * Multi-word phrases must appear as consecutive words; their confidence is
 * the weakest word in the run. When the word array is present it is
 * authoritative (a low-confidence run stays low); the text fallback applies
 * only when the engine returned no words.
 */
export function scoreFinal(final: VoskFinal, phrase: string): number {
  const target = sanitizePhrase(phrase);
  const targetWords = target.split(" ");
  const { words } = final;
  if (words.length > 0) {
    let best = 0;
    for (let i = 0; i + targetWords.length <= words.length; i++) {
      const run = words.slice(i, i + targetWords.length);
      if (run.every((w, j) => w.word === targetWords[j])) {
        best = Math.max(best, Math.min(...run.map((w) => w.conf)));
      }
    }
    return best;
  }
  return containsPhrase(final.text, target) ? CONFIDENCE_FINAL_TEXT : 0;
}

/** Final-result gate: returns the confidence to emit, or null when it must not fire. */
export function gateFinal(message: unknown, phrase: string): number | null {
  const final = parseFinalMessage(message);
  if (!final) return null;
  const conf = scoreFinal(final, phrase);
  return conf >= MIN_FINAL_CONFIDENCE ? conf : null;
}
