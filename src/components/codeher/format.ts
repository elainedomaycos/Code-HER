// Shared, pure copy helpers for the Code:HER screens. Kept free of React so
// the wording can be unit tested and stays the same on every screen.
import { COUNTDOWN_SECONDS, type SmsMode } from "./store";

type Named = readonly { name: string }[];

/** "Mia", "Mia and Leo". */
export function joinNames(list: Named): string {
  return list.map((c) => c.name).join(" and ");
}

/** Native with zero contacts: the alert reaches no one. Say so plainly. */
export const NO_CONTACT_NATIVE = "Add a contact first. No one will get this alert.";

/** Web handoff with zero contacts: she picks recipients in Messages. */
export const NO_CONTACT_HANDOFF =
  "No contacts yet. You will choose who to text after the countdown.";

/** Caption under the Home SOS button. */
export function sosCaption(contacts: Named, mode: SmsMode): string {
  if (contacts.length === 0) {
    return mode === "handoff" ? NO_CONTACT_HANDOFF : NO_CONTACT_NATIVE;
  }
  const after =
    mode === "handoff"
      ? `Starts a ${COUNTDOWN_SECONDS} second countdown, then opens Messages.`
      : `${COUNTDOWN_SECONDS} second countdown, you can cancel.`;
  return `Alerts go to ${joinNames(contacts)}. ${after}`;
}

/** Who the alert goes to, on the countdown screen. */
export function countdownRecipientsLine(contacts: Named, isTest: boolean, mode: SmsMode): string {
  if (isTest) {
    return contacts.length ? `Would go to ${joinNames(contacts)}` : "No contacts saved yet.";
  }
  if (contacts.length) return `To ${joinNames(contacts)}`;
  return mode === "handoff"
    ? "No contacts saved. You will choose who to text after the countdown."
    : NO_CONTACT_NATIVE;
}
