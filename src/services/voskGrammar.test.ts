import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_FINAL_TEXT,
  MIN_FINAL_CONFIDENCE,
  buildGrammar,
  gateFinal,
  parseFinalMessage,
  sanitizePhrase,
  scoreFinal,
  validatePhrase,
} from "./voskGrammar";

const final = (text: string, words: Array<[string, number]>) => ({
  event: "result",
  recognizerId: "r1",
  result: { text, result: words.map(([word, conf]) => ({ word, conf, start: 0, end: 1 })) },
});

describe("sanitizePhrase (parity with VoskKeywordDetector.sanitize)", () => {
  it("lowercases and strips everything but letters and spaces", () => {
    expect(sanitizePhrase("  Help ME!! ")).toBe("help me");
    expect(sanitizePhrase("red-apple 42")).toBe("redapple");
    expect(sanitizePhrase("call   mom")).toBe("call mom");
  });

  it("falls back to the default phrase when nothing usable remains", () => {
    expect(sanitizePhrase("")).toBe("help me");
    expect(sanitizePhrase("123 !?")).toBe("help me");
    expect(sanitizePhrase(null)).toBe("help me");
  });
});

describe("buildGrammar", () => {
  it("restricts the recognizer to the phrase plus the [unk] filler", () => {
    expect(JSON.parse(buildGrammar("Help me"))).toEqual(["help me", "[unk]"]);
  });

  it("produces valid JSON for any input (no injection into the grammar)", () => {
    expect(JSON.parse(buildGrammar('a"],["b'))).toEqual(["ab", "[unk]"]);
  });
});

describe("final result gating", () => {
  it("fires on a confident consecutive match, scored by the weakest word", () => {
    const msg = final("help me", [
      ["help", 0.99],
      ["me", 0.93],
    ]);
    expect(gateFinal(msg, "help me")).toBe(0.93);
  });

  it("does not fire below the threshold", () => {
    const msg = final("help me", [
      ["help", 0.99],
      ["me", 0.6],
    ]);
    expect(scoreFinal(parseFinalMessage(msg)!, "help me")).toBe(0.6);
    expect(gateFinal(msg, "help me")).toBeNull();
  });

  it("fires exactly at the threshold", () => {
    const msg = final("help", [["help", MIN_FINAL_CONFIDENCE]]);
    expect(gateFinal(msg, "help")).toBe(MIN_FINAL_CONFIDENCE);
  });

  it("requires the phrase words in order and adjacent", () => {
    expect(
      gateFinal(
        final("me help", [
          ["me", 1],
          ["help", 1],
        ]),
        "help me",
      ),
    ).toBeNull();
    expect(
      gateFinal(
        final("help [unk] me", [
          ["help", 1],
          ["[unk]", 1],
          ["me", 1],
        ]),
        "help me",
      ),
    ).toBeNull();
  });

  it("ignores filler-only and empty finals", () => {
    expect(gateFinal(final("[unk]", [["[unk]", 1]]), "help me")).toBeNull();
    expect(gateFinal(final("", []), "help me")).toBeNull();
  });

  it("credits a text match when the engine returns no word array", () => {
    const msg = { event: "result", result: { text: "help me" } };
    expect(gateFinal(msg, "help me")).toBe(CONFIDENCE_FINAL_TEXT);
    expect(gateFinal({ event: "result", result: { text: "helpme" } }, "help me")).toBeNull();
  });

  it("does not fall back to text when words are present but weak", () => {
    const msg = final("help me", [
      ["help", 0.5],
      ["me", 0.5],
    ]);
    expect(gateFinal(msg, "help me")).toBeNull();
  });

  it("never fires on partials, errors, or malformed messages", () => {
    expect(
      gateFinal({ event: "partialresult", result: { partial: "help me" } }, "help me"),
    ).toBeNull();
    expect(gateFinal({ event: "error", error: "x" }, "help me")).toBeNull();
    expect(gateFinal(null, "help me")).toBeNull();
    expect(gateFinal({ event: "result", result: "help me" }, "help me")).toBeNull();
  });
});

describe("validatePhrase (what the phrase field accepts)", () => {
  it("accepts one to three words of letters and normalizes them", () => {
    expect(validatePhrase("  Red   UMBRELLA ")).toEqual({ ok: true, phrase: "red umbrella" });
    expect(validatePhrase("help")).toEqual({ ok: true, phrase: "help" });
    expect(validatePhrase("please help me")).toEqual({ ok: true, phrase: "please help me" });
  });

  it("rejects input that sanitizing would silently change", () => {
    expect(validatePhrase("911")).toEqual({ ok: false, problem: "not-letters" });
    expect(validatePhrase("tulong po!")).toEqual({ ok: false, problem: "not-letters" });
    expect(validatePhrase("red-apple")).toEqual({ ok: false, problem: "not-letters" });
  });

  it("rejects empty and long phrases", () => {
    expect(validatePhrase("   ")).toEqual({ ok: false, problem: "empty" });
    expect(validatePhrase("one two three four")).toEqual({ ok: false, problem: "too-many-words" });
  });

  it("a valid phrase is exactly what the engine listens for", () => {
    const check = validatePhrase(" Code  Red ");
    expect(check.ok && sanitizePhrase(check.phrase)).toBe("code red");
  });
});
