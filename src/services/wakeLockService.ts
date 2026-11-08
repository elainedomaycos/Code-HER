// Screen Wake Lock for the web build. A browser tab cannot hold the mic once
// the screen locks, and an alert's countdown and Messages handoff stall
// behind a lock screen, so the screen stays on while any reason holds it:
// the voice engine starting or listening, or an alert in progress. Native
// does not use this: its foreground service keeps listening with the screen
// off, and holding the screen on would only drain the battery.
//
// The browser drops a wake lock whenever the page is hidden (and may drop it
// for battery saver while visible), so the lock is requested again each time
// the page is visible while still wanted.

/** The slice of WakeLockSentinel this service uses. */
export interface WakeLockHandle {
  readonly released: boolean;
  release(): Promise<void>;
  addEventListener(type: "release", cb: () => void): void;
}

export interface WakeLockDeps {
  /** navigator.wakeLock.request("screen"), or null when unsupported. */
  request: (() => Promise<WakeLockHandle>) | null;
  isVisible: () => boolean;
  onVisible: (cb: () => void) => () => void;
}

export type WakeLockStatus = "unsupported" | "off" | "on" | "denied";

/** Why the screen should stay on. Any one reason keeps it on. */
export type WakeLockReason = "voice" | "alert";

export interface ScreenWakeLock {
  /** Add (true) or drop (false) a reason to keep the screen on. */
  hold(reason: WakeLockReason, on: boolean): void;
  getStatus(): WakeLockStatus;
  onStatusChange(cb: () => void): () => void;
}

export function createScreenWakeLock(deps: WakeLockDeps): ScreenWakeLock {
  const reasons = new Set<WakeLockReason>();
  let handle: WakeLockHandle | null = null;
  let pending = false;
  let again = false;
  let status: WakeLockStatus = deps.request ? "off" : "unsupported";
  const listeners = new Set<() => void>();
  let offVisible: (() => void) | null = null;

  const wanted = () => reasons.size > 0;
  const setStatus = (next: WakeLockStatus) => {
    if (next === status) return;
    status = next;
    listeners.forEach((cb) => cb());
  };

  const acquire = async (): Promise<void> => {
    const request = deps.request;
    if (!request || !wanted() || !deps.isVisible()) return;
    if (handle && !handle.released) return;
    if (pending) {
      // A visibility return during the request: try again once it settles.
      again = true;
      return;
    }
    pending = true;
    again = false;
    try {
      const h = await request();
      if (!wanted()) {
        // Every reason went away while the request was in flight.
        await h.release().catch(() => undefined);
        return;
      }
      handle = h;
      h.addEventListener("release", () => {
        if (handle !== h) return;
        handle = null;
        if (!wanted()) return;
        setStatus("off");
        // Dropped while still visible (battery saver, policy): ask again.
        // A refusal lands on "denied" and does not loop.
        if (deps.isVisible()) void acquire();
      });
      setStatus("on");
    } catch (e: unknown) {
      if (wanted()) {
        // Battery saver or a policy can refuse it; listening still works.
        console.warn("screen wake lock refused:", e);
        setStatus("denied");
      }
    } finally {
      pending = false;
      if (again && wanted() && !(handle && !handle.released)) void acquire();
    }
  };

  const releaseAll = () => {
    const h = handle;
    handle = null;
    again = false;
    if (h && !h.released) h.release().catch(() => undefined);
    setStatus("off");
  };

  return {
    hold(reason, on) {
      if (!deps.request) return;
      const had = wanted();
      if (on) reasons.add(reason);
      else reasons.delete(reason);
      const want = wanted();
      if (want === had) return;
      if (want) {
        offVisible ??= deps.onVisible(() => void acquire());
        void acquire();
      } else {
        offVisible?.();
        offVisible = null;
        releaseAll();
      }
    },
    getStatus: () => status,
    onStatusChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

function browserDeps(): WakeLockDeps {
  const hasApi =
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    typeof navigator.wakeLock?.request === "function";
  return {
    request: hasApi ? () => navigator.wakeLock.request("screen") : null,
    isVisible: () => typeof document !== "undefined" && document.visibilityState === "visible",
    onVisible: (cb) => {
      if (typeof document === "undefined") return () => undefined;
      const handler = () => {
        if (document.visibilityState === "visible") cb();
      };
      document.addEventListener("visibilitychange", handler);
      return () => document.removeEventListener("visibilitychange", handler);
    },
  };
}

/** Lazily created so SSR and tests without the API never touch navigator early. */
let instance: ScreenWakeLock | null = null;
export function browserScreenWakeLock(): ScreenWakeLock {
  instance ??= createScreenWakeLock(browserDeps());
  return instance;
}
