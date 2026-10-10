// Browser permission prompts for onboarding. Each helper triggers the OS
// permission dialog and releases the resource immediately — the app only
// needs the grant, never the stream or a continuous watch. SMS and
// battery-exemption have no web API (Android-only, requested natively).
export async function requestMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
    if (!stream) return false;
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export async function requestLocationPermission(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.geolocation) return false;
    await new Promise<GeolocationPosition>((res, rej) => {
      const t = setTimeout(() => rej(new Error("timeout")), 8000);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          clearTimeout(t);
          res(p);
        },
        (e) => {
          clearTimeout(t);
          rej(e);
        },
        { timeout: 8000 },
      );
    });
    return true;
  } catch {
    return false;
  }
}
