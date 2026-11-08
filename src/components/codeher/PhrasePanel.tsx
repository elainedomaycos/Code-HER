import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { effectivePhrase, validatePhrase, type PhraseProblem } from "@/services";
import { cn } from "@/lib/utils";
import { useCodeHer } from "./store";
import { inputCls } from "./ui";

// Two words each: a single common word ("help") fires in normal talk.
export const PHRASE_PRESETS = ["help me", "please help", "code red"] as const;
const PHRASE_MAX = 30;

const isPreset = (p: string) => (PHRASE_PRESETS as readonly string[]).includes(p);

/** Plain fix for each rejected phrase. Empty input is ignored, not an error. */
const PHRASE_ERROR: Record<Exclude<PhraseProblem, "empty">, string> = {
  "not-letters": "Use letters only. No numbers or symbols.",
  "too-many-words": "Use one, two, or three words.",
};

/**
 * Pick a preset or type your own. The engine is retuned on commit, not per
 * keystroke. Only phrases the engine can hear as typed are saved, and the
 * panel always shows the phrase the engine really listens for.
 */
export function PhrasePanel() {
  const { settings, setSettings } = useCodeHer();
  const current = effectivePhrase(settings.safePhrase);
  const [custom, setCustom] = useState(isPreset(current) ? "" : current);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPreset(current)) setCustom(current);
  }, [current]);

  const save = (phrase: string) => {
    if (phrase !== settings.safePhrase) setSettings({ ...settings, safePhrase: phrase });
  };

  const commitCustom = () => {
    const check = validatePhrase(custom);
    if (!check.ok) {
      if (check.problem === "empty") {
        setError(null);
        setCustom(isPreset(current) ? "" : current);
      } else {
        setError(PHRASE_ERROR[check.problem]);
      }
      return;
    }
    setError(null);
    // A typed preset selects that chip, same as tapping it.
    setCustom(isPreset(check.phrase) ? "" : check.phrase);
    save(check.phrase);
  };

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="SOS phrase" className="flex flex-wrap gap-2">
        {PHRASE_PRESETS.map((p) => {
          const on = current === p;
          return (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                save(p);
                setCustom("");
                setError(null);
              }}
              className={cn(
                "flex min-h-12 items-center gap-2 rounded-full border-2 px-5 text-base font-semibold",
                on
                  ? "border-coral-ink bg-secondary text-secondary-foreground"
                  : "border-border bg-card",
              )}
            >
              {on && <Check className="h-4 w-4" aria-hidden="true" />}
              {p}
            </button>
          );
        })}
      </div>
      <div>
        <label htmlFor="custom-phrase" className="mb-1.5 block text-sm font-semibold">
          Or use your own words
        </label>
        <input
          id="custom-phrase"
          placeholder="e.g. red umbrella"
          value={custom}
          maxLength={PHRASE_MAX}
          aria-invalid={error !== null}
          aria-describedby={error ? "custom-phrase-error custom-phrase-hint" : "custom-phrase-hint"}
          onChange={(e) => {
            setCustom(e.target.value);
            setError(null);
          }}
          onBlur={commitCustom}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={inputCls}
        />
        {error && (
          <p id="custom-phrase-error" role="alert" className="mt-1.5 text-sm font-semibold">
            {error} Your phrase is still “{current}”.
          </p>
        )}
        <p id="custom-phrase-hint" className="mt-1.5 text-sm text-muted-foreground">
          Use common English words. Two words work best.
        </p>
      </div>
    </div>
  );
}
