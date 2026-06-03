export const PICKUP_STEPS = [
  {
    key: "accepted",
    label: "Driver en route",
    shortLabel: "En route",
    description: "Your driver is heading to the pickup point.",
  },
  {
    key: "arrived",
    label: "Driver arrived",
    shortLabel: "Driver here",
    description: "The driver has reached the pickup location.",
  },
  {
    key: "passenger_arrived",
    label: "Passenger at pickup",
    shortLabel: "You arrived",
    description: "Passenger confirmed they are at the pickup point.",
  },
  {
    key: "in_progress",
    label: "Ride started",
    shortLabel: "In progress",
    description: "Trip is underway.",
  },
];

export function getPickupStepIndex(status) {
  const order = ["accepted", "arrived", "passenger_arrived", "in_progress"];
  const index = order.indexOf(status);
  if (index === -1) return status === "pending" ? -1 : 0;
  return index;
}

export function getPassengerStatusMessage(ride) {
  if (!ride) return { title: "Waiting", subtitle: "" };

  switch (ride.status) {
    case "accepted":
      return {
        title: "Driver on the way",
        subtitle: "You'll be notified when they reach the pickup point.",
      };
    case "arrived":
      return {
        title: "Driver has arrived",
        subtitle: "Head to the pickup point and tap I'm Here when you arrive.",
      };
    case "passenger_arrived":
      return {
        title: "You're at the pickup",
        subtitle: "Your driver knows you're here. Board when ready.",
      };
    case "in_progress":
      return {
        title: "Ride in progress",
        subtitle: "Enjoy your trip.",
      };
    case "completed":
      return {
        title: "Ride completed",
        subtitle: ride.payment_status === "paid" ? "Thank you for riding with us!" : "Please complete your payment.",
      };
    default:
      return { title: "Finding driver", subtitle: "Please wait..." };
  }
}

export function getDriverStatusMessage(ride) {
  if (!ride) return { title: "Active ride", subtitle: "" };

  switch (ride.status) {
    case "accepted":
      return {
        title: "En route to pickup",
        subtitle: "Tap Arrived at Pickup when you reach the passenger.",
      };
    case "arrived":
      return {
        title: "Waiting for passenger",
        subtitle: "Passenger has not confirmed arrival yet.",
      };
    case "passenger_arrived":
      return {
        title: "Passenger is here",
        subtitle: "Passenger confirmed at pickup. You can start the ride.",
      };
    case "in_progress":
      return {
        title: "Ride in progress",
        subtitle: "Navigate to the drop-off and end the ride when done.",
      };
    default:
      return { title: ride.status, subtitle: "" };
  }
}

export function canDriverMarkArrived(status) {
  return status === "accepted";
}

export function canPassengerConfirmArrival(status) {
  return status === "arrived";
}

export function canDriverStartRide(status) {
  return status === "passenger_arrived";
}
