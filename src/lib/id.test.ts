import { describe, expect, it } from "vitest";
import { newId } from "./id";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  it("uses randomUUID when the context provides it", () => {
    const id = newId({
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
      getRandomValues: (a) => a,
    });
    expect(id).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("falls back to a v4 uuid on insecure contexts without randomUUID", () => {
    const insecure = { getRandomValues: (a: Uint8Array) => crypto.getRandomValues(a) };
    const a = newId(insecure);
    const b = newId(insecure);
    expect(a).toMatch(UUID_V4);
    expect(b).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });
});
