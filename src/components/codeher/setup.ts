// Setup checklist (Home): what is still missing before Code:HER can alert
// someone. Pure so it can be unit tested; the Home screen only renders it.
import type { Contact } from "@/services/types";
import { effectivePhrase } from "@/services";
import { joinNames } from "./format";

export type SetupStepId = "contact" | "name" | "phrase" | "permissions";

export interface SetupStep {
  id: SetupStepId;
  done: boolean;
  title: string;
  detail: string;
}

export interface SetupInput {
  contacts: readonly Contact[];
  userName: string;
  safePhrase: string;
  micAllowed: boolean;
  locationAllowed: boolean;
}

function contactStep(contacts: readonly Contact[]): SetupStep {
  if (contacts.length === 0) {
    return {
      id: "contact",
      done: false,
      title: "Add a trusted contact",
      detail: "They get your alert and location by text.",
    };
  }
  return {
    id: "contact",
    done: true,
    title: contacts.length === 1 ? "Trusted contact added" : "Trusted contacts added",
    detail: joinNames(contacts),
  };
}

function nameStep(userName: string): SetupStep {
  const name = userName.trim();
  return name
    ? { id: "name", done: true, title: "Your name is set", detail: name }
    : {
        id: "name",
        done: false,
        title: "Add your name",
        detail: "So your contacts know the alert is from you.",
      };
}

function phraseStep(safePhrase: string): SetupStep {
  return safePhrase.trim()
    ? {
        id: "phrase",
        done: true,
        title: "SOS phrase chosen",
        // Show what the voice engine actually listens for, not the raw saved text.
        detail: `“${effectivePhrase(safePhrase)}”`,
      }
    : {
        id: "phrase",
        done: false,
        title: "Choose your SOS phrase",
        detail: "The words that start an alert.",
      };
}

/** Each permission says only what it is for. Keyed by what is still missing. */
const PERMISSION_DETAIL = {
  mic: "Needed to hear your SOS phrase. Audio stays on this phone.",
  location: "Needed to add where you are to the alert.",
  both: "Needed to hear your SOS phrase and add where you are.",
} as const;

function permissionsStep(mic: boolean, location: boolean): SetupStep {
  if (mic && location) {
    return {
      id: "permissions",
      done: true,
      title: "Microphone and location allowed",
      detail: "Code:HER can hear your phrase and share where you are.",
    };
  }
  const title =
    !mic && !location
      ? "Allow microphone and location"
      : !mic
        ? "Allow the microphone"
        : "Allow location";
  return {
    id: "permissions",
    done: false,
    title,
    detail: PERMISSION_DETAIL[mic ? "location" : location ? "mic" : "both"],
  };
}

export function getSetupSteps(input: SetupInput): SetupStep[] {
  return [
    contactStep(input.contacts),
    nameStep(input.userName),
    phraseStep(input.safePhrase),
    permissionsStep(input.micAllowed, input.locationAllowed),
  ];
}

/** Ready only when every step is done; Home claims nothing before that. */
export function isSetupComplete(steps: readonly SetupStep[]): boolean {
  return steps.every((s) => s.done);
}

export function countDone(steps: readonly SetupStep[]): number {
  return steps.filter((s) => s.done).length;
}
