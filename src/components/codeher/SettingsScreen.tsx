import { useEffect, useState } from "react";
import { FlaskConical, Lock, MessageSquareText, ShieldAlert } from "lucide-react";
import { getBuildInfo, isNativeActive, type BuildInfo } from "@/services";
import { cn } from "@/lib/utils";
import { useCodeHer } from "./store";
import { MessagePreview } from "./MessagePreview";
import { NameField } from "./NameField";
import { PermissionsList } from "./PermissionsList";
import { PhrasePanel } from "./PhrasePanel";
import { btnSecondary, cardCls, ScreenTitle, Section, SwitchRow } from "./ui";

function TestModeSection() {
  const { phase, startTest, settings, setSettings, smsMode } = useCodeHer();
  const paused = phase === "paused";
  return (
    <Section
      id="test-mode"
      title="Test mode"
      hint="Runs the full alert, countdown included. Nothing is sent."
    >
      <div className={cn(cardCls, "space-y-2 p-4")}>
        <button type="button" onClick={startTest} disabled={paused} className={btnSecondary}>
          <FlaskConical className="h-5 w-5 text-coral-ink" aria-hidden="true" />
          Try a test alert
        </button>
        {paused && (
          <p className="text-sm text-muted-foreground">Resume listening on Home to test.</p>
        )}
        {smsMode === "native" && (
          <SwitchRow
            label="Simulate no signal"
            detail="Shows what happens when a text cannot be sent."
            checked={settings.simulateNoSignal}
            onChange={(simulateNoSignal) => setSettings({ ...settings, simulateNoSignal })}
          />
        )}
      </div>
    </Section>
  );
}

const PRIVACY: { icon: typeof Lock; text: string }[] = [
  { icon: Lock, text: "Audio is processed on this device. Nothing is recorded or uploaded." },
  {
    icon: MessageSquareText,
    text: "Alerts go by text message. No internet needed, but you need cell signal.",
  },
  {
    icon: ShieldAlert,
    text: "Voice detection can miss words. The SOS button on Home always works.",
  },
];

function PrivacySection() {
  return (
    <Section id="privacy" title="Privacy">
      <ul className={cn(cardCls, "space-y-3 p-4")}>
        {PRIVACY.map(({ icon: I, text }) => (
          <li key={text} className="flex items-start gap-3 text-sm text-foreground/80">
            <I className="h-5 w-5 shrink-0 text-success-ink" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** "Version 1.2 (build abc)"; empty for the unversioned web dev build. */
function versionLine(info: BuildInfo | null): string {
  if (!info || info.versionName === "dev") return "";
  const build = info.buildTag && info.buildTag !== "browser" ? ` (build ${info.buildTag})` : "";
  return `Version ${info.versionName}${build}. `;
}

function AboutSection() {
  const [info, setInfo] = useState<BuildInfo | null>(null);
  useEffect(() => {
    getBuildInfo()
      .then(setInfo)
      .catch((e: unknown) => {
        console.error(e);
        setInfo(null);
      });
  }, []);
  return (
    <Section id="about" title="About">
      <div className={cn(cardCls, "p-4")}>
        <p className="text-base font-bold">{isNativeActive ? "Code:HER" : "Code:HER for web"}</p>
        <p className="mt-1 text-sm text-foreground/80">
          {versionLine(info)}
          {isNativeActive
            ? "Android app with an on-device voice engine."
            : "Voice runs offline in your browser. Messages opens to send the alert."}
        </p>
      </div>
    </Section>
  );
}

/** §7 screen 6: you, your phrase, the alert, test mode, privacy, permissions. */
export function SettingsScreen() {
  const { permissions, refreshPermissions } = useCodeHer();
  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pb-8 pt-2">
      <ScreenTitle title="Settings" />
      <Section id="name" title="Your name" hint="Shown in your alert so contacts know it is you.">
        <NameField />
      </Section>
      <Section id="phrase" title="SOS phrase" hint="Say this out loud to send an alert.">
        <PhrasePanel />
      </Section>
      <Section id="message" title="Message preview" hint="This is exactly what your contacts get.">
        <MessagePreview />
      </Section>
      <TestModeSection />
      <Section id="permissions" title="Permissions">
        <PermissionsList permissions={permissions} onRefresh={refreshPermissions} />
      </Section>
      <PrivacySection />
      <AboutSection />
    </div>
  );
}
