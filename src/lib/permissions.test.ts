import { describe, it, expect } from "vitest";
import { requestMicPermission, requestLocationPermission } from "./permissions";

describe("permission prompts", () => {
  it("mic resolves false where getUserMedia is unavailable (jsdom)", async () => {
    await expect(requestMicPermission()).resolves.toBe(false);
  });

  it("location resolves false where geolocation is unavailable (jsdom)", async () => {
    await expect(requestLocationPermission()).resolves.toBe(false);
  });
});
