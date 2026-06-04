import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import { useWakeLock } from "./useWakeLock";

export const useDriverLocation = (driverId, isOnline) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);

  // Enable Wake Lock when online
  useWakeLock();

  useEffect(() => {
    if (!isOnline || !driverId) return;

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    const handleSuccess = async (position) => {
      const { latitude, longitude } = position.coords;
      setLocation({ lat: latitude, lng: longitude });

      // Update in Supabase
      try {
        const { error: dbError } = await supabase
          .from("driver_locations")
          .upsert(
            {
              driver_id: driverId,
              location: `SRID=4326;POINT(${longitude} ${latitude})`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "driver_id" }
          );

        if (dbError) console.error("Error updating location:", dbError);
      } catch (err) {
        console.error("Failed to sync location:", err);
      }
    };

    const handleError = (error) => {
      setError(error.message);
    };

    const watchId = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, driverId]);

  return { location, error };
};
