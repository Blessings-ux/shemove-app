import { supabase } from "./supabase";

export const rideService = {
  // Create a new ride request
  createRide: async ({
    passengerId,
    pickupLocation,
    dropoffLocation,
    fare = 0,
  }) => {
    const { data, error } = await supabase
      .from("rides")
      .insert({
        passenger_id: passengerId,
        pickup_location: `POINT(${pickupLocation.lng} ${pickupLocation.lat})`,
        dropoff_location: `POINT(${dropoffLocation.lng} ${dropoffLocation.lat})`,
        pickup_latitude: pickupLocation.lat,
        pickup_longitude: pickupLocation.lng,
        dropoff_latitude: dropoffLocation.lat,
        dropoff_longitude: dropoffLocation.lng,
        status: "pending",
        fare: fare,
      })
      .select()
      .single();

    return { data, error };
  },

  // Update ride status (e.g., driver accepts)
  updateRideStatus: async (rideId, status, driverId = null) => {
    const updates = { status };
    if (driverId) updates.driver_id = driverId;

    const { data, error } = await supabase
      .from("rides")
      .update(updates)
      .eq("id", rideId)
      .select()
      .single();

    return { data, error };
  },

  // Listen for new pending rides (for drivers)
  subscribeToOpenRides: (callback) => {
    return supabase
      .channel("public:rides:status=pending")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rides",
          filter: "status=eq.pending",
        },
        (payload) => callback(payload.new),
      )
      .subscribe();
  },

  // Listen for updates to a specific ride (for passenger/driver involved)
  subscribeToRide: (rideId, callback) => {
    return supabase
      .channel(`public:rides:id=${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rides",
          filter: `id=eq.${rideId}`,
        },
        (payload) => callback(payload.new),
      )
      .subscribe();
  },
};
