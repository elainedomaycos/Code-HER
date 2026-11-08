import { Lock, MapPin, Mic, TimerReset } from "lucide-react";
import { useCodeHer } from "./store";
import { PermissionsList } from "./PermissionsList";
import { btnInk, ScreenTitle } from "./ui";

const FIRST_STEPS = [
  { icon: Mic, title: "Say your SOS phrase", text: "Or hold the SOS button." },
  { icon: TimerReset, title: "You get 10 seconds to cancel", text: "In case it was a mistake." },
] as const;
const LAST_STEP = {
  native: { icon: MapPin, title: "Your contacts get a text", text: "With where you are." },
  handoff: {
    icon: MapPin,
    title: "You send the text",
    text: "Messages opens with your alert and location ready.",
  },
} as const;

/** §7 screen 1: what happens, privacy, permissions. Shown until done. */
export function OnboardingScreen() {
  const { settings, setSettings, permissions, refreshPermissions, smsMode } = useCodeHer();
  const how = [...FIRST_STEPS, LAST_STEP[smsMode]];
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pb-8 pt-6">
      <ScreenTitle title="Call for help with your voice" subtitle="Here is how it works." />
      <ol className="space-y-4">
        {how.map(({ icon: I, title, text }) => (
          <li key={title} className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary text-coral-ink"
            >
              <I className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-base font-bold">{title}</span>
              <span className="block text-sm text-muted-foreground">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="flex items-start gap-3 rounded-2xl bg-success/10 p-4 text-sm text-foreground/80">
        <Lock className="h-5 w-5 shrink-0 text-success-ink" aria-hidden="true" />
        Audio is processed on this device. Nothing is recorded or uploaded.
      </p>
      <div>
        <h2 className="mb-3 text-lg font-extrabold">Allow access</h2>
        <PermissionsList permissions={permissions} onRefresh={refreshPermissions} />
      </div>
      <div className="mt-auto pt-2">
        <button
          type="button"
          onClick={() => setSettings({ ...settings, onboarded: true })}
          className={btnInk}
        >
          Get started
        </button>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          You can change these anytime in Settings.
        </p>
      </div>
    </div>
  );
}
