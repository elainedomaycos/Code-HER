import type { Location } from "./types";

export function buildMessage(name: string, loc: Location): string {
  const lat = loc.lat.toFixed(5);
  const lng = loc.lng.toFixed(5);
  const time = new Date(loc.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `EMERGENCY: ${name} may need help. Location: ${lat}, ${lng} (accuracy ~${loc.accuracy}m, ${time}) Map: https://maps.google.com/?q=${lat},${lng} Sent automatically by Code:HER. Please call or check on them now.`;
}
