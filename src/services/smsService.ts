// Mock SmsService: validates PH numbers, honors the "no signal" simulation,
// keeps an in-memory retry outbox. Native (Phase 2) sends via SmsManager with
// delivery receipts and a persisted retry queue.
import type { SmsResult, SmsService } from "./types";
import {
  buildSmsLink,
  copyText,
  currentSmsPlatform,
  tryOpenSmsLink,
  type SmsPlatform,
} from "@/lib/smsLink";

let noSignal = false;

type QueueEntry = { to: string; body: string };
let outbox: QueueEntry[] = [];

const PHONE_RE = /^\+639\d{9}$/;

/**
 * Mock-only: mirror the settings "simulate no signal" toggle. Under the
 * native selector this is a no-op — the radio proves signal, not a flag.
 */
export function setMockNoSignal(v: boolean): void {
  noSignal = v;
}

export const mockSmsService: SmsService = {
  async send(to: string, body: string): Promise<SmsResult> {
    await new Promise((r) => setTimeout(r, 500));
    if (noSignal) return { ok: false, error: "no-signal" };
    if (!PHONE_RE.test(to)) return { ok: false, error: "invalid-number" };
    void body;
    return { ok: true };
  },
  async queueForRetry(to: string, body: string): Promise<void> {
    outbox.push({ to, body });
  },
  async flushQueue(): Promise<void> {
    // Mock outbox is best-effort and in-memory; the caller re-sends via
    // send() to learn per-contact status. Native persists and delivers here.
    outbox = [];
  },
};

// ---- Web SMS handoff --------------------------------------------------------
// A browser cannot send SMS. Outside the native shell the alert is handed to
// the phone's Messages app through an `sms:` link (see src/lib/smsLink.ts for
// the per platform URI format); the user taps Send there. The native path
// (SmsManager via HerNative) does not use any of this.

export type { SmsPlatform };

export interface SmsHandoffDraft {
  /** `sms:` URI with every recipient and the encoded body. */
  href: string;
  /** Exact alert text, for display and Copy. */
  body: string;
  platform: SmsPlatform;
}

export const webSmsHandoff = {
  prepare(recipients: readonly string[], body: string, platform?: SmsPlatform): SmsHandoffDraft {
    const p = platform ?? currentSmsPlatform();
    return { href: buildSmsLink(recipients, body, p), body, platform: p };
  },
  /** One best effort auto open; usually blocked without a user gesture. */
  open(href: string): boolean {
    return tryOpenSmsLink(href);
  },
  copy(text: string): Promise<boolean> {
    return copyText(text);
  },
};
