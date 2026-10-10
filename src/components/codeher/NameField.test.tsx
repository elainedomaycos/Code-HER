import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CodeHerProvider } from "./store";
import { ContactsScreen } from "./Screens";

beforeEach(() => {
  localStorage.clear();
});

function nameInput(): HTMLInputElement {
  return screen.getByLabelText("Your name") as HTMLInputElement;
}

describe("your-name field (Contacts)", () => {
  it("shows the saved name and persists edits", () => {
    render(
      <CodeHerProvider>
        <ContactsScreen />
      </CodeHerProvider>,
    );
    expect(nameInput().value).toBe("Kassandra");
    fireEvent.change(nameInput(), { target: { value: "Elaine Tester" } });
    fireEvent.blur(nameInput());
    expect(localStorage.getItem("codeher.settings")).toContain("Elaine Tester");
  });

  it("reverts blank input to the saved name", () => {
    render(
      <CodeHerProvider>
        <ContactsScreen />
      </CodeHerProvider>,
    );
    fireEvent.change(nameInput(), { target: { value: "   " } });
    fireEvent.blur(nameInput());
    expect(nameInput().value).toBe("Kassandra");
  });
});
