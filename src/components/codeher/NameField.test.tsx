import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CodeHerProvider } from "./store";
import { SettingsScreen } from "./SettingsScreen";

beforeEach(() => {
  localStorage.clear();
});

function nameInput(): HTMLInputElement {
  return screen.getByRole("textbox", { name: "Your name" }) as HTMLInputElement;
}

function renderSettings() {
  render(
    <CodeHerProvider>
      <SettingsScreen />
    </CodeHerProvider>,
  );
}

describe("your name field (Settings)", () => {
  it("starts empty with a placeholder instead of a sample name", () => {
    renderSettings();
    expect(nameInput().value).toBe("");
    expect(nameInput()).toHaveAttribute("placeholder", "Type your first name");
  });

  it("persists edits, trimmed", () => {
    renderSettings();
    fireEvent.change(nameInput(), { target: { value: "  Elaine Tester " } });
    fireEvent.blur(nameInput());
    expect(nameInput().value).toBe("Elaine Tester");
    expect(localStorage.getItem("codeher.settings")).toContain('"userName":"Elaine Tester"');
  });

  it("clearing the name saves an empty name", async () => {
    localStorage.setItem("codeher.settings", JSON.stringify({ userName: "Elaine" }));
    renderSettings();
    await screen.findByDisplayValue("Elaine");
    fireEvent.change(nameInput(), { target: { value: "   " } });
    fireEvent.blur(nameInput());
    expect(nameInput().value).toBe("");
    expect(localStorage.getItem("codeher.settings")).toContain('"userName":""');
  });

  it("message preview falls back to Someone when the name is empty", () => {
    renderSettings();
    expect(screen.getByLabelText("Alert message preview").textContent).toMatch(
      /^EMERGENCY: Someone may need help\./,
    );
  });

  it("message preview uses the saved name", async () => {
    localStorage.setItem("codeher.settings", JSON.stringify({ userName: "Elaine" }));
    renderSettings();
    expect((await screen.findByText(/EMERGENCY: Elaine may need help\./)).textContent).toContain(
      "Sent by Code:HER.",
    );
  });
});
