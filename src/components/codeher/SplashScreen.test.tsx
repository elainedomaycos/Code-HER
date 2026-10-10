import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SplashScreen } from "./Screens";

afterEach(() => {
  vi.useRealTimers();
});

describe("splash screen", () => {
  it("shows the stacked logo and tagline", () => {
    vi.useFakeTimers();
    render(<SplashScreen onDone={() => {}} />);
    expect(screen.getByAltText("Code:HER")).toHaveAttribute("src", "/codeher-splash.png");
    expect(screen.getByText("Offline voice SOS")).toBeInTheDocument();
  });

  it("auto-dismisses after the entrance plays", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<SplashScreen onDone={onDone} />);
    act(() => {
      vi.advanceTimersByTime(1950);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("tap skips immediately", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<SplashScreen onDone={onDone} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
