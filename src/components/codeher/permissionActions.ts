// Fix actions for the permission rows and the setup checklist. Each resolves
// once the prompt is answered; callers re-read grants with refreshPermissions.
import { requestLocationPermission, requestMicPermission } from "@/lib/permissions";
import {
  isNativeActive,
  listeningService,
  locationService,
  requestBatteryExemption,
  statusService,
} from "@/services";
import type { PermissionsState } from "./store";

export type PermissionKey = keyof PermissionsState;

/** Native: run the real flow (which prompts), then re-read the grant. */
async function requestNativeGrant(kind: "mic" | "location"): Promise<boolean> {
  try {
    if (kind === "mic") await listeningService.start();
    else await locationService.getCurrent();
  } catch (e: unknown) {
    // A rejection only means "not granted yet"; the grant is read below.
    console.error(e);
  }
  try {
    const p = await statusService.getPermissions();
    return kind === "mic" ? p.mic : p.location;
  } catch (e: unknown) {
    console.error(e);
    return false;
  }
}

/** Web mic: ask, then (re)start the engine so a blocked mic recovers. */
async function requestWebMic(restartEngine: boolean): Promise<boolean> {
  const ok = await requestMicPermission();
  if (ok && restartEngine) await listeningService.start().catch((e: unknown) => console.error(e));
  return ok;
}

/**
 * The action that fixes this permission, or undefined when none exists here
 * (SMS and battery have no web API; SMS is asked at send time on Android).
 */
export function permissionRequest(
  key: PermissionKey,
  opts: { restartEngine: boolean },
): (() => Promise<boolean>) | undefined {
  if (isNativeActive) {
    if (key === "mic") return () => requestNativeGrant("mic");
    if (key === "location") return () => requestNativeGrant("location");
    if (key === "batteryExempt") {
      return () =>
        requestBatteryExemption()
          .then(() => true)
          .catch(() => false);
    }
    return undefined;
  }
  if (key === "mic") return () => requestWebMic(opts.restartEngine);
  if (key === "location") return requestLocationPermission;
  return undefined;
}

/** Rows that mean something on this platform. The browser has no SMS or battery grant. */
export const VISIBLE_PERMISSIONS: readonly PermissionKey[] = isNativeActive
  ? ["mic", "location", "sms", "batteryExempt"]
  : ["mic", "location"];
