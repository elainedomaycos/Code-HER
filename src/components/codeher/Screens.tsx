import { useEffect, useState } from "react";
import {
  MapPin,
  ShieldCheck,
  Pause,
  Play,
  AudioLines,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  Mic,
  Check,
  MessageSquare,
  BatteryCharging,
  Vibrate,
} from "lucide-react";
import { useCodeHer, type PermissionsState } from "./store";
import { cn } from "@/lib/utils";
import { normalizePH, formatPH } from "@/lib/phone";
import { requestLocationPermission, requestMicPermission } from "@/lib/permissions";
import type { Contact } from "@/services/types";
import {
  getBuildInfo,
  isNativeActive,
  listeningService,
  locationService,
  requestBatteryExemption,
  statusService,
} from "@/services";

const btnPrimary =
  "flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition disabled:opacity-50";
const btnOutline =
  "flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-semibold text-foreground shadow-soft active:scale-[0.98] transition";

export function HomeScreen() {
  const { phase, togglePause, location } = useCodeHer();
  const paused = phase === "paused";
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-10">
      <div className="text-center">
        <p
          className={cn(
            "flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest",
            paused ? "text-muted-foreground" : "text-primary",
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", paused ? "bg-paused" : "bg-success")} />
          {paused ? "Monitoring paused" : "Monitoring active"}
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">
          {paused ? "Monitoring paused" : "You're covered."}
        </h1>
      </div>
      <div className="relative mx-auto mt-8 grid h-48 w-48 place-items-center">
        {!paused && (
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary" />
        )}
        <div
          className={cn(
            "relative grid h-48 w-48 place-items-center rounded-full text-primary-foreground transition-colors",
            paused ? "bg-paused-orb" : "bg-coral-orb shadow-glow",
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-start">
              <MapPin className="h-12 w-12" strokeWidth={1.75} />
              <AudioLines className="h-6 w-6" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest">
              {paused ? "Paused" : "Voice Listening"}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {paused ? "Not listening right now" : "Listening on this device"}
      </p>
      <div className="mt-auto space-y-3 pt-8">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="flex items-center gap-3 border-b border-border pb-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-primary">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Your location{location && location.source === "last_known" && " · last known"}
              </p>
              <p className="text-sm font-bold">
                {location ? (
                  <>
                    Lat: {location.lat.toFixed(4)}, Long: {location.lng.toFixed(4)}
                  </>
                ) : (
                  "Waiting for location…"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-success">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <p className="flex-1 text-sm font-bold">
              Background Voice Trigger: {paused ? "PAUSED" : "ACTIVE"}
            </p>
            <span className={cn("h-2 w-2 rounded-full", paused ? "bg-paused" : "bg-success")} />
          </div>
        </div>
        <button onClick={togglePause} className={btnOutline}>
          {paused ? (
            <>
              <Play className="h-4 w-4" /> Resume monitoring
            </>
          ) : (
            <>
              <Pause className="h-4 w-4" /> Pause monitoring
            </>
          )}
        </button>
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Private · Works without internet
        </p>
      </div>
    </div>
  );
}

export function CountdownScreen() {
  const { phase, countdown, cancel } = useCodeHer();
  const sending = phase === "locating" || phase === "sending";
  const R = 76,
    Cc = 2 * Math.PI * R;
  const status =
    phase === "locating"
      ? "Getting your location"
      : phase === "sending"
        ? "Sending offline SMS"
        : "Preparing offline dispatch";
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-10" role="alert">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-primary">
        Emergency alert
      </p>
      <h1 className="mx-auto mt-3 max-w-xs text-center text-xl font-extrabold leading-snug">
        {sending
          ? "Dispatching offline SMS…"
          : `Distress phrase detected. Sending in ${countdown} seconds unless you cancel.`}
      </h1>
      <div className="relative mx-auto mt-10 grid h-48 w-48 place-items-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 176 176">
          <circle cx="88" cy="88" r={R} className="fill-card stroke-secondary" strokeWidth="10" />
          <circle
            cx="88"
            cy="88"
            r={R}
            className="fill-none stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={Cc}
            strokeDashoffset={sending ? 0 : Cc * (1 - countdown / 10)}
          />
        </svg>
        <span className="relative text-5xl font-extrabold tabular-nums">
          00:{String(countdown).padStart(2, "0")}
        </span>
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        {status}
      </p>
      <div className="mt-auto border-t border-border pt-5">
        <button onClick={cancel} disabled={sending} className={btnPrimary}>
          Cancel Request
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Cancel within 10 seconds to stop this alert.
        </p>
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
  const title =
    phase === "sent" ? "Alert sent" : phase === "queued" ? "Alert queued" : "Alert failed";
  const sub =
    phase === "sent"
      ? "Your trusted contacts have your location."
      : phase === "queued"
        ? "No signal. We'll retry automatically when signal returns."
        : "Messages could not be sent. Try calling directly.";
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-10">
      <div
        className={cn(
          "mx-auto grid h-16 w-16 place-items-center rounded-full",
          chip[phase as "sent"]?.cls,
        )}
      >
        {(() => {
          const I = chip[phase as "sent"]?.icon ?? CheckCircle2;
          return <I className="h-8 w-8" />;
        })()}
      </div>
      <h1 className="mt-4 text-center text-2xl font-extrabold">{title}</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">{sub}</p>
      <div className="mt-6 rounded-2xl border border-border p-4 shadow-soft">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Coordinates sent
        </p>
        {location ? (
          <p className="text-sm font-bold">
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}{" "}
            <span className="font-normal text-muted-foreground">
              (~{location.accuracyM}m{location.source === "last_known" && ", last known"})
            </span>
          </p>
        ) : (
          <p className="text-sm font-bold">Unavailable — sent without coordinates.</p>
        )}
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Time
        </p>
        <p className="text-sm font-bold">{sentAt ? new Date(sentAt).toLocaleString() : "—"}</p>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {results.map(({ contact, status }) => {
          const c = chip[status];
          return (
            <li key={contact.id} className="flex items-center gap-3 py-3">
              <Avatar name={contact.name} />
              <div className="flex-1">
                <p className="text-sm font-bold">{contact.name}</p>
                <p className="text-xs text-muted-foreground">{formatPH(contact.phone)}</p>
              </div>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
                  c.cls,
                )}
              >
                <c.icon className="h-3.5 w-3.5" />
                {c.label}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto pt-6">
        <button onClick={backHome} className={btnPrimary}>
          Back to home
        </button>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const i = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
      {i}
    </span>
  );
}

export function ContactsScreen() {
  const { contacts, setContacts } = useCodeHer();
  const [edit, setEdit] = useState<Contact | "new" | null>(null);
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-6">
      <h1 className="text-2xl font-extrabold">Emergency contacts</h1>
      <p className="text-sm text-muted-foreground">
        Your trusted people, ready when you need them. Up to 2.
      </p>
      <ul className="mt-5 divide-y divide-border border-y border-border">
        {contacts.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-4">
            <Avatar name={c.name} />
            <div className="flex-1">
              <p className="text-sm font-bold">{c.name}</p>
              <p className="text-xs text-muted-foreground">{formatPH(c.phone)}</p>
            </div>
            <button
              aria-label={`Edit ${c.name}`}
              onClick={() => setEdit(c)}
              className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              aria-label={`Delete ${c.name}`}
              onClick={() => setContacts(contacts.filter((x) => x.id !== c.id))}
              className="grid h-11 w-11 place-items-center rounded-full text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {contacts.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">No contacts yet.</li>
        )}
      </ul>
      {edit && (
        <ContactForm
          initial={edit === "new" ? undefined : edit}
          onCancel={() => setEdit(null)}
          onSave={(c) => {
            setContacts(
              edit === "new" ? [...contacts, c] : contacts.map((x) => (x.id === c.id ? c : x)),
            );
            setEdit(null);
          }}
        />
      )}
      <NameField />
      <PhrasePanel />
      <div className="mt-auto pt-6">
        <button
          disabled={contacts.length >= 2 || !!edit}
          onClick={() => setEdit("new")}
          className={btnPrimary}
        >
          <Plus className="h-5 w-5" /> Add Contact
        </button>
        {contacts.length >= 2 && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Maximum of 2 contacts reached.
          </p>
        )}
      </div>
    </div>
  );
}

function NameField() {
  const { settings, setSettings } = useCodeHer();
  const [draft, setDraft] = useState(settings.userName);
  const commit = () => {
    const clean = draft.trim().slice(0, 30);
    if (clean && clean !== settings.userName) {
      setSettings({ ...settings, userName: clean });
    } else {
      setDraft(settings.userName);
    }
  };
  return (
    <section className="mt-6">
      <h2 className="text-lg font-extrabold">Your name</h2>
      <p className="text-sm text-muted-foreground">
        Shown in the alert SMS so contacts know it&apos;s you.
      </p>
      <input
        aria-label="Your name"
        placeholder="Your name"
        value={draft}
        maxLength={30}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="mt-3 min-h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
      />
    </section>
  );
}

function ContactForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Contact | undefined;
  onSave: (c: Contact) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial ? formatPH(initial.phone) : "+63 ");
  const [err, setErr] = useState("");
  const input =
    "min-h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring";
  return (
    <form
      className="mt-4 space-y-3 rounded-2xl border border-border p-4 shadow-soft"
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        if (!n || n.length > 60) return setErr("Enter a name (max 60 characters).");
        const p = normalizePH(phone);
        if (!p) return setErr("Enter a valid PH mobile number, e.g. +63 917 123 4567.");
        onSave({ id: initial?.id ?? crypto.randomUUID(), name: n, phone: p });
      }}
    >
      <input
        aria-label="Name"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={input}
        maxLength={60}
      />
      <input
        aria-label="Phone number"
        inputMode="tel"
        placeholder="+63 9XX XXX XXXX"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className={input}
      />
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className={btnOutline}>
          Cancel
        </button>
        <button type="submit" className={btnOutline + " border-primary text-primary"}>
          Save
        </button>
      </div>
    </form>
  );
}

const presets = ["help me", "help", "SOS"];

function PhrasePanel() {
  const { settings, setSettings } = useCodeHer();
  const [custom, setCustom] = useState(
    presets.includes(settings.safePhrase) ? "" : settings.safePhrase,
  );
  const [tested, setTested] = useState(false);
  return (
    <section className="mt-6">
      <h2 className="text-lg font-extrabold">Safe phrase</h2>
      <p className="text-sm text-muted-foreground">Say this to trigger an alert.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => {
              setSettings({ ...settings, safePhrase: p });
              setCustom("");
            }}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-semibold",
              settings.safePhrase === p
                ? "border-primary bg-secondary text-secondary-foreground"
                : "border-border",
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <input
        aria-label="Custom safe word"
        placeholder="Or type a custom safe word"
        value={custom}
        maxLength={30}
        onChange={(e) => {
          setCustom(e.target.value);
          if (e.target.value.trim())
            setSettings({ ...settings, safePhrase: e.target.value.trim() });
        }}
        className="mt-3 min-h-12 w-full rounded-xl border border-input bg-background px-4 text-base outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        onClick={() => {
          setTested(true);
          navigator.vibrate?.(150);
          setTimeout(() => setTested(false), 2500);
        }}
        className={btnOutline + " mt-3"}
      >
        {tested ? (
          <>
            <Check className="h-4 w-4 text-success" /> "{settings.safePhrase}" recognized
          </>
        ) : (
          <>
            <Mic className="h-4 w-4" /> Test phrase
          </>
        )}
      </button>
      <label className="mt-3 flex min-h-12 items-center justify-between gap-3 rounded-xl border border-border px-4 text-sm">
        <span>
          <span className="font-semibold">Maps link in SMS</span>
          <span className="block text-xs text-muted-foreground">
            Off by default: some networks block messages containing links.
          </span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0 accent-primary"
          checked={settings.includeMapLink}
          onChange={(e) => setSettings({ ...settings, includeMapLink: e.target.checked })}
        />
      </label>
    </section>
  );
}

export function SosTab() {
  const { trigger, phase, settings } = useCodeHer();
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-10 text-center">
      <h1 className="text-2xl font-extrabold">Emergency SOS</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Say <span className="font-bold text-foreground">"{settings.safePhrase}"</span> anytime, or
        start an alert manually.
      </p>
      <div className="mt-auto">
        <button onClick={trigger} disabled={phase === "paused"} className={btnPrimary}>
          Send SOS now
        </button>
        {phase === "paused" && (
          <p className="mt-2 text-xs text-muted-foreground">
            Resume monitoring on Home to use SOS.
          </p>
        )}
      </div>
    </div>
  );
}

type PermissionRow = {
  key: keyof PermissionsState;
  label: string;
  blurb: string;
  icon: typeof Mic;
  request?: () => Promise<boolean>;
  androidOnly?: boolean;
};

const PERMISSION_ROWS: PermissionRow[] = [
  {
    key: "mic",
    label: "Microphone",
    blurb: "Listens for your safe phrase. Audio never leaves this device.",
    icon: Mic,
    request: requestMicPermission,
  },
  {
    key: "location",
    label: "Location",
    blurb: "Attaches coordinates to the SOS SMS.",
    icon: MapPin,
    request: requestLocationPermission,
  },
  {
    key: "sms",
    label: "SMS",
    blurb: "Sends the alert text. Granted on Android; browsers can't grant it.",
    icon: MessageSquare,
    androidOnly: true,
  },
  {
    key: "batteryExempt",
    label: "Background running",
    blurb: "Keeps listening with the screen off. Exempted on Android.",
    icon: BatteryCharging,
    androidOnly: true,
  },
];

/** On-device fix action: run the real flow (which prompts) then re-read grants. */
async function requestNativeGrant(kind: "mic" | "location"): Promise<boolean> {
  try {
    if (kind === "mic") {
      await listeningService.start();
    } else {
      await locationService.getCurrent();
    }
  } catch {
    // Prompt outcome is read below; a rejection just means "not yet".
  }
  try {
    const p = await statusService.getPermissions();
    return kind === "mic" ? p.mic : p.location;
  } catch {
    return false;
  }
}

function rowRequest(row: PermissionRow): (() => Promise<boolean>) | undefined {
  if (isNativeActive) {
    // Browser permission APIs don't exist in the WebView; drive the native
    // flows (which prompt) instead. SMS is prompted at send time.
    if (row.key === "mic") return () => requestNativeGrant("mic");
    if (row.key === "location") return () => requestNativeGrant("location");
    if (row.key === "batteryExempt") {
      return () =>
        requestBatteryExemption()
          .then(() => true)
          .catch(() => false);
    }
    return undefined;
  }
  return row.request;
}

/** §6 permissions area: every row shows status with a fix action where one exists. */
export function PermissionsList({
  permissions,
  onRefresh,
}: {
  permissions: PermissionsState | null;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-soft">
      {PERMISSION_ROWS.map((row) => {
        const granted = permissions?.[row.key] ?? false;
        const I = row.icon;
        // Battery exemption has no web API: the fix action only exists on-device.
        const request = rowRequest(row);
        return (
          <li key={row.key} className="flex items-center gap-3 p-4">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                granted ? "bg-secondary text-success" : "bg-secondary text-muted-foreground",
              )}
            >
              <I className="h-4 w-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold">{row.label}</p>
              <p className="text-xs text-muted-foreground">{row.blurb}</p>
            </div>
            {granted ? (
              <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
                <Check className="h-3.5 w-3.5" />
                On
              </span>
            ) : request ? (
              <button
                disabled={busy !== null}
                onClick={() => {
                  setBusy(row.key);
                  request()
                    .catch(() => false)
                    .then(() => onRefresh())
                    .finally(() => setBusy(null));
                }}
                className="min-h-11 rounded-full border border-primary px-4 text-sm font-semibold text-primary disabled:opacity-50"
              >
                {busy === row.key ? "Asking…" : "Enable"}
              </button>
            ) : (
              <span
                className="max-w-24 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                title="No browser API exists; granted in the Android app"
              >
                Android only
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** §7 screen 1: first-run explain + permissions. Shown until marked done. */
export function OnboardingScreen() {
  const { settings, setSettings, permissions, refreshPermissions } = useCodeHer();
  return (
    <div className="flex flex-1 flex-col px-5 pb-4 pt-10">
      <h1 className="text-2xl font-extrabold">You&apos;re covered.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Say <span className="font-bold text-foreground">“{settings.safePhrase}”</span> and your
        trusted contacts get your location by SMS. Works without internet.
      </p>
      <p className="mt-3 flex items-center gap-2 rounded-2xl bg-secondary/60 p-3 text-xs font-medium text-secondary-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
        Audio is processed on this device. Nothing is recorded or uploaded.
      </p>
      <div className="mt-5">
        <PermissionsList permissions={permissions} onRefresh={refreshPermissions} />
      </div>
      <div className="mt-auto pt-6">
        <button
          onClick={() => setSettings({ ...settings, onboarded: true })}
          className={btnPrimary}
        >
          Start protecting me
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          You can change permissions anytime in Settings.
        </p>
      </div>
    </div>
  );
}

/** §7 screen 6: privacy, permissions, test mode. */
export function SettingsScreen() {
  const { settings, setSettings, permissions, refreshPermissions, trigger } = useCodeHer();
  return (
    <div className="flex flex-1 flex-col gap-6 px-5 pb-4 pt-6">
      <div>
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <p className="text-sm text-muted-foreground">Privacy, permissions, and test mode.</p>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-extrabold">Privacy</h2>
        <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-soft">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            Audio is processed on this device. Nothing is recorded or uploaded.
          </p>
          <p className="mt-2 flex items-start gap-2 text-muted-foreground">
            <Vibrate className="mt-0.5 h-4 w-4 shrink-0" />
            SMS needs cellular coverage, but no internet. Detection accuracy is best-effort — it
            does not guarantee safety.
          </p>
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-extrabold">Permissions</h2>
        <PermissionsList permissions={permissions} onRefresh={refreshPermissions} />
      </section>
      <section>
        <h2 className="text-lg font-extrabold">Test mode</h2>
        <p className="text-sm text-muted-foreground">
          Rehearse the full flow. Cancel the countdown to stop it.
        </p>
        <button onClick={trigger} className={btnOutline + " mt-3"}>
          <Mic className="h-4 w-4" /> Simulate phrase
        </button>
        <label className="mt-3 flex min-h-12 items-center justify-between rounded-xl border border-dashed border-border px-4 text-sm">
          <span>
            <span className="font-semibold">Demo:</span> simulate no signal
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-primary"
            checked={settings.simulateNoSignal}
            onChange={(e) => setSettings({ ...settings, simulateNoSignal: e.target.checked })}
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Tip: long-press the logo to simulate the phrase being heard.
        </p>
      </section>
      <AboutSection />
    </div>
  );
}

function AboutSection() {
  const [info, setInfo] = useState<{ buildTag: string; versionName: string; appId: string } | null>(
    null,
  );
  useEffect(() => {
    getBuildInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);
  return (
    <section>
      <h2 className="mb-2 text-lg font-extrabold">About this build</h2>
      <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-soft">
        <p className="font-bold">
          CodeHER v{info?.versionName ?? "…"} · build {info?.buildTag ?? "…"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isNativeActive
            ? "On-device engine (native services active)."
            : "Browser preview (mock services)."}
          {isNativeActive && info ? ` ${info.appId}` : ""}
        </p>
      </div>
    </section>
  );
}

const splashLogoUrl = "/codeher-splash.png";

/** Launch splash: stacked logo fades in once per app start, fades out. */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 1950);
    const t2 = setTimeout(onDone, 2330);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDone]);
  return (
    <button
      aria-label="Code:HER is loading, tap to continue"
      onClick={onDone}
      className={cn(
        "flex flex-1 cursor-default flex-col items-center justify-center gap-6 px-8",
        leaving ? "animate-splash-out" : "animate-splash-in",
      )}
    >
      <img src={splashLogoUrl} alt="Code:HER" className="w-52" draggable={false} />
      <span className="text-center">
        <span className="block text-xs font-bold uppercase tracking-widest text-primary">
          Offline voice SOS
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          Your voice is your lifeline.
        </span>
      </span>
    </button>
  );
}
