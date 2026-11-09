// Emergency SMS template (codeHER.md §5): preformatted plain text, single
// segment (≤160 chars) when possible, written in plain words a scared reader
// understands at a glance. Raw coordinates always appear as text (the maps
// link needs data to open); last-known fixes are labeled; with no fix at all
// the message says so instead of blocking. Accuracy is only mentioned when it
// matters (worse than SHOW_ACCURACY_BEYOND_M), as "within about N m"; coarse
// fixes are also rounded so the digits do not overstate precision.
//
// Everything stays in the GSM 7-bit alphabet: one non-GSM character (a "±",
// or the narrow no-break space some browsers put before AM/PM) flips the
// whole SMS to UCS-2 (70 chars per segment), tripling cost and failure
// surface on every send.
import type { LocationFix } from "./types";

const MAP_BASE = "https://maps.google.com/?q=";

/** Fixes coarser than this are sent with rounded coordinates. */
export const APPROXIMATE_BEYOND_M = 100;

/** Accuracy is only written out when it is worse than this. */
export const SHOW_ACCURACY_BEYOND_M = 50;

/** "6:11 PM", with any non-ASCII spacing (U+202F etc.) made a plain space. */
function fmtTime(at: number): string {
  return new Date(at)
    .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    .replace(/[^\x20-\x7E]/g, " ");
}

/** "within about 120 m": rounded to 10 m so it reads as an estimate. */
function fmtAccuracy(accuracyM: number): string {
  const rounded = Math.max(10, Math.round(accuracyM / 10) * 10);
  return `within about ${rounded} m`;
}

export function buildMessage(
  name: string,
  loc: LocationFix | null,
  opts?: { includeMapLink?: boolean },
): string {
  const who = name.trim() || "Someone";
  const intro = `EMERGENCY: ${who} may need help.`;
  const outro = "Sent by Code:HER.";
  if (!loc) {
    return `${intro} Location unavailable. ${outro}`;
  }
  const coarse = loc.accuracyM > APPROXIMATE_BEYOND_M;
  const shown = coarse
    ? `${loc.lat.toFixed(3)},${loc.lng.toFixed(3)}`
    : `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
  const label = loc.source === "last_known" ? "Last known location" : "Location";
  const accuracy = loc.accuracyM > SHOW_ACCURACY_BEYOND_M ? `, ${fmtAccuracy(loc.accuracyM)}` : "";
  // Full precision stays in the link so it still opens at the right point.
  // The link itself is optional: carriers that filter URL-bearing SMS as
  // spam will drop the whole message, so it defaults off.
  const link = opts?.includeMapLink
    ? ` ${MAP_BASE}${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`
    : "";
  return `${intro} ${label}: ${shown} at ${fmtTime(loc.at)}${accuracy}.${link} ${outro}`;
}
