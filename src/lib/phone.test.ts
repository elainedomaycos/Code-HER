import { describe, it, expect } from "vitest";
import { normalizePH } from "./phone";

describe("PH number validation", () => {
  it("accepts +63 9XX format", () => expect(normalizePH("+63 917 284 0612")).toBe("+639172840612"));
  it("accepts local 09XX format", () => expect(normalizePH("09172840612")).toBe("+639172840612"));
  it("rejects non-PH numbers", () => expect(normalizePH("+1 415 555 1234")).toBeNull());
  it("rejects too-short numbers", () => expect(normalizePH("+63917")).toBeNull());
});
