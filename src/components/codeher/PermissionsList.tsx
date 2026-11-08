import { useState } from "react";
import { BatteryCharging, Check, MapPin, MessageSquare, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCodeHer, type PermissionsState } from "./store";
import { permissionRequest, VISIBLE_PERMISSIONS, type PermissionKey } from "./permissionActions";
import { cardCls, Chip } from "./ui";

const ROWS: Record<PermissionKey, { label: string; blurb: string; icon: typeof Mic }> = {
  mic: {
    label: "Microphone",
    blurb: "Hears your SOS phrase. Audio never leaves this phone.",
    icon: Mic,
  },
  location: { label: "Location", blurb: "Adds where you are to the alert.", icon: MapPin },
  sms: {
    label: "Text messages",
    blurb: "Sends the alert. Asked the first time.",
    icon: MessageSquare,
  },
  batteryExempt: {
    label: "Run in background",
    blurb: "Keeps listening with the screen off.",
    icon: BatteryCharging,
  },
};

/** codeHER.md §6: each permission with its status and a fix action. */
export function PermissionsList({
  permissions,
  onRefresh,
}: {
  permissions: PermissionsState | null;
  onRefresh: () => void;
}) {
  const { phase } = useCodeHer();
  const [busy, setBusy] = useState<PermissionKey | null>(null);
  return (
    <ul className={cn(cardCls, "divide-y divide-border")}>
      {VISIBLE_PERMISSIONS.map((key) => {
        const row = ROWS[key];
        const granted = permissions?.[key] ?? false;
        const request = permissionRequest(key, { restartEngine: phase !== "paused" });
        const I = row.icon;
        return (
          <li key={key} className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden="true"
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                granted ? "bg-success/15 text-success-ink" : "bg-muted text-muted-foreground",
              )}
            >
              <I className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold">{row.label}</p>
              <p className="text-sm text-muted-foreground">{row.blurb}</p>
            </div>
            {granted ? (
              <Chip tone="ok">
                <Check className="h-4 w-4" aria-hidden="true" /> Allowed
              </Chip>
            ) : request ? (
              <button
                type="button"
                disabled={busy !== null}
                aria-label={`Allow ${row.label}`}
                onClick={() => {
                  setBusy(key);
                  request()
                    .catch(() => false)
                    .then(() => onRefresh())
                    .finally(() => setBusy(null));
                }}
                className="min-h-12 shrink-0 rounded-full bg-coral-ink px-5 text-base font-bold text-primary-foreground disabled:opacity-50"
              >
                {busy === key ? "Asking" : "Allow"}
              </button>
            ) : (
              <Chip tone="neutral">Not set</Chip>
            )}
          </li>
        );
      })}
    </ul>
  );
}
