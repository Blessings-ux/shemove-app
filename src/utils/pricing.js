// src/utils/pricing.js

// Per-kilometer rates by vehicle type
export const RATES_PER_KM = {
  boda: 50, // Cheapest - motorcycle
  tuktuk: 65, // Mid-range - auto-rickshaw
  taxi: 100, // Premium - car
};

// Legacy single rate (for backward compatibility)
export const PRICE_PER_KM = 75;

// Carpool discount percentage
export const CARPOOL_DISCOUNT = 0.3; // 30% off

// Minimum fares by vehicle type
export const MIN_FARES = {
  boda: 50,
  tuktuk: 100,
  taxi: 200,
};

// 1. Calculate Distance (Haversine Formula) - Returns Kilometers
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km

  return parseFloat(distance.toFixed(1)); // Return 1 decimal place (e.g. 2.5 km)
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// 2. Calculate Fare with vehicle-specific rates
export function calculateFare(
  distanceKm,
  vehicleType = "boda",
  isCarpool = false,
  seatsBooked = 1
) {
  // Get vehicle-specific rate
  const ratePerKm = RATES_PER_KM[vehicleType] || RATES_PER_KM.boda;
  let basePrice = distanceKm * ratePerKm;

  // Apply minimum fare based on vehicle type
  const minFare = MIN_FARES[vehicleType] || 50;
  if (basePrice < minFare) basePrice = minFare;

  // Apply Carpool Discount if selected (price per seat)
  if (isCarpool) {
    // Carpool fare is per seat, with discount
    const discountedPrice = basePrice * (1 - CARPOOL_DISCOUNT);
    return Math.ceil(discountedPrice * seatsBooked);
  }

  return Math.ceil(basePrice); // Round up to nearest shilling
}

// 3. Calculate fare per seat (for carpool offers)
export function calculateFarePerSeat(distanceKm, vehicleType = "taxi") {
  const ratePerKm = RATES_PER_KM[vehicleType] || RATES_PER_KM.taxi;
  let basePrice = distanceKm * ratePerKm;

  const minFare = MIN_FARES[vehicleType] || 200;
  if (basePrice < minFare) basePrice = minFare;

  // Apply carpool discount and divide by typical seats (4)
  const discountedTotal = basePrice * (1 - CARPOOL_DISCOUNT);
  return Math.ceil(discountedTotal / 4);
}

// 4. Get fare breakdown
export function getFareBreakdown(
  distanceKm,
  vehicleType = "boda",
  isCarpool = false,
  seatsBooked = 1
) {
  const ratePerKm = RATES_PER_KM[vehicleType] || RATES_PER_KM.boda;
  const baseFare = distanceKm * ratePerKm;
  const minFare = MIN_FARES[vehicleType] || 50;
  const appliedBase = Math.max(baseFare, minFare);
  const discount = isCarpool ? appliedBase * CARPOOL_DISCOUNT : 0;
  const fareBeforeSeats = Math.ceil(appliedBase - discount);
  const finalFare = isCarpool ? fareBeforeSeats * seatsBooked : fareBeforeSeats;

  return {
    distance: distanceKm,
    ratePerKm,
    baseFare: Math.ceil(baseFare),
    minFare,
    appliedBase: Math.ceil(appliedBase),
    carpoolDiscount: Math.ceil(discount),
    seatsBooked,
    finalFare,
  };
}
