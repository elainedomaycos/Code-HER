import { useCallback, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CodeHerProvider, useCodeHer } from "@/components/codeher/store";
import { Frame } from "@/components/codeher/Shell";
import {
  HomeScreen,
  CountdownScreen,
  SentScreen,
  ContactsScreen,
  SosTab,
  OnboardingScreen,
  SettingsScreen,
  SplashScreen,
} from "@/components/codeher/Screens";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Code:HER — Offline Voice SOS" },
      {
        name: "description",
        content:
          "Voice-activated emergency SOS that works without internet. Say your safe phrase and trusted contacts get your location.",
      },
      { property: "og:title", content: "Code:HER — Offline Voice SOS" },
      {
        property: "og:description",
        content: "Voice-activated emergency SOS that works without internet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CodeHerProvider>
      <App />
    </CodeHerProvider>
  ),
});

function App() {
  const { phase, tab, settings } = useCodeHer();
  const [splash, setSplash] = useState(true);
  const dismissSplash = useCallback(() => setSplash(false), []);
  if (splash)
    return (
      <Frame tabs={false} header={false}>
        <SplashScreen onDone={dismissSplash} />
      </Frame>
    );
  if (["detected", "countdown", "locating", "sending"].includes(phase))
    return (
      <Frame tabs={false}>
        <CountdownScreen />
      </Frame>
    );
  if (["sent", "queued", "failed"].includes(phase))
    return (
      <Frame tabs={false}>
        <SentScreen />
      </Frame>
    );
  if (!settings.onboarded)
    return (
      <Frame tabs={false}>
        <OnboardingScreen />
      </Frame>
    );
  return (
    <Frame>
      {tab === "home" && <HomeScreen />}
      {tab === "sos" && <SosTab />}
      {tab === "contacts" && <ContactsScreen />}
      {tab === "settings" && <SettingsScreen />}
    </Frame>
  );
}
