import { describe, it, expect, vi } from "vitest";
import { buildMessage, SHOW_ACCURACY_BEYOND_M } from "./messageBuilder";
import type { LocationFix } from "./types";

const AT = new Date("2026-10-09T18:11:00").getTime();
const TIME = new Date(AT).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const FIX: LocationFix = {
  lat: 13.7565,
  lng: 121.0583,
  accuracyM: 18,
  at: AT,
  source: "gps",
};
const LAST_KNOWN: LocationFix = { ...FIX, source: "last_known" };
const COARSE: LocationFix = { ...FIX, accuracyM: 800 };
const COARSE_LAST_KNOWN: LocationFix = { ...FIX, accuracyM: 800, source: "last_known" };
const GSM_SAFE = /^[\x20-\x7E]*$/;

describe("emergency SMS template (codeHER.md §5)", () => {
  it("reads as plain words for a fresh, precise fix", () => {
    expect(buildMessage("Kassandra", FIX)).toBe(
      `EMERGENCY: Kassandra may need help. Location: 13.75650,121.05830 at ${TIME}. Sent by Code:HER.`,
    );
  });

  it("has no jargon: no tilde, no 0m, no bare meters", () => {
    for (const loc of [FIX, LAST_KNOWN, COARSE, { ...FIX, accuracyM: 0 }]) {
      const msg = buildMessage("Kassandra", loc);
      expect(msg).not.toContain("~");
      expect(msg).not.toMatch(/\d+m\b/);
    }
  });

  it("fits a single SMS segment for a fresh fix", () => {
    expect(buildMessage("Kassandra", FIX).length).toBeLessThanOrEqual(160);
  });

  it("always includes raw coordinates as text plus the maps link", () => {
    const msg = buildMessage("Kassandra", FIX, { includeMapLink: true });
    expect(msg).toContain("13.75650,121.05830");
    expect(msg).toContain("https://maps.google.com/?q=13.75650,121.05830");
  });

  it("omits the link by default (carriers filter URL-bearing SMS)", () => {
    const msg = buildMessage("Kassandra", FIX);
    expect(msg).toContain("13.75650,121.05830");
    expect(msg).not.toContain("http");
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it("labels last-known locations and still fits one segment", () => {
    const msg = buildMessage("Kassandra", LAST_KNOWN);
    expect(msg).toContain(`Last known location: 13.75650,121.05830 at ${TIME}.`);
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it("sends without location instead of blocking when no fix exists", () => {
    const msg = buildMessage("Kassandra", null);
    expect(msg).toBe("EMERGENCY: Kassandra may need help. Location unavailable. Sent by Code:HER.");
  });

  it("adds accuracy only when it is worse than 50 m, in plain words", () => {
    expect(buildMessage("Kassandra", { ...FIX, accuracyM: SHOW_ACCURACY_BEYOND_M })).not.toContain(
      "within",
    );
    expect(buildMessage("Kassandra", { ...FIX, accuracyM: 123 })).toContain(
      `at ${TIME}, within about 120 m.`,
    );
  });

  it("rounds coarse fixes and says how far off they may be", () => {
    const msg = buildMessage("Kassandra", COARSE, { includeMapLink: true });
    expect(msg).toContain(`Location: 13.757,121.058 at ${TIME}, within about 800 m.`);
    expect(msg).toContain("https://maps.google.com/?q=13.75650,121.05830");
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it("keeps exact coordinates at the 100 m boundary", () => {
    expect(buildMessage("Kassandra", { ...FIX, accuracyM: 100 })).toContain("13.75650,121.05830");
    expect(buildMessage("Kassandra", { ...FIX, accuracyM: 101 })).toContain("13.757,121.058");
  });

  it("composes last-known and coarse labels", () => {
    const msg = buildMessage("Kassandra", COARSE_LAST_KNOWN, { includeMapLink: true });
    expect(msg).toContain("Last known location: 13.757,121.058");
    expect(msg).toContain("within about 800 m");
    expect(msg).toContain("https://maps.google.com/?q=13.75650,121.05830");
  });

  it("default profile stays within one segment for every variant", () => {
    for (const loc of [FIX, LAST_KNOWN, COARSE, COARSE_LAST_KNOWN, null]) {
      expect(buildMessage("Kassandra", loc).length).toBeLessThanOrEqual(160);
    }
  });

  it("stays in the GSM 7-bit alphabet (single segment, no UCS-2 flip)", () => {
    for (const loc of [FIX, LAST_KNOWN, COARSE, COARSE_LAST_KNOWN, null]) {
      expect(buildMessage("Kassandra", loc)).toMatch(GSM_SAFE);
      expect(buildMessage("Kassandra", loc, { includeMapLink: true })).toMatch(GSM_SAFE);
    }
  });

  it("turns a browser's narrow no-break space before PM into a plain space", () => {
    const spy = vi.spyOn(Date.prototype, "toLocaleTimeString").mockReturnValue("6:11 PM");
    try {
      const msg = buildMessage("Kassandra", FIX);
      expect(msg).toContain("at 6:11 PM.");
      expect(msg).toMatch(GSM_SAFE);
    } finally {
      spy.mockRestore();
    }
  });

  it("falls back to Someone for a blank name", () => {
    expect(buildMessage("   ", null)).toContain("Someone");
  });
});
