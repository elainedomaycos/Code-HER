import { useState } from "react";
import { MapPin, ShieldCheck, Pause, Play, AudioLines, Plus, Pencil, Trash2, CheckCircle2, Clock, XCircle, Mic, Check } from "lucide-react";
import { useCodeHer } from "./store";
import { cn } from "@/lib/utils";
import { normalizePH, formatPH } from "@/lib/phone";
import type { Contact } from "@/services/types";

const btnPrimary = "flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition disabled:opacity-50";
const btnOutline = "flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-semibold text-foreground shadow-soft active:scale-[0.98] transition";

export function HomeScreen() {
  const { phase, togglePause, location } = useCodeHer();
  const paused = phase === "paused";
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-10">
      <div className="text-center">
        <p className={cn("flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest", paused ? "text-muted-foreground" : "text-primary")}>
          <span className={cn("h-2 w-2 rounded-full", paused ? "bg-paused" : "bg-success")} />
          {paused ? "Monitoring paused" : "Monitoring active"}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">{paused ? "Monitoring paused" : "You're covered."}</h1>
      </div>
      <div className="relative mx-auto mt-8 grid h-48 w-48 place-items-center">
        {!paused && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary" />}
        <div className={cn("relative grid h-48 w-48 place-items-center rounded-full text-primary-foreground transition-colors", paused ? "bg-paused-orb" : "bg-coral-orb shadow-glow")}>
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-start"><MapPin className="h-12 w-12" strokeWidth={1.75} /><AudioLines className="h-6 w-6" /></div>
            <span className="text-xs font-bold uppercase tracking-widest">{paused ? "Paused" : "Voice Listening"}</span>
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">{paused ? "Not listening right now" : "Listening on this device"}</p>
      <div className="mt-auto space-y-3 pt-8">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary"><MapPin className="h-4 w-4" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your location{location.isLastKnown && " · last known"}</p>
              <p className="text-sm font-bold">Lat: {location.lat.toFixed(4)}, Long: {location.lng.toFixed(4)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-success"><ShieldCheck className="h-4 w-4" /></span>
            <p className="flex-1 text-sm font-bold">Background Voice Trigger: {paused ? "PAUSED" : "ACTIVE"}</p>
            <span className={cn("h-2 w-2 rounded-full", paused ? "bg-paused" : "bg-success")} />
          </div>
        </div>
        <button onClick={togglePause} className={btnOutline}>
          {paused ? <><Play className="h-4 w-4" /> Resume monitoring</> : <><Pause className="h-4 w-4" /> Pause monitoring</>}
        </button>
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Private · Works without internet</p>
      </div>
    </div>
  );
}

export function CountdownScreen() {
  const { phase, countdown, cancel } = useCodeHer();
  const sending = phase === "locating" || phase === "sending";
  const R = 76, Cc = 2 * Math.PI * R;
  const status = phase === "locating" ? "Getting your location" : phase === "sending" ? "Sending offline SMS" : "Preparing offline dispatch";
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-10" role="alert">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-primary">Emergency alert</p>
      <h1 className="mx-auto mt-3 max-w-xs text-center text-xl font-extrabold leading-snug">
        {sending ? "Dispatching offline SMS…" : `Distress phrase detected. Sending in ${countdown} seconds unless you cancel.`}
      </h1>
      <div className="relative mx-auto mt-10 grid h-48 w-48 place-items-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 176 176">
          <circle cx="88" cy="88" r={R} className="fill-card stroke-secondary" strokeWidth="10" />
          <circle cx="88" cy="88" r={R} className="fill-none stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear" strokeWidth="10" strokeLinecap="round"
            strokeDasharray={Cc} strokeDashoffset={sending ? 0 : Cc * (1 - countdown / 10)} />
        </svg>
        <span className="relative text-5xl font-extrabold tabular-nums">00:{String(countdown).padStart(2, "0")}</span>
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />{status}
      </p>
      <div className="mt-auto border-t border-border pt-5">
        <button onClick={cancel} disabled={sending} className={btnPrimary}>Cancel Request</button>
        <p className="mt-2 text-center text-xs text-muted-foreground">Cancel within 10 seconds to stop this alert.</p>
      </div>
    </div>
  );
}

const chip = {
  sent: { cls: "bg-success/15 text-success", icon: CheckCircle2, label: "Sent" },
  queued: { cls: "bg-warning/20 text-foreground", icon: Clock, label: "Queued" },
  failed: { cls: "bg-destructive/15 text-destructive", icon: XCircle, label: "Failed" },
};

export function SentScreen() {
  const { phase, results, location, sentAt, backHome } = useCodeHer();
  const title = phase === "sent" ? "Alert sent" : phase === "queued" ? "Alert queued" : "Alert failed";
  const sub = phase === "sent" ? "Your trusted contacts have your location."
    : phase === "queued" ? "No signal. We'll retry automatically when signal returns." : "Messages could not be sent. Try calling directly.";
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-10">
      <div className={cn("mx-auto grid h-16 w-16 place-items-center rounded-full", chip[phase as "sent"]?.cls)}>
        {(() => { const I = chip[phase as "sent"]?.icon ?? CheckCircle2; return <I className="h-8 w-8" />; })()}
      </div>
      <h1 className="mt-4 text-center text-2xl font-extrabold">{title}</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">{sub}</p>
      <div className="mt-6 rounded-2xl border border-border p-4 shadow-soft">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Coordinates sent</p>
        <p className="text-sm font-bold">{location.lat.toFixed(5)}, {location.lng.toFixed(5)} <span className="font-normal text-muted-foreground">(~{location.accuracy}m)</span></p>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Time</p>
        <p className="text-sm font-bold">{sentAt ? new Date(sentAt).toLocaleString() : "—"}</p>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {results.map(({ contact, status }) => {
          const c = chip[status];
          return (
            <li key={contact.id} className="flex items-center gap-3 py-3">
              <Avatar name={contact.name} />
              <div className="flex-1"><p className="text-sm font-bold">{contact.name}</p><p className="text-xs text-muted-foreground">{formatPH(contact.phone)}</p></div>
              <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", c.cls)}><c.icon className="h-3.5 w-3.5" />{c.label}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto pt-6"><button onClick={backHome} className={btnPrimary}>Back to home</button></div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const i = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">{i}</span>;
}

export function ContactsScreen() {
  const { contacts, setContacts } = useCodeHer();
  const [edit, setEdit] = useState<Contact | "new" | null>(null);
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-6">
      <h1 className="text-2xl font-extrabold">Emergency contacts</h1>
      <p className="text-sm text-muted-foreground">Your trusted people, ready when you need them. Up to 2.</p>
      <ul className="mt-5 divide-y divide-border border-y border-border">
        {contacts.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-4">
            <Avatar name={c.name} />
            <div className="flex-1"><p className="text-sm font-bold">{c.name}</p><p className="text-xs text-muted-foreground">{formatPH(c.phone)}</p></div>
            <button aria-label={`Edit ${c.name}`} onClick={() => setEdit(c)} className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground"><Pencil className="h-4 w-4" /></button>
            <button aria-label={`Delete ${c.name}`} onClick={() => setContacts(contacts.filter((x) => x.id !== c.id))} className="grid h-11 w-11 place-items-center rounded-full text-destructive"><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
        {contacts.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No contacts yet.</li>}
      </ul>
      {edit && (
        <ContactForm initial={edit === "new" ? undefined : edit} onCancel={() => setEdit(null)}
          onSave={(c) => {
            setContacts(edit === "new" ? [...contacts, c] : contacts.map((x) => (x.id === c.id ? c : x)));
            setEdit(null);
          }} />
      )}
      <PhrasePanel />
      <div className="mt-auto pt-6">
        <button disabled={contacts.length >= 2 || !!edit} onClick={() => setEdit("new")} className={btnPrimary}>
          <Plus className="h-5 w-5" /> Add Contact
        </button>
        {contacts.length >= 2 && <p className="mt-2 text-center text-xs text-muted-foreground">Maximum of 2 contacts reached.</p>}
      </div>
    </div>
  );
}

function ContactForm({ initial, onSave, onCancel }: { initial?: Contact; onSave: (c: Contact) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial ? formatPH(initial.phone) : "+63 ");
  const [err, setErr] = useState("");
  const input = "min-h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring";
  return (
    <form className="mt-4 space-y-3 rounded-2xl border border-border p-4 shadow-soft" onSubmit={(e) => {
      e.preventDefault();
      const n = name.trim();
      if (!n || n.length > 60) return setErr("Enter a name (max 60 characters).");
      const p = normalizePH(phone);
      if (!p) return setErr("Enter a valid PH mobile number, e.g. +63 917 123 4567.");
      onSave({ id: initial?.id ?? crypto.randomUUID(), name: n, phone: p });
    }}>
      <input aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className={input} maxLength={60} />
      <input aria-label="Phone number" inputMode="tel" placeholder="+63 9XX XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className={btnOutline}>Cancel</button>
        <button type="submit" className={btnOutline + " border-primary text-primary"}>Save</button>
      </div>
    </form>
  );
}

const presets = ["Tulong", "Help me", "Saklolo"];

function PhrasePanel() {
  const { settings, setSettings } = useCodeHer();
  const [custom, setCustom] = useState(presets.includes(settings.safePhrase) ? "" : settings.safePhrase);
  const [tested, setTested] = useState(false);
  return (
    <section className="mt-6">
      <h2 className="text-lg font-extrabold">Safe phrase</h2>
      <p className="text-sm text-muted-foreground">Say this to trigger an alert.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button key={p} onClick={() => { setSettings({ ...settings, safePhrase: p }); setCustom(""); }}
            className={cn("min-h-11 rounded-full border px-4 text-sm font-semibold",
              settings.safePhrase === p ? "border-primary bg-secondary text-secondary-foreground" : "border-border")}>
            {p}
          </button>
        ))}
      </div>
      <input aria-label="Custom safe word" placeholder="Or type a custom safe word" value={custom} maxLength={30}
        onChange={(e) => { setCustom(e.target.value); if (e.target.value.trim()) setSettings({ ...settings, safePhrase: e.target.value.trim() }); }}
        className="mt-3 min-h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring" />
      <button onClick={() => { setTested(true); navigator.vibrate?.(150); setTimeout(() => setTested(false), 2500); }} className={btnOutline + " mt-3"}>
        {tested ? <><Check className="h-4 w-4 text-success" /> "{settings.safePhrase}" recognized</> : <><Mic className="h-4 w-4" /> Test phrase</>}
      </button>
      <label className="mt-4 flex min-h-12 items-center justify-between rounded-xl border border-dashed border-border px-4 text-sm">
        <span><span className="font-semibold">Demo:</span> simulate no signal</span>
        <input type="checkbox" className="h-5 w-5 accent-primary" checked={settings.simulateNoSignal}
          onChange={(e) => setSettings({ ...settings, simulateNoSignal: e.target.checked })} />
      </label>
      <p className="mt-2 text-xs text-muted-foreground">Tip: long-press the logo to simulate the phrase being heard.</p>
    </section>
  );
}

export function SosTab() {
  const { trigger, phase, settings } = useCodeHer();
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-10 text-center">
      <h1 className="text-2xl font-extrabold">Emergency SOS</h1>
      <p className="mt-2 text-sm text-muted-foreground">Say <span className="font-bold text-foreground">"{settings.safePhrase}"</span> anytime, or start an alert manually.</p>
      <div className="mt-auto">
        <button onClick={trigger} disabled={phase === "paused"} className={btnPrimary}>Send SOS now</button>
        {phase === "paused" && <p className="mt-2 text-xs text-muted-foreground">Resume monitoring on Home to use SOS.</p>}
      </div>
    </div>
  );
}
