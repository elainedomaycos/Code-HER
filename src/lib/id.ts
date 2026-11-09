/** The slice of Web Crypto newId needs (injectable for tests). */
export interface IdCrypto {
  randomUUID?: () => string;
  getRandomValues: (bytes: Uint8Array) => Uint8Array;
}

/**
 * Random id for local records (contacts). crypto.randomUUID only exists in
 * secure contexts, so plain http on a LAN IP falls back to getRandomValues,
 * which browsers expose everywhere.
 */
export function newId(c: IdCrypto = globalThis.crypto): string {
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40; // version 4
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
