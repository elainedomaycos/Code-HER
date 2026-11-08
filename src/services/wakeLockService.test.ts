import { describe, expect, it, vi } from "vitest";
import { createScreenWakeLock, type WakeLockDeps, type WakeLockHandle } from "./wakeLockService";

class FakeSentinel implements WakeLockHandle {
  released = false;
  private onRelease: (() => void) | null = null;
  addEventListener(_type: "release", cb: () => void): void {
    this.onRelease = cb;
  }
  async release(): Promise<void> {
    this.drop();
  }
  /** What the browser does when the page is hidden. */
  drop(): void {
    if (this.released) return;
    this.released = true;
    this.onRelease?.();
  }
}

function setup(opts: { visible?: boolean; refuse?: boolean } = {}) {
  let refuse = opts.refuse ?? false;
  let visible = opts.visible ?? true;
  let visibleCb: (() => void) | null = null;
  const sentinels: FakeSentinel[] = [];
  const request = vi.fn(async () => {
    if (refuse) throw new Error("NotAllowedError");
    const s = new FakeSentinel();
    sentinels.push(s);
    return s;
  });
  const deps: WakeLockDeps = {
    request,
    isVisible: () => visible,
    onVisible: (cb) => {
      visibleCb = cb;
      return () => {
        visibleCb = null;
      };
    },
  };
  return {
    lock: createScreenWakeLock(deps),
    request,
    sentinels,
    hide() {
      visible = false;
      sentinels.forEach((s) => s.drop());
    },
    show() {
      visible = true;
      visibleCb?.();
    },
    /** Battery saver or policy drops the lock while the page stays visible. */
    policyDrop() {
      sentinels.forEach((s) => s.drop());
    },
    setRefuse(v: boolean) {
      refuse = v;
    },
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("screen wake lock", () => {
  it("reports unsupported and does nothing without the API", () => {
    const lock = createScreenWakeLock({
      request: null,
      isVisible: () => true,
      onVisible: () => () => undefined,
    });
    lock.hold("voice", true);
    expect(lock.getStatus()).toBe("unsupported");
  });

  it("keeps the screen on while wanted and releases it when not", async () => {
    const t = setup();
    t.lock.hold("voice", true);
    await tick();
    expect(t.lock.getStatus()).toBe("on");
    t.lock.hold("voice", false);
    expect(t.lock.getStatus()).toBe("off");
    expect(t.sentinels[0]?.released).toBe(true);
  });

  it("asks again when the page comes back after the browser dropped it", async () => {
    const t = setup();
    t.lock.hold("voice", true);
    await tick();
    t.hide();
    expect(t.lock.getStatus()).toBe("off");
    t.show();
    await tick();
    expect(t.request).toHaveBeenCalledTimes(2);
    expect(t.lock.getStatus()).toBe("on");
  });

  it("does not re-acquire on return once no longer wanted", async () => {
    const t = setup();
    t.lock.hold("voice", true);
    await tick();
    t.hide();
    t.lock.hold("voice", false);
    t.show();
    await tick();
    expect(t.request).toHaveBeenCalledTimes(1);
  });

  it("waits for the page to be visible before asking", async () => {
    const t = setup({ visible: false });
    t.lock.hold("voice", true);
    await tick();
    expect(t.request).not.toHaveBeenCalled();
    t.show();
    await tick();
    expect(t.lock.getStatus()).toBe("on");
  });

  it("reports denied when the browser refuses", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const t = setup({ refuse: true });
    t.lock.hold("voice", true);
    await tick();
    expect(t.lock.getStatus()).toBe("denied");
    warn.mockRestore();
  });

  it("releases a lock that arrives after it stopped being wanted", async () => {
    const t = setup();
    t.lock.hold("voice", true);
    t.lock.hold("voice", false);
    await tick();
    expect(t.sentinels[0]?.released).toBe(true);
    expect(t.lock.getStatus()).toBe("off");
  });

  it("stays on while any reason holds it", async () => {
    const t = setup();
    t.lock.hold("voice", true);
    t.lock.hold("alert", true);
    await tick();
    t.lock.hold("voice", false);
    expect(t.lock.getStatus()).toBe("on");
    t.lock.hold("alert", false);
    expect(t.lock.getStatus()).toBe("off");
  });

  it("asks again when the browser drops it while the page is visible", async () => {
    const t = setup();
    t.lock.hold("voice", true);
    await tick();
    t.policyDrop();
    await tick();
    expect(t.request).toHaveBeenCalledTimes(2);
    expect(t.lock.getStatus()).toBe("on");
  });

  it("does not report denied for a request nobody wants any more", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const t = setup({ refuse: true });
    t.lock.hold("voice", true);
    t.lock.hold("voice", false);
    await tick();
    expect(t.lock.getStatus()).toBe("off");
    warn.mockRestore();
  });

  it("retries after a failed request when the page came back during it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const t = setup({ refuse: true });
    t.lock.hold("voice", true);
    // Hidden and shown again while the first request is still in flight.
    t.hide();
    t.setRefuse(false);
    t.show();
    await tick();
    await tick();
    expect(t.lock.getStatus()).toBe("on");
    warn.mockRestore();
  });
});
