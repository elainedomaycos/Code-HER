import type { ReactNode } from "react";
import { Home, Users, Settings as SettingsIcon, SignalZero } from "lucide-react";
import { useCodeHer, type Tab } from "./store";
import { cn } from "@/lib/utils";

const logoUrl = "/codeher-logo.png";

// The logo is not a control. A hidden long press used to start an alert
// from any tab; a stray press could text a contact, so tests now only start
// from the visible Test buttons on Home and in Settings.
export function Header() {
  const { online, settings, smsMode } = useCodeHer();
  const noSignal = smsMode === "native" && settings.simulateNoSignal;
  return (
    <header className="sticky top-0 z-10 flex min-h-[4.5rem] items-center justify-between bg-background/95 px-4 py-3 backdrop-blur">
      <img src={logoUrl} alt="Code:HER" className="h-8 w-auto select-none" draggable={false} />
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {noSignal ? (
          <>
            <SignalZero className="h-4 w-4 text-warning" aria-hidden="true" />
            No signal. Will retry.
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
            {online ? "Works without internet" : "Offline. Still works."}
          </>
        )}
      </p>
    </header>
  );
}

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export function TabBar() {
  const { tab, setTab } = useCodeHer();
  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-10 grid grid-cols-3 border-t border-border bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur"
    >
      {TABS.map(({ id, label, icon: I }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => setTab(id)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-sm font-semibold",
              active ? "text-coral-ink" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid h-8 w-14 place-items-center rounded-full",
                active && "bg-secondary",
              )}
            >
              <I className="h-5 w-5" aria-hidden="true" />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export function Frame({
  children,
  tabs = true,
  header = true,
}: {
  children: ReactNode;
  tabs?: boolean;
  header?: boolean;
}) {
  return (
    <div className="flex min-h-dvh justify-center bg-background sm:bg-secondary/40 sm:py-6">
      <div className="relative flex min-h-dvh w-full max-w-md flex-col bg-background sm:min-h-[820px] sm:rounded-[2.5rem] sm:shadow-soft">
        {header && <Header />}
        <main className="flex flex-1 flex-col">{children}</main>
        {tabs && <TabBar />}
      </div>
    </div>
  );
}
