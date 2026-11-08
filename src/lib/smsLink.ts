// Web SMS handoff: build an `sms:` URI that opens the phone's Messages app
// with every trusted contact and the alert text prefilled. The browser cannot
// send an SMS itself, so the user taps Send in Messages. Nothing leaves the
// device through the network here: the URI is handed to the OS.
//
// Format choice (researched 2026-11, RFC 5724 plus observed platform quirks):
//
//   Android (Google Messages, Samsung Messages), and the default elsewhere:
//     sms:+639171111111,+639172222222?body=<encoded>
//     RFC 5724 form. Comma separated recipients, `?body=`.
//
//   iOS / iPadOS, one recipient:
//     sms:+639171111111&body=<encoded>
//     iOS 8+ ignores `?body=` after a number; it expects `&body=`.
//
//   iOS / iPadOS, two or more recipients:
//     sms:/open?addresses=+639171111111,+639172222222&body=<encoded>
//     The only form that prefills a group thread on iOS. With a plain
//     `sms:a,b` iOS drops every recipient after the first.
//
//   iOS, no recipients:      sms:&body=<encoded>
//   Others, no recipients:   sms:?body=<encoded>
//
// Body encoding: encodeURIComponent, so spaces become %20 (never `+`, which
// iOS shows literally), and `&`, `?`, `#`, `%`, `+` and newlines are escaped
// and cannot break out of the body parameter. Numbers are reduced to digits
// with an optional leading `+` so no separator characters leak in.
//
// Known risk: a few older Samsung builds only split recipients on `;`. The
// handoff screen always shows the exact text with a Copy button as the
// fallback, so a partially prefilled thread is still recoverable.

export type SmsPlatform = "ios" | "android" | "desktop";

/** Keep digits and one leading "+": "+63 917-111 1111" becomes "+639171111111". */
export function normalizeSmsNumber(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

/**
 * Best effort platform sniffing for the URI flavor only. iPadOS 13+ reports
 * a Mac user agent, so a "Macintosh" with touch points counts as iOS.
 */
export function detectSmsPlatform(userAgent: string, maxTouchPoints = 0): SmsPlatform {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (ua.includes("macintosh") && maxTouchPoints > 1) return "ios";
  if (ua.includes("android")) return "android";
  return "desktop";
}

/** Platform of the current browser; "desktop" outside a browser (SSR, tests without UA). */
export function currentSmsPlatform(): SmsPlatform {
  if (typeof navigator === "undefined") return "desktop";
  return detectSmsPlatform(navigator.userAgent ?? "", navigator.maxTouchPoints ?? 0);
}

/** Build the `sms:` URI for the given recipients and body. See the header for the format. */
export function buildSmsLink(
  recipients: readonly string[],
  body: string,
  platform: SmsPlatform,
): string {
  const numbers = recipients.map(normalizeSmsNumber).filter((n) => n.length > 0);
  const encoded = encodeURIComponent(body);
  if (platform === "ios") {
    if (numbers.length === 0) return `sms:&body=${encoded}`;
    if (numbers.length === 1) return `sms:${numbers[0]}&body=${encoded}`;
    return `sms:/open?addresses=${numbers.join(",")}&body=${encoded}`;
  }
  return `sms:${numbers.join(",")}?body=${encoded}`;
}

/**
 * Try to open the Messages app. Browsers usually block navigation to an
 * external scheme without a recent user gesture (a timer firing after the
 * countdown has none), so callers must always also render a real
 * `<a href={href}>` the user can tap. Returns false when the attempt threw.
 */
export function tryOpenSmsLink(href: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.location.assign(href);
    return true;
  } catch (e: unknown) {
    console.error(e);
    return false;
  }
}

/** Legacy copy path for browsers without the async Clipboard API (or insecure origins). */
function copyWithTextarea(text: string): boolean {
  if (typeof document === "undefined" || !document.body) return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch (e: unknown) {
    console.error(e);
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}

/** Copy text to the clipboard. Resolves true on success, false when every path failed. */
export async function copyText(text: string): Promise<boolean> {
  const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (clip && typeof clip.writeText === "function") {
    try {
      await clip.writeText(text);
      return true;
    } catch (e: unknown) {
      // Permission denied or insecure context: fall through to the legacy path.
      console.error(e);
    }
  }
  return copyWithTextarea(text);
}
