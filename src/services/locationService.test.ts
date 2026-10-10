import { describe, it, expect } from "vitest";
import { mockLocationService, setMockLastKnown } from "./locationService";

describe("mock location service", () => {
  it("returns null when no fix and no last-known exist (jsdom has no geolocation)", async () => {
    setMockLastKnown(null);
    await expect(mockLocationService.getCurrent()).resolves.toBeNull();
  });

  it("falls back to the last-known fix", async () => {
    setMockLastKnown({ lat: 1, lng: 2, accuracyM: 30, at: 123, source: "last_known" });
    await expect(mockLocationService.getCurrent()).resolves.toEqual({
      lat: 1,
      lng: 2,
      accuracyM: 30,
      at: 123,
      source: "last_known",
    });
    setMockLastKnown(null);
  });
});
