import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import type { LocationFix } from "@/services/types";
import { listeningService, locationService } from "@/services";
import { CodeHerProvider, COUNTDOWN_SECONDS, DETECT_TO_COUNTDOWN_MS, useCodeHer } from "./store";

type Ctx = ReturnType<typeof useCodeHer>;

function renderStore(): { ctx: () => Ctx } {
  const box: { current: Ctx | null } = { current: null };
  function Probe() {
    box.current = useCodeHer();
    return null;
  }
  render(
    <CodeHerProvider>
      <Probe />
    </CodeHerProvider>,
  );
  return {
    ctx: () => {
      if (!box.current) throw new Error("store not mounted");
      return box.current;
    },
  };
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

async function runToLocating(ctx: () => Ctx): Promise<void> {
  act(() => ctx().trigger());
  act(() => {
    vi.advanceTimersByTime(DETECT_TO_COUNTDOWN_MS + 10);
  });
  for (let i = 0; i < COUNTDOWN_SECONDS; i++) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
  await flush();
  expect(ctx().phase).toBe("locating");
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("codeher.settings", JSON.stringify({ onboarded: true }));
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("alert run lifecycle", () => {
  it("a real alert cancelled while locating never resumes inside a later test", async () => {
    let resolveFix: (fix: LocationFix | null) => void = () => undefined;
    const pending = new Promise<LocationFix | null>((r) => {
      resolveFix = r;
    });
    const { ctx } = renderStore();
    await flush();
    vi.spyOn(locationService, "getCurrent").mockReturnValue(pending);

    await runToLocating(ctx);
    act(() => ctx().cancel());
    act(() => ctx().startTest());
    expect(ctx().isTest).toBe(true);

    // The cancelled real run's GPS wait finishes during the test.
    resolveFix(null);
    await flush();
    await flush();

    expect(ctx().phase).not.toBe("handoff");
    expect(ctx().handoff).toBeNull();
    expect(ctx().isTest).toBe(true);
  });

  it("cancel after a manual SOS from paused turns the voice engine back on", async () => {
    const { ctx } = renderStore();
    await flush();
    act(() => ctx().togglePause());
    expect(ctx().phase).toBe("paused");

    const start = vi.spyOn(listeningService, "start").mockResolvedValue(undefined);
    act(() => ctx().trigger());
    act(() => ctx().cancel());

    expect(ctx().phase).toBe("listening");
    expect(start).toHaveBeenCalled();
  });
});
