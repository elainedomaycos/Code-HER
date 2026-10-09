import type { Contact, ContactResult } from "./types";

let queue: { contacts: Contact[]; message: string }[] = [];

export async function sendSMS(contacts: Contact[], message: string, opts: { noSignal: boolean }): Promise<ContactResult[]> {
  await new Promise((r) => setTimeout(r, 1200));
  if (opts.noSignal) {
    queue.push({ contacts, message });
    return contacts.map((contact) => ({ contact, status: "queued" }));
  }
  return contacts.map((contact) => ({ contact, status: /^\+639\d{9}$/.test(contact.phone) ? "sent" : "failed" }));
}

export async function retryQueued(opts: { noSignal: boolean }): Promise<ContactResult[] | null> {
  if (opts.noSignal || queue.length === 0) return null;
  const items = queue; queue = [];
  const results: ContactResult[] = [];
  for (const i of items) results.push(...(await sendSMS(i.contacts, i.message, opts)));
  return results;
}
