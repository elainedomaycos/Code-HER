import { FlaskConical, Siren } from "lucide-react";
import { useCodeHer } from "./store";
import { sosCaption } from "./format";
import { useSetup } from "./hooks";
import { HoldButton } from "./HoldButton";
import { SetupChecklist } from "./SetupChecklist";
import { VoiceStatusCard } from "./VoiceStatusCard";
import { btnText, ScreenTitle } from "./ui";

function SosAction() {
  const { trigger, contacts, smsMode } = useCodeHer();
  return (
    <section aria-labelledby="sos-title" className="space-y-3">
      <h2 id="sos-title" className="sr-only">
        Emergency SOS
      </h2>
      <HoldButton
        onComplete={trigger}
        label="Hold to send SOS"
        holdingLabel="Keep holding"
        ariaLabel="Send SOS. Press and hold to start the alert."
        icon={<Siren className="h-7 w-7" aria-hidden="true" />}
      />
      <p className="text-balance text-center text-sm text-muted-foreground">
        {sosCaption(contacts, smsMode)}
      </p>
    </section>
  );
}

/** Runs the whole alert as a test. Nothing is sent. */
function TestShortcut() {
  const { phase, startTest } = useCodeHer();
  return (
    <div className="text-center">
      <button type="button" onClick={startTest} disabled={phase === "paused"} className={btnText}>
        <FlaskConical className="h-4 w-4" aria-hidden="true" />
        Try a test alert
      </button>
    </div>
  );
}

export function HomeScreen() {
  const setup = useSetup();
  const left = setup.steps.length - setup.done;
  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pb-6 pt-2">
      {setup.complete ? (
        <>
          <ScreenTitle
            title="You are ready"
            subtitle="Say your SOS phrase or hold the button below."
          />
          <VoiceStatusCard />
        </>
      ) : (
        <>
          <ScreenTitle
            title="Finish setting up"
            subtitle={`${left} ${left === 1 ? "step" : "steps"} left before Code:HER is ready.`}
          />
          <SetupChecklist steps={setup.steps} />
          <VoiceStatusCard compact />
        </>
      )}
      {/* Grows to push SOS toward the thumb, but caps so no empty band opens. */}
      <div aria-hidden="true" className="max-h-4 flex-1" />
      <div className="space-y-3">
        <SosAction />
        <TestShortcut />
      </div>
    </div>
  );
}
