// Mock SmsService: validates PH numbers, honors the "no signal" simulation,
// keeps an in-memory retry outbox. Native (Phase 2) sends via SmsManager with
// delivery receipts and a persisted retry queue.
import type { SmsResult, SmsService } from "./types";

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
