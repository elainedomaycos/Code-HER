// Plain language for the voice engine state. Pure so it can be unit tested.
import { effectivePhrase } from "@/services";
import type { VoiceEngineState } from "@/services/types";

export type VoiceTone = "ok" | "busy" | "warn" | "off";
/** What the status card's button does, if it has one. */
export type VoiceAction = "resume" | "start" | "retry";

export interface VoiceCopy {
  tone: VoiceTone;
  title: string;
  detail: string;
  action?: VoiceAction;
  actionLabel?: string;
}

const MANUAL_STILL_WORKS = "You can still send an SOS by holding the button below.";

/** Plain title plus one clear step; every reason keeps the SOS reassurance. */
interface UnavailableCopy {
  title: string;
  fix?: string;
}
const UNAVAILABLE: Partial<Record<string, UnavailableCopy>> = {
  "insecure-context": {
    title: "Voice cannot start on this page",
    fix: "Open Code:HER from its secure link.",
  },
  // The server does not have the voice file; going online will not fix it.
  "model-missing": {
    title: "Voice is not set up on this site yet",
    fix: "Try again later.",
  },
  "no-mic": { title: "No microphone found" },
};
const UNAVAILABLE_DEFAULT: UnavailableCopy = { title: "Voice not available in this browser" };
/** The Android app is not a browser; never tell its users to switch browsers. */
const UNAVAILABLE_DEFAULT_NATIVE: UnavailableCopy = {
  title: "Voice could not start",
  fix: "Close Code:HER and open it again.",
};

function unavailableCopy(state: VoiceEngineState): VoiceCopy {
  const fallback = state.native ? UNAVAILABLE_DEFAULT_NATIVE : UNAVAILABLE_DEFAULT;
  const entry = (state.reason ? UNAVAILABLE[state.reason] : undefined) ?? fallback;
  const fix = entry.fix ? `${entry.fix} ` : "";
  return {
    tone: "warn",
    title: entry.title,
    detail: `${fix}${MANUAL_STILL_WORKS}`,
    action: "retry",
    actionLabel: "Try again",
  };
}

/** safePhrase is the saved setting; the title shows what the engine really listens for. */
export function describeVoice(
  state: VoiceEngineState,
  paused: boolean,
  safePhrase: string,
): VoiceCopy {
  if (paused) {
    return {
      tone: "off",
      title: "Listening is paused",
      detail: "Your SOS phrase will not start an alert until you resume.",
      action: "resume",
      actionLabel: "Resume listening",
    };
  }
  switch (state.status) {
    case "listening":
      return {
        tone: "ok",
        title: `Listening for “${effectivePhrase(safePhrase)}”`,
        detail: "Say it out loud to start an alert. Audio stays on this phone.",
      };
    case "loading-model":
      return {
        tone: "busy",
        title: "Preparing voice engine",
        detail: "The first start can take a minute. SOS works right now.",
      };
    case "needs-gesture":
      return {
        tone: "busy",
        title: "Tap to start listening",
        detail: "Your browser needs one tap before it can use the microphone.",
        action: "start",
        actionLabel: "Start listening",
      };
    case "mic-blocked":
      return {
        tone: "warn",
        title: "Microphone blocked",
        detail: `Allow microphone access in your ${state.native ? "phone" : "browser"} settings, then try again. ${MANUAL_STILL_WORKS}`,
        action: "retry",
        actionLabel: "Try again",
      };
    case "unavailable":
      return unavailableCopy(state);
    case "off":
      return {
        tone: "off",
        title: "Voice is off",
        detail: MANUAL_STILL_WORKS,
        action: "start",
        actionLabel: "Turn on voice",
      };
  }
}
