import { useEffect, useRef } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTDOWN_SECONDS, useCodeHer, type SmsMode } from "./store";
import { countdownRecipientsLine } from "./format";

const RING_R = 88;
const RING_C = 2 * Math.PI * RING_R;
/**
 * Cancel ignores activation this soon after the screen appears: a held
 * Enter key (or switch) that started the alert would otherwise auto-repeat
 * onto the freshly focused Cancel button and silently undo the SOS.
 */
export const CANCEL_GUARD_MS = 600;

function titleFor(phase: string, isTest: boolean, mode: SmsMode): string {
  const handoff = mode === "handoff";
  if (phase === "locating") return "Getting your location";
  if (phase === "sending") return handoff ? "Opening your alert" : "Sending your alert";
  if (isTest) return "Test alert in";
  return handoff ? "Opening your alert in" : "Sending alert in";
}

/** Full screen, calm, one huge Cancel. Works one handed. */
export function CountdownScreen() {
  const { phase, countdown, cancel, contacts, isTest, smsMode } = useCodeHer();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const mountedAt = useRef(Date.now());
  const onCancel = () => {
    if (Date.now() - mountedAt.current < CANCEL_GUARD_MS) return;
    cancel();
  };
  const working = phase === "locating" || phase === "sending";
  const canCancel = phase !== "sending";
  // The SOS button that started this is gone; move focus to Cancel.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  // Round caps overlap while the ring is (nearly) full; butt caps avoid the notch.
  const cap = working || countdown >= COUNTDOWN_SECONDS - 1 ? "butt" : "round";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="countdown-title"
      aria-describedby="countdown-to"
      className="flex flex-1 flex-col items-center px-4 pb-8 pt-12 text-center"
    >
      {isTest ? (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-bold text-muted-foreground">
          <FlaskConical className="h-4 w-4" aria-hidden="true" />
          Test alert
        </p>
      ) : (
        <p className="text-sm font-bold uppercase tracking-widest text-coral-ink">
          Emergency alert
        </p>
      )}
      <h1 id="countdown-title" className="mt-2 text-balance text-3xl font-extrabold">
        {titleFor(phase, isTest, smsMode)}
      </h1>
      <div className="relative mt-8 grid h-56 w-56 place-items-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
          <circle
            cx="100"
            cy="100"
            r={RING_R}
            className="fill-card stroke-secondary"
            strokeWidth="12"
          />
          <circle
            cx="100"
            cy="100"
            r={RING_R}
            className={cn(
              "fill-none transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none",
              isTest ? "stroke-paused" : "stroke-primary",
            )}
            strokeWidth="12"
            strokeLinecap={cap}
            strokeDasharray={RING_C}
            strokeDashoffset={working ? 0 : RING_C * (1 - countdown / COUNTDOWN_SECONDS)}
          />
        </svg>
        {working ? (
          <Loader2
            className="relative h-16 w-16 animate-spin text-coral-ink motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <span
            className="relative text-8xl font-extrabold tabular-nums"
            role="timer"
            aria-label={`${countdown} seconds`}
          >
            {countdown}
          </span>
        )}
      </div>
      <p id="countdown-to" className="mt-6 max-w-xs text-lg font-semibold">
        {countdownRecipientsLine(contacts, isTest, smsMode)}
      </p>
      {isTest && (
        <p className="mt-1 max-w-xs text-base text-muted-foreground">
          This is a test. Nothing will be sent.
        </p>
      )}
      <div className="mt-auto w-full pt-8">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          onKeyDown={(e) => {
            // A held key from the SOS hold must not cancel the alert.
            if (e.repeat) e.preventDefault();
          }}
          disabled={!canCancel}
          className="flex min-h-24 w-full items-center justify-center rounded-3xl bg-foreground text-2xl font-extrabold text-background shadow-soft active:scale-[0.98] disabled:opacity-40 motion-reduce:transition-none"
        >
          {isTest ? "Stop test" : "Cancel alert"}
        </button>
        <p className="mt-3 text-base text-muted-foreground">
          {!canCancel
            ? smsMode === "handoff"
              ? "Opening Messages."
              : "The alert is on its way."
            : isTest
              ? "Or wait to see what your contacts get."
              : "Tap Cancel if you are safe."}
        </p>
      </div>
    </div>
  );
}
