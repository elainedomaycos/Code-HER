import { useRef, type ReactNode } from "react";
import { Home, Radio, Users, WifiOff, Wifi, SignalZero } from "lucide-react";
import logo from "@/assets/codeher-logo.png.asset.json";
import { useCodeHer, type Tab } from "./store";
import { cn } from "@/lib/utils";

export function Header() {
  const { trigger, online, settings } = useCodeHer();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = () => { timer.current = setTimeout(trigger, 700); };
  const end = () => clearTimeout(timer.current);
  return (
    <header className="flex items-center justify-between border-b border-border px-5 pb-3 pt-5">
      <button
        aria-label="Code:HER (long-press to simulate phrase detected)"
        onPointerDown={start} onPointerUp={end} onPointerLeave={end}
        onContextMenu={(e) => e.preventDefault()}
        className="select-none"
      >
        <img src={logo.url} alt="Code:HER" className="h-9 w-auto" draggable={false} />
      </button>
      <div className="flex flex-col items-end gap-1">
        <span className="flex items-center gap-1.5 rounded-full border border-secondary bg-secondary/60 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
          {online ? <WifiOff className="h-3 w-3" /> : <span className="h-2 w-2 rounded-full bg-primary" />}
          {online ? "Offline ready" : "Offline mode"}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
          {settings.simulateNoSignal ? <><SignalZero className="h-3 w-3 text-warning" /> No signal, will retry</>
            : <><Wifi className="h-3 w-3 text-success" /> No internet needed</>}
        </span>
      </div>
    </header>
  );
}

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "sos", label: "SOS", icon: Radio },
  { id: "contacts", label: "Contacts", icon: Users },
];

export function TabBar() {
  const { tab, setTab } = useCodeHer();
  return (
    <nav className="grid grid-cols-3 border-t border-border bg-card pb-3 pt-2">
      {tabs.map(({ id, label, icon: I }) => (
        <button key={id} onClick={() => setTab(id)}
          className={cn("flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium",
            tab === id ? "text-primary" : "text-muted-foreground")}>
          <I className="h-5 w-5" />{label}
        </button>
      ))}
    </nav>
  );
}

export function Frame({ children, tabs = true }: { children: ReactNode; tabs?: boolean }) {
  return (
    <div className="flex min-h-screen justify-center bg-secondary/40 sm:py-6">
      <div className="flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-card shadow-soft sm:min-h-[820px] sm:rounded-[2.5rem]">
        <Header />
        <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
        {tabs && <TabBar />}
      </div>
    </div>
  );
}
