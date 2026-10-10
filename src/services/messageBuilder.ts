// Emergency SMS template (codeHER.md §5): preformatted plain text, single
// segment (≤160 chars) when possible. Raw coordinates always appear as text
// (the maps link needs data to open); last-known fixes are labeled; with no
// fix at all the message says so instead of blocking. Coarse fixes are
// rounded and labeled as an approximate area — no map SDK needed to express
// uncertainty, the accuracy radius already carries it.
import type { LocationFix } from "./types";

const MAP_BASE = "https://maps.google.com/?q=";

/** Fixes coarser than this are sent rounded + labeled approximate. */
export const APPROXIMATE_BEYOND_M = 100;

function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function buildMessage(
  name: string,
  loc: LocationFix | null,
  opts?: { includeMapLink?: boolean },
): string {
  const who = name.trim() || "Someone";
  if (!loc) {
    return `EMERGENCY: ${who} may need help. Location unavailable. Sent by Code:HER.`;
  }
  const approx = loc.accuracyM > APPROXIMATE_BEYOND_M;
  const shown = approx
    ? `${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}`
    : `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
  // Full precision stays in the link so it still opens at the right point.
  // The link itself is optional: carriers that filter URL-bearing SMS as
  // spam will drop the whole message, so it defaults off.
  const link = opts?.includeMapLink
    ? ` ${MAP_BASE}${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`
    : "";
  const freshness = loc.source === "last_known" ? ", last known" : "";
  const area = approx ? ", approximate" : "";
  return (
    `EMERGENCY: ${who} may need help. ` +
    // "~" (not "±"): keeps the message in the GSM 7-bit alphabet so it stays
    // a single segment. One non-GSM char flips the whole SMS to UCS-2 (70
    // chars/segment) — tripling cost and failure surface on every send.
    `Location: ${shown}${link} ` +
    `(~${loc.accuracyM}m, ${fmtTime(loc.at)}${freshness}${area}). Sent by Code:HER.`
  );
}
