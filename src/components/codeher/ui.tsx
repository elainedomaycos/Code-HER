// Small shared building blocks for the Code:HER screens.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const btnPrimary =
  "flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary-strong px-5 text-lg font-bold text-primary-foreground shadow-soft transition active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none";
/** Calm dark fill for main actions that are not the emergency (red stays for SOS). */
export const btnInk =
  "flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-lg font-bold text-background shadow-soft transition active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none";
export const btnSecondary =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 text-base font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none";
export const btnText =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-base font-semibold text-coral-ink underline-offset-4 hover:underline disabled:opacity-50";
export const inputCls =
  "min-h-12 w-full rounded-xl border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus:border-ring";
export const cardCls = "rounded-3xl border border-border bg-card shadow-soft";

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div>
      <h1 className="text-balance text-[1.75rem] font-extrabold leading-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-balance text-base text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function Section({
  id,
  title,
  hint,
  children,
}: {
  id?: string;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20">
      <h2 id={headingId} className="text-lg font-extrabold">
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "sm" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-secondary font-bold text-secondary-foreground",
        size === "md" ? "h-12 w-12 text-sm" : "h-10 w-10 text-xs",
      )}
    >
      {initials || "?"}
    </span>
  );
}

/** Accessible on/off switch with a full-row 48px+ touch target. */
export function SwitchRow({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left"
    >
      <span>
        <span className="block text-base font-semibold">{label}</span>
        {detail && <span className="mt-0.5 block text-sm text-muted-foreground">{detail}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none",
          checked ? "bg-success-ink" : "bg-paused",
        )}
      >
        <span
          className={cn(
            "inline-block h-6 w-6 rounded-full bg-card shadow transition-transform motion-reduce:transition-none",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export type ChipTone = "ok" | "wait" | "bad" | "neutral";

const chipTone: Record<ChipTone, string> = {
  ok: "bg-success/15 text-success-ink",
  wait: "bg-warning-soft text-foreground",
  bad: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-bold",
        chipTone[tone],
      )}
    >
      {children}
    </span>
  );
}
