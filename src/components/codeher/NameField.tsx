import { useEffect, useState } from "react";
import { useCodeHer } from "./store";
import { inputCls } from "./ui";

export const NAME_MAX = 30;

/** Your name, shown in the alert. Saved on blur or Enter; blank clears it. */
export function NameField() {
  const { settings, setSettings } = useCodeHer();
  const [draft, setDraft] = useState(settings.userName);

  // Storage hydrates after mount; follow it until the user edits.
  useEffect(() => setDraft(settings.userName), [settings.userName]);

  const commit = () => {
    const clean = draft.trim().slice(0, NAME_MAX);
    setDraft(clean);
    if (clean !== settings.userName) setSettings({ ...settings, userName: clean });
  };

  return (
    <div>
      <label htmlFor="your-name" className="sr-only">
        Your name
      </label>
      <input
        id="your-name"
        placeholder="Type your first name"
        autoComplete="given-name"
        value={draft}
        maxLength={NAME_MAX}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={inputCls}
      />
    </div>
  );
}
