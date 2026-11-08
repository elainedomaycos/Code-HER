import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { formatPH } from "@/lib/phone";
import type { SendStatus } from "@/services/types";
import { cn } from "@/lib/utils";
import { useCodeHer } from "./store";
import { Avatar, btnPrimary, cardCls, Chip, type ChipTone } from "./ui";

const STATUS: Record<SendStatus, { tone: ChipTone; icon: typeof Clock; label: string }> = {
  sent: { tone: "ok", icon: CheckCircle2, label: "Sent" },
  queued: { tone: "wait", icon: Clock, label: "Waiting for signal" },
  failed: { tone: "bad", icon: XCircle, label: "Not sent" },
};

const COPY: Record<SendStatus, { title: string; sub: string }> = {
  sent: { title: "Alert sent", sub: "Your contacts have your message and location." },
  queued: {
    title: "Waiting for signal",
    sub: "No signal right now. It will send when signal is back.",
  },
  failed: { title: "Alert not sent", sub: "The text could not be sent. Call someone if you can." },
};

/** Native result: real per-contact statuses from SmsManager. */
export function ResultScreen() {
  const { phase, results, location, sentAt, backHome } = useCodeHer();
  const overall: SendStatus = phase === "sent" || phase === "queued" ? phase : "failed";
  const head = STATUS[overall];
  const HeadIcon = head.icon;
  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pb-8 pt-8">
      <div className="text-center" role="status">
        <span
          className={cn(
            "mx-auto grid h-16 w-16 place-items-center rounded-full",
            overall === "sent"
              ? "bg-success/15 text-success-ink"
              : overall === "queued"
                ? "bg-warning-soft text-foreground"
                : "bg-destructive/10 text-destructive",
          )}
        >
          <HeadIcon className="h-8 w-8" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-3xl font-extrabold">{COPY[overall].title}</h1>
        <p className="mx-auto mt-2 max-w-xs text-lg text-muted-foreground">{COPY[overall].sub}</p>
      </div>

      <ul className={cn(cardCls, "divide-y divide-border px-4")}>
        {results.map(({ contact, status }) => {
          const s = STATUS[status];
          return (
            <li key={contact.id} className="flex items-center gap-3 py-3">
              <Avatar name={contact.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold">{contact.name}</p>
                <p className="text-sm text-muted-foreground">{formatPH(contact.phone)}</p>
              </div>
              <Chip tone={s.tone}>
                <s.icon className="h-4 w-4" aria-hidden="true" />
                {s.label}
              </Chip>
            </li>
          );
        })}
        {results.length === 0 && (
          <li className="py-4 text-base text-muted-foreground">No contacts were saved.</li>
        )}
      </ul>

      <dl className={cn(cardCls, "grid grid-cols-2 gap-3 p-4")}>
        <div>
          <dt className="text-sm text-muted-foreground">Location</dt>
          <dd className="text-base font-bold">
            {location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : "Not available"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Time</dt>
          <dd className="text-base font-bold">
            {sentAt
              ? new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "Not sent"}
          </dd>
        </div>
      </dl>

      <button type="button" onClick={backHome} className={cn(btnPrimary, "mt-auto")}>
        Back to home
      </button>
    </div>
  );
}
