import { describe, it, expect } from "vitest";
import { buildMessage } from "./messageBuilder";
import type { LocationFix } from "./types";

const FIX: LocationFix = {
  lat: 13.7565,
  lng: 121.0583,
  accuracyM: 18,
  at: new Date("2026-10-09T18:11:00").getTime(),
  source: "gps",
};
const LAST_KNOWN: LocationFix = { ...FIX, source: "last_known" };
const COARSE: LocationFix = { ...FIX, accuracyM: 800 };
const COARSE_LAST_KNOWN: LocationFix = { ...FIX, accuracyM: 800, source: "last_known" };

describe("emergency SMS template (codeHER.md §5)", () => {
  it("fits a single SMS segment for a fresh fix", () => {
    const msg = buildMessage("Kassandra", FIX);
    expect(msg.length).toBeLessThanOrEqual(160);
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
    expect(msg).toContain("last known");
    expect(msg).toContain("13.75650,121.05830");
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it("sends without location instead of blocking when no fix exists", () => {
    const msg = buildMessage("Kassandra", null);
    expect(msg).toContain("Kassandra");
    expect(msg).toContain("Location unavailable");
    expect(msg).not.toContain("http");
  });

  it("rounds coarse fixes and labels the approximate area", () => {
    const msg = buildMessage("Kassandra", COARSE, { includeMapLink: true });
    expect(msg).toContain("approximate");
    expect(msg).toContain("13.757,121.058");
    expect(msg).toContain("https://maps.google.com/?q=13.75650,121.05830");
    expect(msg.length).toBeLessThanOrEqual(160);
  });

  it("keeps exact coordinates at the 100 m boundary", () => {
    expect(buildMessage("Kassandra", { ...FIX, accuracyM: 100 })).not.toContain("approximate");
    expect(buildMessage("Kassandra", { ...FIX, accuracyM: 101 })).toContain("approximate");
  });

  it("composes last-known and approximate labels", () => {
    const msg = buildMessage("Kassandra", COARSE_LAST_KNOWN, { includeMapLink: true });
    expect(msg).toContain("last known");
    expect(msg).toContain("approximate");
    expect(msg).toContain("https://maps.google.com/?q=13.75650,121.05830");
  });

  it("stays in the GSM 7-bit alphabet (single segment, no UCS-2 flip)", () => {
    for (const loc of [FIX, LAST_KNOWN, COARSE, COARSE_LAST_KNOWN, null]) {
      expect(buildMessage("Kassandra", loc)).toMatch(/^[\x20-\x7E]*$/);
    }
  });

  it("falls back to Someone for a blank name", () => {
    expect(buildMessage("   ", null)).toContain("Someone");
  });
});
