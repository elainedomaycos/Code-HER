import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoffView } from "./HandoffScreen";
import type { SmsHandoffState } from "./store";
import type { SmsPlatform } from "@/services";

function handoff(platform: SmsPlatform, status: "ready" | "opened" = "ready"): SmsHandoffState {
  return {
    href: "sms:+639171234567?body=EMERGENCY",
    body: "EMERGENCY: Elaine may need help. Location unavailable. Sent by Code:HER.",
    platform,
    recipients: [{ id: "1", name: "Ana", phone: "+639171234567" }],
    status,
    autoOpenAttempted: platform !== "desktop",
    preparedAt: 0,
  };
}

function renderView(h: SmsHandoffState, onCopy = vi.fn(() => Promise.resolve(true))) {
  const onOpenAttempt = vi.fn();
  const onDone = vi.fn();
  render(<HandoffView handoff={h} onOpenAttempt={onOpenAttempt} onCopy={onCopy} onDone={onDone} />);
  return { onOpenAttempt, onDone, onCopy };
}

describe("web SMS handoff screen", () => {
  it("on a phone, the primary action is a real sms: link that records an open attempt", () => {
    const { onOpenAttempt } = renderView(handoff("android"));
    const link = screen.getByRole("link", { name: "Open Messages to send" });
    expect(link).toHaveAttribute("href", "sms:+639171234567?body=EMERGENCY");
    fireEvent.click(link);
    expect(onOpenAttempt).toHaveBeenCalledOnce();
    // A tap alone proves nothing: the chip stays honest until the store says opened.
    expect(screen.getByText("Not sent yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel alert" })).toBeInTheDocument();
  });

  it("on desktop, clicking the Messages link never records an open", () => {
    const { onOpenAttempt } = renderView(handoff("desktop"));
    fireEvent.click(screen.getByRole("link", { name: "Open in Messages app" }));
    expect(onOpenAttempt).not.toHaveBeenCalled();
    expect(screen.getByText("Not sent yet")).toBeInTheDocument();
  });

  it("shows the exact message and an honest per-contact status", () => {
    renderView(handoff("ios"));
    expect(screen.getByText(/Elaine may need help/)).toBeInTheDocument();
    expect(screen.getByText("Not sent yet")).toBeInTheDocument();
    expect(screen.queryByText(/^Sent$/)).not.toBeInTheDocument();
  });

  it("flips the chip once Messages was opened", () => {
    renderView(handoff("android", "opened"));
    expect(screen.getByText("Messages opened")).toBeInTheDocument();
  });

  it("on desktop, Copy is the main action and it reports success", async () => {
    const { onCopy } = renderView(handoff("desktop"));
    expect(screen.getByRole("link", { name: "Open in Messages app" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    expect(onCopy).toHaveBeenCalledOnce();
    expect(await screen.findByText("Message copied.")).toBeInTheDocument();
  });

  it("tells the user to select the text when copy fails", async () => {
    renderView(
      handoff("desktop"),
      vi.fn(() => Promise.resolve(false)),
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    expect(await screen.findByText("Copy failed, select the text above.")).toBeInTheDocument();
  });

  it("asks before leaving when Messages was never opened", () => {
    const { onDone } = renderView(handoff("android"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel alert" }));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText("Your alert has not been sent. Leave anyway?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(screen.getByRole("button", { name: "Cancel alert" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel alert" }));
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("goes straight home once Messages was opened", () => {
    const { onDone } = renderView(handoff("android", "opened"));
    fireEvent.click(screen.getByRole("button", { name: "Back to home" }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("after a successful copy, leaving needs no confirm", async () => {
    const { onDone } = renderView(handoff("desktop"));
    fireEvent.click(screen.getByRole("button", { name: "Copy message" }));
    expect(await screen.findByText("Copied", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByText("Not sent yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to home" }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("a held key does not fire the action that took focus", () => {
    renderView(handoff("desktop"));
    const copy = screen.getByRole("button", { name: "Copy message" });
    expect(fireEvent.keyDown(copy, { key: "Enter", repeat: true })).toBe(false);
  });

  it("moves focus to the main action on arrival", () => {
    renderView(handoff("android"));
    expect(screen.getByRole("link", { name: "Open Messages to send" })).toHaveFocus();
  });
});
