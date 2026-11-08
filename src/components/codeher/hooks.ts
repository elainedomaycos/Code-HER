import { useSyncExternalStore } from "react";
import { getVoiceEngineState, onVoiceEngineStateChange, type VoiceEngineState } from "@/services";
import { useCodeHer } from "./store";
import { countDone, getSetupSteps, isSetupComplete, type SetupStep } from "./setup";

const SERVER_VOICE_STATE: VoiceEngineState = { status: "off", native: false };

/** Live voice engine readiness (loading model, listening, mic blocked...). */
export function useVoiceEngine(): VoiceEngineState {
  return useSyncExternalStore(
    onVoiceEngineStateChange,
    getVoiceEngineState,
    () => SERVER_VOICE_STATE,
  );
}

export interface SetupProgress {
  steps: SetupStep[];
  complete: boolean;
  done: number;
}

/** Setup checklist from the store plus what the browser and engine report. */
export function useSetup(): SetupProgress {
  const { contacts, settings, permissions, location } = useCodeHer();
  const voice = useVoiceEngine();
  const steps = getSetupSteps({
    contacts,
    userName: settings.userName,
    safePhrase: settings.safePhrase,
    // The engine only reaches "listening" with a granted mic.
    micAllowed: (permissions?.mic ?? false) || voice.status === "listening",
    locationAllowed: (permissions?.location ?? false) || location !== null,
  });
  return { steps, complete: isSetupComplete(steps), done: countDone(steps) };
}
