import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CodeHerProvider } from "./store";
import { PhrasePanel } from "./PhrasePanel";

beforeEach(() => {
  localStorage.clear();
});

function renderPanel(settings?: Record<string, unknown>) {
  if (settings) localStorage.setItem("codeher.settings", JSON.stringify(settings));
  render(
    <CodeHerProvider>
      <PhrasePanel />
    </CodeHerProvider>,
  );
}

const field = () =>
  screen.getByRole("textbox", { name: "Or use your own words" }) as HTMLInputElement;
const savedPhrase = (): unknown =>
  (JSON.parse(localStorage.getItem("codeher.settings") ?? "{}") as { safePhrase?: unknown })
    .safePhrase;

function type(value: string) {
  fireEvent.change(field(), { target: { value } });
  fireEvent.blur(field());
}

describe("custom SOS phrase", () => {
  it("suggests common words the model knows", () => {
    renderPanel();
    expect(field()).toHaveAttribute("placeholder", "e.g. red umbrella");
    expect(screen.getByText(/common English words/)).toBeInTheDocument();
  });

  it.each(["911", "tulong po!", "one two three four"])(
    "rejects %s with a plain message and does not save it",
    (value) => {
      renderPanel({ safePhrase: "help me" });
      type(value);
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toMatch(/Your phrase is still “help me”/);
      expect(alert.textContent).not.toMatch(/[–—]/);
      expect(field()).toHaveAttribute("aria-invalid", "true");
      expect(savedPhrase()).not.toBe(value);
    },
  );

  it("saves the normalized phrase the engine will listen for", () => {
    renderPanel();
    type("  Red   UMBRELLA ");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(savedPhrase()).toBe("red umbrella");
    expect(field().value).toBe("red umbrella");
  });

  it("shows the effective phrase when an old saved phrase is not valid", () => {
    renderPanel({ safePhrase: "911" });
    expect(screen.getByRole("radio", { name: "help me" })).toHaveAttribute("aria-checked", "true");
    expect(field().value).toBe("");
  });

  it("typing a preset by hand selects that preset and clears the field", () => {
    renderPanel({ safePhrase: "red umbrella" });
    type(" Code Red ");
    expect(savedPhrase()).toBe("code red");
    expect(screen.getByRole("radio", { name: "code red" })).toHaveAttribute("aria-checked", "true");
    expect(field().value).toBe("");
  });

  it("clears the error when the user edits again", () => {
    renderPanel();
    type("911");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(field(), { target: { value: "red" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
