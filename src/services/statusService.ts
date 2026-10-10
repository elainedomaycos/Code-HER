// Mock StatusService: answers what the browser can actually observe.
// Honesty limits (codeHER.md §6): the web cannot detect cellular radio state,
// cannot send/query SMS permission, and has no battery-exemption API — those
// return documented mock values and the native layer provides real ones.
import type { StatusService } from "./types";

async function queryPermission(name: PermissionName): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return false;
    const result = await navigator.permissions.query({ name });
    return result.state === "granted";
  } catch {
    return false;
  }
}

export const mockStatusService: StatusService = {
  async getConnectivity(): Promise<{ internet: boolean; cellular: boolean }> {
    const internet = typeof navigator !== "undefined" ? navigator.onLine : true;
    // Web cannot observe the cellular radio; assume the SMS path is available
    // and let send() prove it. Native checks the radio state properly.
    return { internet, cellular: true };
  },
  async getPermissions(): Promise<{
    mic: boolean;
    location: boolean;
    sms: boolean;
    batteryExempt: boolean;
  }> {
    return {
      mic: await queryPermission("microphone"),
      location: await queryPermission("geolocation"),
      sms: false, // browsers cannot send SMS; native only
      batteryExempt: false, // no web API for this; native only
    };
  },
};
