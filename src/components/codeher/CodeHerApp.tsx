import { useCallback, useEffect, useState } from "react";
import { useCodeHer, type Phase } from "./store";
import { Frame } from "./Shell";
import { SplashScreen } from "./SplashScreen";
import { OnboardingScreen } from "./OnboardingScreen";
import { HomeScreen } from "./HomeScreen";
import { ContactsScreen } from "./ContactsScreen";
import { SettingsScreen } from "./SettingsScreen";
import { CountdownScreen } from "./CountdownScreen";
import { HandoffScreen } from "./HandoffScreen";
import { ResultScreen } from "./ResultScreen";
import { TestDoneScreen } from "./TestDoneScreen";

const ALERT_PHASES: readonly Phase[] = ["detected", "countdown", "locating", "sending"];
const RESULT_PHASES: readonly Phase[] = ["sent", "queued", "failed"];

/** Picks the screen from the state machine; tabs only show when idle. */
export function CodeHerApp({ showSplash = true }: { showSplash?: boolean }) {
  const { phase, tab, settings } = useCodeHer();
  const [splash, setSplash] = useState(showSplash);
  const dismissSplash = useCallback(() => setSplash(false), []);
  // Each screen starts at the top; scroll must not carry over between screens.
  const screenKey = `${splash}:${phase}:${settings.onboarded}:${tab}`;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screenKey]);

  if (splash) {
    return (
      <Frame tabs={false} header={false}>
        <SplashScreen onDone={dismissSplash} />
      </Frame>
    );
  }
  if (ALERT_PHASES.includes(phase)) {
    return (
      <Frame tabs={false} header={false}>
        <CountdownScreen />
      </Frame>
    );
  }
  if (phase === "handoff") {
    return (
      <Frame tabs={false} header={false}>
        <HandoffScreen />
      </Frame>
    );
  }
  if (phase === "tested") {
    return (
      <Frame tabs={false} header={false}>
        <TestDoneScreen />
      </Frame>
    );
  }
  if (RESULT_PHASES.includes(phase)) {
    return (
      <Frame tabs={false} header={false}>
        <ResultScreen />
      </Frame>
    );
  }
  if (!settings.onboarded) {
    return (
      <Frame tabs={false}>
        <OnboardingScreen />
      </Frame>
    );
  }
  return (
    <Frame>
      {tab === "home" && <HomeScreen />}
      {tab === "contacts" && <ContactsScreen />}
      {tab === "settings" && <SettingsScreen />}
    </Frame>
  );
}
