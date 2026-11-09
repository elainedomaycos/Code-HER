import { cn } from "@/lib/utils";
import { useCodeHer } from "./store";
import { cardCls, SwitchRow } from "./ui";

/** One SMS segment in the GSM alphabet. */
const SMS_SEGMENT = 160;

/** Exactly what contacts receive, built by the same template the alert uses. */
export function MessagePreview() {
  const { settings, setSettings, location, previewMessage } = useCodeHer();
  const text = previewMessage();
  return (
    <div className={cn(cardCls, "overflow-hidden")}>
      <div className="p-4">
        <p
          aria-label="Alert message preview"
          className="rounded-2xl rounded-bl-md bg-muted px-4 py-3 text-base leading-relaxed"
        >
          {text}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {text.length <= SMS_SEGMENT
            ? `Fits in one text (${text.length} of ${SMS_SEGMENT} characters).`
            : `Sent as ${Math.ceil(text.length / 153)} texts (${text.length} characters).`}
          {!location && " Your location is added when it is found."}
        </p>
      </div>
      <div className="border-t border-border">
        <SwitchRow
          label="Add a Google Maps link"
          detail="Easier for contacts to open. Some networks block texts with links."
          checked={settings.includeMapLink}
          onChange={(includeMapLink) => setSettings({ ...settings, includeMapLink })}
        />
      </div>
    </div>
  );
}
