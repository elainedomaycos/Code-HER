import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** How long the SOS button must be held. Long enough to rule out a stray tap. */
export const HOLD_MS = 1500;

/**
 * Press and hold to confirm. Pointer and keyboard (Space or Enter) both
 * work; letting go early cancels. The fill shows progress while held.
 */
export function HoldButton({
  onComplete,
  label,
  holdingLabel,
  ariaLabel,
  icon,
  holdMs = HOLD_MS,
}: {
  onComplete: () => void;
  label: string;
  holdingLabel: string;
  ariaLabel: string;
  icon?: ReactNode;
  holdMs?: number;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const begin = () => {
    if (timer.current !== undefined) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      setHolding(false);
      onComplete();
    }, holdMs);
  };
  const end = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    setHolding(false);
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        begin();
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") end();
      }}
      onBlur={end}
      className="relative flex min-h-24 w-full touch-none select-none items-center justify-center overflow-hidden rounded-3xl bg-primary-strong px-6 text-primary-foreground shadow-glow"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 origin-left bg-primary-deep"
        style={{
          transform: holding ? "scaleX(1)" : "scaleX(0)",
          transition: holding ? `transform ${holdMs}ms linear` : "transform 150ms ease-out",
        }}
      />
      <span className="relative flex items-center gap-3 text-xl font-extrabold">
        {icon}
        {holding ? holdingLabel : label}
      </span>
      <span className="sr-only" aria-live="assertive">
        {holding ? holdingLabel : ""}
      </span>
    </button>
  );
}
