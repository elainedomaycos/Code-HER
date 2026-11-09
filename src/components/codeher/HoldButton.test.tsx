import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { HoldButton, HOLD_MS } from "./HoldButton";

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  vi.useFakeTimers();
  const onComplete = vi.fn();
  render(
    <HoldButton
      onComplete={onComplete}
      label="Hold to send SOS"
      holdingLabel="Keep holding"
      ariaLabel="Send SOS"
    />,
  );
  return { onComplete, button: screen.getByRole("button", { name: "Send SOS" }) };
}

describe("hold to send SOS", () => {
  it("fires only after the full hold", () => {
    const { onComplete, button } = setup();
    fireEvent.pointerDown(button, { pointerId: 1 });
    expect(button).toHaveTextContent("Keep holding");
    act(() => {
      vi.advanceTimersByTime(HOLD_MS - 50);
    });
    expect(onComplete).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("a quick tap does nothing", () => {
    const { onComplete, button } = setup();
    fireEvent.pointerDown(button, { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.pointerUp(button, { pointerId: 1 });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS * 2);
    });
    expect(onComplete).not.toHaveBeenCalled();
    expect(button).toHaveTextContent("Hold to send SOS");
  });

  it("a plain click (no hold) does nothing", () => {
    const { onComplete, button } = setup();
    fireEvent.click(button);
    act(() => {
      vi.advanceTimersByTime(HOLD_MS * 2);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("works from the keyboard by holding Space", () => {
    const { onComplete, button } = setup();
    fireEvent.keyDown(button, { key: " " });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS);
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("releasing the key early cancels", () => {
    const { onComplete, button } = setup();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyUp(button, { key: "Enter" });
    act(() => {
      vi.advanceTimersByTime(HOLD_MS * 2);
    });
    expect(onComplete).not.toHaveBeenCalled();
  });
});
