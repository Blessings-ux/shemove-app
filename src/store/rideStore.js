import { create } from "zustand";
import { rideService } from "../services/rideService";

export const useRideStore = create((set, get) => ({
  currentRide: null,
  pendingRides: [], // For drivers
  isLoading: false,
  error: null,

  requestRide: async (passengerId, pickup, dropoff) => {
    set({ isLoading: true, error: null });
    // In a real app, you'd calculate fare here based on distance
    const fare = 500; // Mock fare
    const { data, error } = await rideService.createRide({
      passengerId,
      pickupLocation: pickup,
      dropoffLocation: dropoff,
      fare,
    });

    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ currentRide: data, isLoading: false });
    }
  },

  acceptRide: async (rideId, driverId) => {
    set({ isLoading: true, error: null });
    const { data, error } = await rideService.updateRideStatus(
      rideId,
      "accepted",
      driverId
    );

    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ currentRide: data, isLoading: false });
      // Remove from pending list
      set((state) => ({
        pendingRides: state.pendingRides.filter((r) => r.id !== rideId),
      }));
    }
  },

  updateStatus: async (rideId, status) => {
    // e.g., 'ongoing', 'completed', 'cancelled'
    set({ isLoading: true, error: null });
    const { data, error } = await rideService.updateRideStatus(rideId, status);

    if (error) {
      set({ error: error.message, isLoading: false });
    } else {
      set({ currentRide: data, isLoading: false });
    }
  },

  // For drivers to add incoming rides to their feed
  addPendingRide: (ride) => {
    set((state) => ({ pendingRides: [ride, ...state.pendingRides] }));
  },

  completeRide: async (rideId) => {
    set({ isLoading: true, error: null });

    // 1. Mark ride as completed and paid
    const { data, error } = await rideService.updateRideStatus(
      rideId,
      "completed"
    );

    if (error) {
      set({ error: error.message, isLoading: false });
      // Don't return, allow simulation to proceed for UI purposes if needed?
      // No, error state is better.
      return;
    }

    set({ currentRide: null, isLoading: false });
    // In a real app we'd trigger a toast notification here
    console.log("Ride completed! +10 Loyalty Points earned.");
  },

  setCurrentRide: (ride) => set({ currentRide: ride }),
}));
