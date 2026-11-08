import { describe, it, expect } from "vitest";
import { countdownRecipientsLine, joinNames, NO_CONTACT_NATIVE, sosCaption } from "./format";
import { COUNTDOWN_SECONDS } from "./store";

const MIA = { name: "Mia" };
const LEO = { name: "Leo" };

describe("joinNames", () => {
  it("joins one or two names with and", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames([MIA])).toBe("Mia");
    expect(joinNames([MIA, LEO])).toBe("Mia and Leo");
  });
});

describe("SOS caption is truthful per send mode", () => {
  it("native with zero contacts says no one will get the alert", () => {
    const text = sosCaption([], "native");
    expect(text).toBe(NO_CONTACT_NATIVE);
    expect(text).not.toMatch(/choose who to text/);
  });

  it("only the web handoff promises choosing recipients later", () => {
    expect(sosCaption([], "handoff")).toMatch(/choose who to text after the countdown/);
  });

  it("names contacts and the countdown length", () => {
    expect(sosCaption([MIA, LEO], "native")).toBe(
      `Alerts go to Mia and Leo. ${COUNTDOWN_SECONDS} second countdown, you can cancel.`,
    );
    expect(sosCaption([MIA], "handoff")).toContain("then opens Messages");
  });
});

describe("countdown recipients line", () => {
  it("native real alert with zero contacts warns plainly", () => {
    expect(countdownRecipientsLine([], false, "native")).toBe(NO_CONTACT_NATIVE);
  });

  it("handoff real alert with zero contacts points to Messages", () => {
    expect(countdownRecipientsLine([], false, "handoff")).toMatch(/choose who to text/);
  });

  it("test runs never promise a send", () => {
    expect(countdownRecipientsLine([], true, "native")).toBe("No contacts saved yet.");
    expect(countdownRecipientsLine([MIA], true, "handoff")).toBe("Would go to Mia");
  });

  it("lists contacts for a real alert", () => {
    expect(countdownRecipientsLine([MIA, LEO], false, "native")).toBe("To Mia and Leo");
  });
});
