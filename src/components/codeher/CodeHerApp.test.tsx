import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CodeHerProvider } from "./store";
import { CodeHerApp } from "./CodeHerApp";

beforeEach(() => {
  localStorage.clear();
});

function renderApp(settings: Record<string, unknown> = { onboarded: true }) {
  localStorage.setItem("codeher.settings", JSON.stringify(settings));
  render(
    <CodeHerProvider>
      <CodeHerApp showSplash={false} />
    </CodeHerProvider>,
  );
}

const nav = () => screen.getByRole("navigation", { name: "Main" });

describe("tab navigation", () => {
  it("has exactly three tabs: Home, Contacts, Settings", async () => {
    renderApp();
    await screen.findByText("Finish setting up");
    const tabs = within(nav()).getAllByRole("button");
    expect(tabs.map((t) => t.textContent)).toEqual(["Home", "Contacts", "Settings"]);
    expect(within(nav()).queryByText("SOS")).not.toBeInTheDocument();
  });

  it("switches screens and marks the current tab", async () => {
    renderApp();
    await screen.findByText("Finish setting up");
    fireEvent.click(within(nav()).getByRole("button", { name: "Contacts" }));
    expect(screen.getByRole("heading", { level: 1, name: "Trusted contacts" })).toBeInTheDocument();
    expect(within(nav()).getByRole("button", { name: "Contacts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    fireEvent.click(within(nav()).getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    fireEvent.click(within(nav()).getByRole("button", { name: "Home" }));
    expect(screen.getByText("Finish setting up")).toBeInTheDocument();
  });

  it("checklist step jumps to the Contacts tab", async () => {
    renderApp();
    fireEvent.click(await screen.findByRole("button", { name: /Add a trusted contact/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Trusted contacts" })).toBeInTheDocument();
  });
});

describe("home before and after setup", () => {
  it("does not claim protection with zero contacts", async () => {
    renderApp();
    expect(await screen.findByText("Finish setting up")).toBeInTheDocument();
    expect(screen.queryByText(/You're covered/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Alerts go to")).not.toBeInTheDocument();
  });

  it("always offers the hold to send SOS button", async () => {
    renderApp();
    expect(
      await screen.findByRole("button", { name: /Send SOS. Press and hold/ }),
    ).toBeInTheDocument();
  });

  it("adding a contact from the empty state saves it", async () => {
    renderApp();
    await screen.findByText("Finish setting up");
    fireEvent.click(within(nav()).getByRole("button", { name: "Contacts" }));
    expect(screen.getByText("No contacts yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add a contact" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "0917 123 4567" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(localStorage.getItem("codeher.contacts")).toContain("+639171234567");
  });

  it("rejects an invalid number with a clear message", async () => {
    renderApp();
    await screen.findByText("Finish setting up");
    fireEvent.click(within(nav()).getByRole("button", { name: "Contacts" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a contact" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ana" } });
    fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a PH mobile number");
  });

  it("onboarding shows first and Get started leads to Home", async () => {
    renderApp({});
    fireEvent.click(await screen.findByRole("button", { name: "Get started" }));
    expect(await screen.findByText("Finish setting up")).toBeInTheDocument();
  });
});
