import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const splashLogoUrl = "/codeher-splash.png";
const SPLASH_HOLD_MS = 1950;
const SPLASH_FADE_MS = 380;

/** Launch splash: stacked logo fades in once per app start, then fades out. */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), SPLASH_HOLD_MS);
    const t2 = setTimeout(onDone, SPLASH_HOLD_MS + SPLASH_FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);
  return (
    <button
      type="button"
      aria-label="Code:HER is loading. Tap to continue."
      onClick={onDone}
      className={cn(
        "flex flex-1 cursor-default flex-col items-center justify-center gap-6 px-8",
        leaving ? "animate-splash-out" : "animate-splash-in",
      )}
    >
      <img src={splashLogoUrl} alt="Code:HER" className="w-52" draggable={false} />
      <span className="text-center">
        <span className="block text-sm font-bold uppercase tracking-widest text-coral-ink">
          Offline voice SOS
        </span>
        <span className="mt-1 block text-base text-muted-foreground">
          Your voice is your lifeline.
        </span>
      </span>
    </button>
  );
}
