import { describe, it, expect } from "vitest";
import {
  getBuildInfo,
  isNativeActive,
  listeningService,
  locationService,
  requestBatteryExemption,
  smsService,
  statusService,
  storageService,
} from "./index";

// jsdom has no window.Capacitor, so the selector must pick mocks here.
describe("service selector (browser → mocks)", () => {
  it("listening starts stopped", async () => {
    await expect(listeningService.getStatus()).resolves.toBe("stopped");
  });

  it("location has no fix without geolocation or seed", async () => {
    await expect(locationService.getCurrent()).resolves.toBeNull();
  });

  it("sms validates numbers", async () => {
    await expect(smsService.send("+639172840612", "hi")).resolves.toEqual({ ok: true });
    await expect(smsService.send("+14155551234", "hi")).resolves.toEqual({
      ok: false,
      error: "invalid-number",
    });
  });

  it("storage serves defaults", async () => {
    const contacts = await storageService.getContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ name: "Elaine Domaycos", phone: "+639933950898" });
  });

  it("status reports mock permission limits", async () => {
    const p = await statusService.getPermissions();
    expect(p.sms).toBe(false);
    expect(p.batteryExempt).toBe(false);
  });

  it("native helpers are inert without the bridge", async () => {
    expect(isNativeActive).toBe(false);
    await expect(requestBatteryExemption()).resolves.toBeUndefined();
  });

  it("reports a browser build identity", async () => {
    await expect(getBuildInfo()).resolves.toEqual({
      buildTag: "browser",
      versionName: "dev",
      appId: "browser",
    });
  });
});
