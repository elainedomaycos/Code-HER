import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, Copy, MessageSquare, Send } from "lucide-react";
import { formatPH } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { useCodeHer, type SmsHandoffState } from "./store";
import { Avatar, btnPrimary, btnSecondary, cardCls, Chip } from "./ui";

type CopyState = "idle" | "copied" | "failed";

export interface HandoffViewProps {
  handoff: SmsHandoffState;
  /** Tap on the Messages link. Records an attempt; the store decides "opened". */
  onOpenAttempt: () => void;
  onCopy: () => Promise<boolean>;
  onDone: () => void;
}

const cardLabel = "text-xs font-bold uppercase tracking-wide text-muted-foreground";

/** A held key from the SOS hold must not fire the action that took focus. */
function ignoreRepeat(e: KeyboardEvent<HTMLElement>): void {
  if (e.repeat) e.preventDefault();
}

/** Leaving before the message was opened or copied asks first: nothing went out. */
function LeaveButton({ handedOff, onDone }: { handedOff: boolean; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (handedOff) {
    return (
      <button type="button" onClick={onDone} className={cn(btnSecondary, "mt-auto")}>
        Back to home
      </button>
    );
  }
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={cn(btnSecondary, "mt-auto")}
      >
        Cancel alert
      </button>
    );
  }
  return (
    <div role="group" aria-labelledby="leave-q" className={cn(cardCls, "mt-auto space-y-3 p-4")}>
      <p id="leave-q" className="text-base font-semibold">
        Your alert has not been sent. Leave anyway?
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-12 flex-1 rounded-2xl border border-border bg-card font-semibold"
        >
          Stay
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-12 flex-1 rounded-2xl bg-destructive font-bold text-destructive-foreground"
        >
          Leave
        </button>
      </div>
    </div>
  );
}

/**
 * Web SMS handoff: the alert is prefilled in the phone's Messages app and
 * the user taps Send there. The browser cannot confirm delivery, so the
 * status never claims "sent".
 */
export function HandoffView({ handoff, onOpenAttempt, onCopy, onDone }: HandoffViewProps) {
  const [copy, setCopy] = useState<CopyState>("idle");
  const desktop = handoff.platform === "desktop";
  const opened = handoff.status === "opened";
  // A successful copy is a handoff too: she may already have texted it.
  const copied = copy === "copied";
  const handedOff = opened || copied;
  const linkRef = useRef<HTMLAnchorElement>(null);
  const copyRef = useRef<HTMLButtonElement>(null);

  // The SOS control that started this is gone; land focus on the main action.
  useEffect(() => {
    (desktop ? copyRef.current : linkRef.current)?.focus();
    // Once, on arrival only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doCopy = () => {
    onCopy()
      .then((ok) => setCopy(ok ? "copied" : "failed"))
      .catch(() => setCopy("failed"));
  };

  const openLink = (
    <a
      ref={linkRef}
      href={handoff.href}
      onClick={desktop ? undefined : onOpenAttempt}
      onKeyDown={ignoreRepeat}
      className={desktop ? btnSecondary : cn(btnPrimary, "min-h-16 text-xl")}
    >
      <Send className="h-5 w-5" aria-hidden="true" />
      {desktop ? "Open in Messages app" : "Open Messages to send"}
    </a>
  );
  const copyButton = (
    <button
      ref={copyRef}
      type="button"
      onClick={doCopy}
      onKeyDown={ignoreRepeat}
      className={desktop ? cn(btnPrimary, "min-h-16 text-xl") : btnSecondary}
    >
      {copy === "copied" ? (
        <Check className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Copy className="h-5 w-5" aria-hidden="true" />
      )}
      {copy === "copied" ? "Copied" : "Copy message"}
    </button>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pb-8 pt-8">
      <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-coral-ink">
          <MessageSquare className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-balance text-3xl font-extrabold">Send your alert</h1>
        <p className="mx-auto mt-2 max-w-xs text-lg text-muted-foreground">
          {desktop
            ? "Copy this message and text it from your phone. Code:HER cannot send it for you."
            : "Open Messages and tap Send. Code:HER cannot send it for you."}
        </p>
      </div>

      <p
        aria-label="Your message"
        className="select-all rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-base leading-relaxed"
      >
        {handoff.body}
      </p>

      <div className="space-y-3">
        {desktop ? copyButton : openLink}
        {desktop ? openLink : copyButton}
        <p aria-live="polite" className="text-center text-sm font-semibold empty:hidden">
          {copy === "copied" && <span className="text-success-ink">Message copied.</span>}
          {copy === "failed" && (
            <span className="text-destructive">Copy failed, select the text above.</span>
          )}
        </p>
      </div>

      <section aria-labelledby="handoff-to" className={cn(cardCls, "p-4")}>
        <h2 id="handoff-to" className={cardLabel}>
          Sending to
        </h2>
        {handoff.recipients.length === 0 ? (
          <p className="mt-2 text-base">No contacts saved. Choose who to text in Messages.</p>
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {handoff.recipients.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <Avatar name={c.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{formatPH(c.phone)}</p>
                </div>
                {opened ? (
                  <Chip tone="ok">Messages opened</Chip>
                ) : copied ? (
                  <Chip tone="ok">Copied</Chip>
                ) : (
                  <Chip tone="wait">Not sent yet</Chip>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <LeaveButton handedOff={handedOff} onDone={onDone} />
    </div>
  );
}

export function HandoffScreen() {
  const { handoff, noteOpenAttempt, copyMessage, backHome } = useCodeHer();
  if (!handoff) return null;
  return (
    <HandoffView
      handoff={handoff}
      onOpenAttempt={noteOpenAttempt}
      onCopy={copyMessage}
      onDone={backHome}
    />
  );
}
