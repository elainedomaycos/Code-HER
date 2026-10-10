// Mock LocationService: browser geolocation with an 8s cap, last-known
// fallback, null when nothing is available (codeHER.md §5: never block
// sending on a slow fix). Native (Phase 2) uses fused/GPS with the same
// timeout and fallback contract.
import type { LocationFix, LocationService } from "./types";

/** §5: give up on a live fix after ~8s, then send with the best available data. */
const GPS_TIMEOUT_MS = 8000;

let lastKnown: LocationFix | null = null;
let forceNoFix = false;

/** Test-only hook: simulate a device with no GPS and no last-known fix. */
export function setMockNoFix(v: boolean): void {
  forceNoFix = v;
}

/** Test-only hook: seed or clear the last-known fix. */
export function setMockLastKnown(fix: LocationFix | null): void {
  lastKnown = fix;
}

export const mockLocationService: LocationService = {
  async getCurrent(): Promise<LocationFix | null> {
    if (!forceNoFix && typeof navigator !== "undefined" && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => {
          // Hard cap: the browser timeout doesn't start until permission is answered.
          const t = setTimeout(() => rej(new Error("gps-timeout")), GPS_TIMEOUT_MS);
          navigator.geolocation.getCurrentPosition(
            (p) => {
              clearTimeout(t);
              res(p);
            },
            (e) => {
              clearTimeout(t);
              rej(e);
            },
            { timeout: GPS_TIMEOUT_MS, maximumAge: 60000 },
          );
        });
        lastKnown = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: Math.round(pos.coords.accuracy),
          at: pos.timestamp,
          source: "gps",
        };
        return lastKnown;
      } catch {
        /* fall through to last-known */
      }
    }
    return lastKnown;
  },
};
