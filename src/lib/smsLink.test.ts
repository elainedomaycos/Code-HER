import { describe, it, expect, vi, afterEach } from "vitest";
import { buildMessage } from "@/services/messageBuilder";
import {
  buildSmsLink,
  copyText,
  detectSmsPlatform,
  normalizeSmsNumber,
  tryOpenSmsLink,
} from "./smsLink";

const A = "+639171111111";
const B = "+639172222222";

/** Decode the body parameter back out of a built link. */
function bodyOf(href: string): string {
  const i = href.indexOf("body=");
  return decodeURIComponent(href.slice(i + "body=".length));
}

describe("normalizeSmsNumber", () => {
  it("keeps a leading plus and digits only", () => {
    expect(normalizeSmsNumber(" +63 917-111 1111 ")).toBe(A);
    expect(normalizeSmsNumber("(0917) 111.1111")).toBe("09171111111");
  });

  it("returns empty for input without digits", () => {
    expect(normalizeSmsNumber("  +  ")).toBe("");
  });
});

describe("detectSmsPlatform", () => {
  it("recognizes iPhone, iPad and touch Macs as iOS", () => {
    expect(detectSmsPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("ios");
    expect(detectSmsPlatform("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)")).toBe("ios");
    expect(detectSmsPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
  });

  it("recognizes Android", () => {
    expect(detectSmsPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile")).toBe("android");
  });

  it("treats a mouse only Mac and Windows as desktop", () => {
    expect(detectSmsPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("desktop");
    expect(detectSmsPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("desktop");
  });
});

describe("buildSmsLink", () => {
  it("Android: comma separated recipients and ?body=", () => {
    expect(buildSmsLink([A, B], "Hi there", "android")).toBe(`sms:${A},${B}?body=Hi%20there`);
  });

  it("iOS: group form for multiple recipients", () => {
    expect(buildSmsLink([A, B], "Hi", "ios")).toBe(`sms:/open?addresses=${A},${B}&body=Hi`);
  });

  it("iOS: single recipient uses &body=", () => {
    expect(buildSmsLink([A], "Hi", "ios")).toBe(`sms:${A}&body=Hi`);
  });

  it("no recipients still prefills the body", () => {
    expect(buildSmsLink([], "Hi", "ios")).toBe("sms:&body=Hi");
    expect(buildSmsLink([], "Hi", "android")).toBe("sms:?body=Hi");
  });

  it("desktop uses the RFC 5724 form", () => {
    expect(buildSmsLink([A], "Hi", "desktop")).toBe(`sms:${A}?body=Hi`);
  });

  it("normalizes numbers and drops empty ones", () => {
    expect(buildSmsLink(["+63 917 111 1111", " ", B], "x", "android")).toBe(`sms:${A},${B}?body=x`);
  });

  it("escapes characters that would break out of the body parameter", () => {
    const body = "a&b=c?d#e%f+g\nh, ~ (i) 'j' \"k\"";
    for (const p of ["ios", "android"] as const) {
      const href = buildSmsLink([A, B], body, p);
      const raw = href.slice(href.indexOf("body=") + 5);
      expect(raw).not.toMatch(/[&?#+\n ]/);
      expect(raw).not.toMatch(/%(?![0-9A-F]{2})/);
      expect(bodyOf(href)).toBe(body);
    }
  });

  it("round trips the real GSM alert text exactly", () => {
    const body = buildMessage(
      "Ana Cruz",
      { lat: 14.59951, lng: 120.98422, accuracyM: 12, at: 0, source: "gps" },
      { includeMapLink: true },
    );
    const href = buildSmsLink([A, B], body, "android");
    expect(href.startsWith(`sms:${A},${B}?body=EMERGENCY%3A%20Ana%20Cruz`)).toBe(true);
    expect(href).toContain("Location%3A%2014.59951%2C120.98422%20at%20");
    expect(href).toContain("https%3A%2F%2Fmaps.google.com%2F%3Fq%3D14.59951%2C120.98422");
    expect(bodyOf(href)).toBe(body);
  });

  it("encodes non GSM characters as UTF-8", () => {
    const href = buildSmsLink([A], "Señora ±5m", "android");
    expect(href).toBe(`sms:${A}?body=Se%C3%B1ora%20%C2%B15m`);
  });
});

describe("tryOpenSmsLink", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns false when navigation throws", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const loc = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        assign: () => {
          throw new Error("blocked");
        },
      },
    });
    try {
      expect(tryOpenSmsLink("sms:?body=x")).toBe(false);
      expect(err).toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: loc });
    }
  });
});

describe("copyText", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the async clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await expect(copyText("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when the clipboard rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: exec });
    await expect(copyText("hello")).resolves.toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("resolves false when every path fails", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });
    await expect(copyText("hello")).resolves.toBe(false);
  });
});
