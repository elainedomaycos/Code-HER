import type { Location } from "./types";

let last: Location = { lat: 13.7565, lng: 121.0583, accuracy: 18, timestamp: Date.now(), isLastKnown: true };

export async function getCurrentLocation(): Promise<Location> {
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000, maximumAge: 60000 }),
      );
      last = {
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy), timestamp: pos.timestamp, isLastKnown: false,
      };
      return last;
    } catch { /* fall through */ }
  }
  await new Promise((r) => setTimeout(r, 700));
  return { ...last, timestamp: Date.now(), isLastKnown: true };
}

export const getLastKnown = () => last;
