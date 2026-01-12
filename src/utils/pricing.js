// src/utils/pricing.js

export const PRICE_PER_KM = 75; // User requirement: 1km = 75 KES
export const CARPOOL_DISCOUNT = 0.3; // 30% discount if they choose Carpool

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

// 2. Calculate Price
export function calculateFare(
  distanceKm,
  vehicleType = "boda",
  isCarpool = false
) {
  let basePrice = distanceKm * PRICE_PER_KM;

  // Apply minimum fare based on vehicle type
  const minFare = MIN_FARES[vehicleType] || 50;
  if (basePrice < minFare) basePrice = minFare;

  // Apply Carpool Discount if selected
  if (isCarpool) {
    basePrice = basePrice * (1 - CARPOOL_DISCOUNT);
  }

  return Math.ceil(basePrice); // Round up to nearest shilling
}

// 3. Get fare breakdown
export function getFareBreakdown(
  distanceKm,
  vehicleType = "boda",
  isCarpool = false
) {
  const baseFare = distanceKm * PRICE_PER_KM;
  const minFare = MIN_FARES[vehicleType] || 50;
  const appliedBase = Math.max(baseFare, minFare);
  const discount = isCarpool ? appliedBase * CARPOOL_DISCOUNT : 0;
  const finalFare = Math.ceil(appliedBase - discount);

  return {
    distance: distanceKm,
    ratePerKm: PRICE_PER_KM,
    baseFare: Math.ceil(baseFare),
    minFare,
    appliedBase: Math.ceil(appliedBase),
    carpoolDiscount: Math.ceil(discount),
    finalFare,
  };
}
