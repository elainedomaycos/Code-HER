import { useEffect, useState } from "react";
import { AudioLines, Loader2, MicOff, Pause } from "lucide-react";
import { listeningService } from "@/services";
import { cn } from "@/lib/utils";
import { useCodeHer } from "./store";
import { useKeepScreenOnStatus, useVoiceEngine } from "./hooks";
import { describeVoice, screenNote, type VoiceAction, type VoiceTone } from "./voiceStatus";
import { btnSecondary, cardCls } from "./ui";

const toneIcon: Record<VoiceTone, string> = {
  ok: "bg-secondary text-coral-ink",
  busy: "bg-muted text-muted-foreground",
  warn: "bg-warning-soft text-foreground",
  off: "bg-muted text-muted-foreground",
};

function StatusIcon({ tone, small }: { tone: VoiceTone; small: boolean }) {
  const box = small ? "h-8 w-8" : "h-14 w-14";
  const glyph = small ? "h-4 w-4" : "h-6 w-6";
  return (
    <span className={cn("relative grid shrink-0 place-items-center", box)} aria-hidden="true">
      {tone === "ok" && (
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/40" />
      )}
      <span className={cn("relative grid place-items-center rounded-full", box, toneIcon[tone])}>
        {tone === "ok" && <AudioLines className={glyph} />}
        {tone === "busy" && (
          <Loader2 className={cn(glyph, "animate-spin motion-reduce:animate-none")} />
        )}
        {tone === "warn" && <MicOff className={glyph} />}
        {tone === "off" && <Pause className={glyph} />}
      </span>
    </span>
  );
}

const NO_CONTACT_DETAIL = "Saying it starts an alert. Add a contact so it reaches someone.";
const STILL_BLOCKED = "Still blocked. Open your browser's site settings to allow the microphone.";
const STILL_BLOCKED_NATIVE = "Still blocked. Open your phone settings to allow the microphone.";

/**
 * Calm status, not a button: says whether the SOS phrase can start an
 * alert right now, with one fix action when something is wrong.
 */
export function VoiceStatusCard({ compact = false }: { compact?: boolean }) {
  const { phase, settings, togglePause, contacts } = useCodeHer();
  const voice = useVoiceEngine();
  const screen = useKeepScreenOnStatus();
  const paused = phase === "paused";
  const copy = describeVoice(voice, paused, settings.safePhrase);
  const note = copy.tone === "ok" && !voice.native ? screenNote(screen) : null;
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    if (voice.status === "listening") setRetried(false);
  }, [voice.status]);

  const detail =
    compact && copy.tone === "ok" && contacts.length === 0 ? NO_CONTACT_DETAIL : copy.detail;

  const run = (action: VoiceAction) => {
    if (action === "resume") {
      togglePause();
      return;
    }
    if (action === "retry") setRetried(true);
    listeningService.start().catch((e: unknown) => console.error(e));
  };

  return (
    <section aria-live="polite" className={cn(cardCls, compact ? "px-5 py-3" : "p-5")}>
      <div className="flex items-center gap-4">
        <StatusIcon tone={copy.tone} small={compact} />
        <div className="min-w-0">
          <h2
            className={cn(
              "leading-snug",
              compact ? "text-base font-bold" : "text-xl font-extrabold",
            )}
          >
            {copy.title}
          </h2>
          <p className={cn("mt-0.5 text-muted-foreground", compact ? "text-sm" : "text-base")}>
            {detail}
          </p>
        </div>
      </div>
      {note && <p className="mt-3 text-sm font-semibold text-foreground">{note}</p>}
      {retried && voice.status === "mic-blocked" && (
        <p className="mt-3 text-sm font-semibold text-foreground">
          {voice.native ? STILL_BLOCKED_NATIVE : STILL_BLOCKED}
        </p>
      )}
      {copy.action && copy.actionLabel ? (
        <button
          type="button"
          onClick={() => copy.action && run(copy.action)}
          className={cn(btnSecondary, "mt-4")}
        >
          {copy.actionLabel}
        </button>
      ) : (
        copy.tone === "ok" &&
        !compact && (
          <button type="button" onClick={togglePause} className={cn(btnSecondary, "mt-4")}>
            <Pause className="h-4 w-4" aria-hidden="true" /> Pause listening
          </button>
        )
      )}
    </section>
  );
}
