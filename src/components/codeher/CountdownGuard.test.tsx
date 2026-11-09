import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CodeHerProvider } from "./store";
import { CodeHerApp } from "./CodeHerApp";
import { HOLD_MS } from "./HoldButton";
import { CANCEL_GUARD_MS } from "./CountdownScreen";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("codeher.settings", JSON.stringify({ onboarded: true }));
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

async function holdEnterOnSos(): Promise<HTMLElement> {
  render(
    <CodeHerProvider>
      <CodeHerApp showSplash={false} />
    </CodeHerProvider>,
  );
  const sos = await screen.findByRole("button", { name: /Send SOS/ });
  sos.focus();
  fireEvent.keyDown(sos, { key: "Enter" });
  act(() => {
    vi.advanceTimersByTime(HOLD_MS + 10);
  });
  return screen.findByRole("alertdialog");
}

describe("holding Enter on SOS", () => {
  it("does not cancel the countdown it just started", async () => {
    await holdEnterOnSos();
    const cancel = screen.getByRole("button", { name: "Cancel alert" });
    expect(cancel).toHaveFocus();
    // The held key keeps auto-repeating onto Cancel: the default (click) is blocked.
    const notPrevented = fireEvent.keyDown(cancel, { key: "Enter", repeat: true });
    expect(notPrevented).toBe(false);
    // An activation right after the screen appears is ignored too.
    fireEvent.click(cancel);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("a deliberate Cancel after the guard still cancels", async () => {
    await holdEnterOnSos();
    act(() => {
      vi.advanceTimersByTime(CANCEL_GUARD_MS + 50);
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel alert" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
