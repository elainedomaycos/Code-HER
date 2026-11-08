import { describe, it, expect } from "vitest";
import { countDone, getSetupSteps, isSetupComplete, type SetupInput } from "./setup";

const READY: SetupInput = {
  contacts: [{ id: "1", name: "Ana", phone: "+639171234567" }],
  userName: "Elaine",
  safePhrase: "help me",
  micAllowed: true,
  locationAllowed: true,
};

function step(input: SetupInput, id: string) {
  const s = getSetupSteps(input).find((x) => x.id === id);
  if (!s) throw new Error(`missing step ${id}`);
  return s;
}

describe("setup checklist", () => {
  it("lists contact, name, phrase and permissions in that order", () => {
    expect(getSetupSteps(READY).map((s) => s.id)).toEqual([
      "contact",
      "name",
      "phrase",
      "permissions",
    ]);
  });

  it("is complete only when every step is done", () => {
    const steps = getSetupSteps(READY);
    expect(isSetupComplete(steps)).toBe(true);
    expect(countDone(steps)).toBe(4);
  });

  it("is not ready with zero contacts, even with everything else set", () => {
    const steps = getSetupSteps({ ...READY, contacts: [] });
    expect(isSetupComplete(steps)).toBe(false);
    expect(step({ ...READY, contacts: [] }, "contact")).toMatchObject({
      done: false,
      title: "Add a trusted contact",
    });
  });

  it("names saved contacts when done", () => {
    const two = {
      ...READY,
      contacts: [...READY.contacts, { id: "2", name: "Ben", phone: "+639181234567" }],
    };
    expect(step(two, "contact").detail).toBe("Ana and Ben");
  });

  it("treats a blank or whitespace name as missing", () => {
    expect(step({ ...READY, userName: "   " }, "name").done).toBe(false);
    expect(isSetupComplete(getSetupSteps({ ...READY, userName: "" }))).toBe(false);
  });

  it("needs a non-empty SOS phrase", () => {
    expect(step({ ...READY, safePhrase: " " }, "phrase").done).toBe(false);
    expect(step(READY, "phrase").detail).toContain("help me");
  });

  it("shows the phrase the engine really listens for", () => {
    expect(step({ ...READY, safePhrase: " Code RED! " }, "phrase").detail).toBe("“code red”");
  });

  it("asks only for the missing permission", () => {
    expect(step({ ...READY, micAllowed: false }, "permissions").title).toBe("Allow the microphone");
    expect(step({ ...READY, locationAllowed: false }, "permissions").title).toBe("Allow location");
    expect(step({ ...READY, micAllowed: false, locationAllowed: false }, "permissions").title).toBe(
      "Allow microphone and location",
    );
  });

  it("fresh install has only the default phrase done", () => {
    const steps = getSetupSteps({
      contacts: [],
      userName: "",
      safePhrase: "help me",
      micAllowed: false,
      locationAllowed: false,
    });
    expect(countDone(steps)).toBe(1);
  });

  it("copy has no leading dashes or em dashes", () => {
    const all = [
      ...getSetupSteps(READY),
      ...getSetupSteps({ ...READY, contacts: [], userName: "", micAllowed: false }),
    ];
    for (const s of all) {
      expect(`${s.title} ${s.detail}`).not.toMatch(/[–—]|^\s*-/);
    }
  });
});
