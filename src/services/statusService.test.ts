import { describe, it, expect } from "vitest";
import { mockStatusService } from "./statusService";

describe("mock status service", () => {
  it("reports connectivity flags", async () => {
    const c = await mockStatusService.getConnectivity();
    expect(typeof c.internet).toBe("boolean");
    expect(typeof c.cellular).toBe("boolean");
  });

  it("reports permission flags (sms/battery are native-only, so false in browser)", async () => {
    const p = await mockStatusService.getPermissions();
    expect(typeof p.mic).toBe("boolean");
    expect(typeof p.location).toBe("boolean");
    expect(p.sms).toBe(false);
    expect(p.batteryExempt).toBe(false);
  });
});
