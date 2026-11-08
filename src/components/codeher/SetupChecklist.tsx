import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCodeHer } from "./store";
import { permissionRequest } from "./permissionActions";
import type { SetupStep, SetupStepId } from "./setup";
import { cardCls } from "./ui";

function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-coral-ink text-sm font-bold text-coral-ink"
    >
      {n}
    </span>
  );
}

/** Only what is left to do; Home says how many steps remain. */
export function SetupChecklist({ steps }: { steps: readonly SetupStep[] }) {
  const { setTab, permissions, phase, refreshPermissions } = useCodeHer();
  const [busy, setBusy] = useState(false);

  const allowPermissions = async () => {
    setBusy(true);
    try {
      const keys = (["mic", "location"] as const).filter((k) => !(permissions?.[k] ?? false));
      for (const key of keys) {
        const request = permissionRequest(key, { restartEngine: phase !== "paused" });
        if (request) await request().catch(() => false);
      }
    } finally {
      refreshPermissions();
      setBusy(false);
    }
  };

  const act: Record<SetupStepId, () => void> = {
    contact: () => setTab("contacts"),
    name: () => setTab("settings"),
    phrase: () => setTab("settings"),
    permissions: () => {
      void allowPermissions();
    },
  };

  return (
    <ol className={cn(cardCls, "divide-y divide-border overflow-hidden")}>
      {steps
        .filter((s) => !s.done)
        .map((step, i) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={act[step.id]}
              disabled={step.id === "permissions" && busy}
              className="flex min-h-16 w-full items-center gap-4 px-5 py-3 text-left disabled:opacity-60"
            >
              <StepNumber n={i + 1} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold">
                  {step.id === "permissions" && busy ? "Waiting for your answer" : step.title}
                </span>
                <span className="block text-sm text-muted-foreground">{step.detail}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-coral-ink" aria-hidden="true" />
            </button>
          </li>
        ))}
    </ol>
  );
}
