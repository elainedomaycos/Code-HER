package com.codeher.app;

import android.content.Context;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

/**
 * Best-available location without Play Services (codeHER.md §5).
 *
 * <p>Tries one fresh single-update from GPS (falling back to the network
 * provider), capped at 8 seconds — sending must never block on a slow fix.
 * Falls back to the last-known fix; reports {@code null} when nothing
 * exists so the SMS goes out without coordinates. Callers must hold a
 * location permission (the plugin requests it at runtime).
 */
public class HerLocationProvider {

    private static final String TAG = "HerLocation";
    private static final long TIMEOUT_MS = 8000;

    /** @param fresh true for a live fix, false for last-known. */
    public interface Callback {
        void onResult(Location location, boolean fresh);
    }

    public static void getCurrent(Context context, Callback callback) {
        LocationManager manager =
                (LocationManager) context.getSystemService(Context.LOCATION_SERVICE);
        if (manager == null) {
            callback.onResult(null, false);
            return;
        }
        boolean gpsEnabled = false;
        boolean networkEnabled = false;
        try {
            gpsEnabled = manager.isProviderEnabled(LocationManager.GPS_PROVIDER);
        } catch (Exception e) {
            Log.w(TAG, "gps provider query failed", e);
        }
        try {
            networkEnabled = manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception e) {
            Log.w(TAG, "network provider query failed", e);
        }

        Location lastKnown = null;
        try {
            if (gpsEnabled) {
                lastKnown = manager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            }
            if (lastKnown == null && networkEnabled) {
                lastKnown = manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
            }
        } catch (SecurityException e) {
            callback.onResult(null, false);
            return;
        }
        final Location fallback = lastKnown;

        String provider = null;
        if (gpsEnabled) {
            provider = LocationManager.GPS_PROVIDER;
        } else if (networkEnabled) {
            provider = LocationManager.NETWORK_PROVIDER;
        }
        if (provider == null) {
            Log.i(TAG, "no provider enabled, fallback=" + describe(fallback));
            callback.onResult(fallback, false);
            return;
        }

        final boolean[] settled = { false };
        final Handler handler = new Handler(Looper.getMainLooper());
        final LocationManager mgr = manager;
        LocationListener listener =
                new LocationListener() {
                    @Override
                    public void onLocationChanged(Location location) {
                        if (settled[0]) {
                            return;
                        }
                        settled[0] = true;
                        handler.removeCallbacksAndMessages(null);
                        try {
                            mgr.removeUpdates(this);
                        } catch (Exception ignored) {
                        }
                        Log.i(TAG, "live fix: " + describe(location));
                        callback.onResult(location, true);
                    }

                    @Override
                    public void onStatusChanged(String provider, int status, Bundle extras) {}

                    @Override
                    public void onProviderEnabled(String provider) {}

                    @Override
                    public void onProviderDisabled(String provider) {}
                };
        try {
            // Listen on every enabled provider; the first fix wins (network
            // is fast indoors where GPS stalls, GPS wins outdoors).
            if (gpsEnabled) {
                manager.requestSingleUpdate(
                        LocationManager.GPS_PROVIDER, listener, Looper.getMainLooper());
            }
            if (networkEnabled) {
                manager.requestSingleUpdate(
                        LocationManager.NETWORK_PROVIDER, listener, Looper.getMainLooper());
            }
        } catch (SecurityException e) {
            Log.i(TAG, "permission missing, fallback=" + describe(fallback));
            callback.onResult(fallback, false);
            return;
        } catch (Exception e) {
            Log.w(TAG, "single update failed, using fallback", e);
            callback.onResult(fallback, false);
            return;
        }
        handler.postDelayed(
                () -> {
                    if (settled[0]) {
                        return;
                    }
                    settled[0] = true;
                    try {
                        mgr.removeUpdates(listener);
                    } catch (Exception ignored) {
                    }
                    Log.i(TAG, "timeout, fallback=" + describe(fallback));
                    callback.onResult(fallback, false);
                },
                TIMEOUT_MS);
    }

    private static String describe(Location location) {
        if (location == null) {
            return "none";
        }
        return location.getProvider()
                + " lat="
                + location.getLatitude()
                + " lng="
                + location.getLongitude()
                + " acc="
                + Math.round(location.getAccuracy())
                + "m";
    }
}
