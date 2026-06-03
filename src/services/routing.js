// src/services/routing.js

// In development, requests go through the Vite proxy to bypass CORS.
// In production, requests go directly to the OSRM API (CORS is allowed).

const isDev = import.meta.env.DEV;

const OSRM_BASE_URL = isDev
  ? "/api/osrm/route/v1/driving"
  : "https://router.project-osrm.org/route/v1/driving";

/**
 * Fetches routing data between two points (pickup and dropoff).
 * @param {Object} start - { lat, lng }
 * @param {Object} end - { lat, lng }
 * @returns {Promise<Array>} - Array of [lat, lng] coordinates for the polyline
 */
export async function getRoute(start, end) {
  if (!start || !end) return null;

  try {
    // OSRM expects "lng,lat"
    const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;
    const url = `${OSRM_BASE_URL}/${coordinates}?overview=full&geometries=geojson`;

    const response = await fetch(url);
    if (!response.ok) throw new Error("Routing service unavailable");

    const data = await response.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return null;
    }

    // Extract coordinates from GeoJSON [lng, lat] -> [lat, lng] for Leaflet
    const routeCoordinates = data.routes[0].geometry.coordinates.map(
      (coord) => [coord[1], coord[0]]
    );

    return routeCoordinates;
  } catch (error) {
    console.error("Error fetching route:", error);
    return null;
  }
}
