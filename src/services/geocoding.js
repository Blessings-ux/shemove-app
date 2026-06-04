// src/services/geocoding.js

// Using OpenStreetMap Nominatim API
// In development, requests go through the Vite proxy to bypass CORS.
// In production, requests go directly to Nominatim (CORS is allowed for browser fetch).

const isDev = import.meta.env.DEV;

const NOMINATIM_SEARCH = isDev
  ? "/api/nominatim/search"
  : "https://nominatim.openstreetmap.org/search";

const NOMINATIM_REVERSE = isDev
  ? "/api/nominatim/reverse"
  : "https://nominatim.openstreetmap.org/reverse";

export async function searchLocation(query) {
  if (!query || query.length < 3) return [];

  const params = new URLSearchParams({
    q: `${query}, Kenya`, // Bias results to Kenya
    format: "json",
    limit: 5,
    addressdetails: 1,
  });

  // Try proxy first (dev), then fall back to direct API
  const urls = isDev
    ? [
        `${NOMINATIM_SEARCH}?${params.toString()}`,
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      ]
    : [`${NOMINATIM_SEARCH}?${params.toString()}`];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "SheMove-App/1.0 (https://shemove.ke)",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.warn(
          "Nominatim response:",
          response.status,
          response.statusText,
          "- trying next endpoint"
        );
        continue; // Try next URL
      }

      const data = await response.json();

      // Map to our internal format
      return data.map((item) => ({
        name: item.display_name.split(",")[0], // Simple name
        full_name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type,
      }));
    } catch (error) {
      console.warn("Geocoding attempt failed:", error.message);
      continue; // Try next URL
    }
  }

  console.error("All geocoding endpoints failed for query:", query);
  return [];
}

export async function reverseGeocode(lat, lng) {
  const params = new URLSearchParams({
    lat,
    lon: lng,
    format: "json",
    zoom: 18,
    addressdetails: 1,
  });

  // Try proxy first (dev), then fall back to direct API
  const urls = isDev
    ? [
        `${NOMINATIM_REVERSE}?${params.toString()}`,
        `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      ]
    : [`${NOMINATIM_REVERSE}?${params.toString()}`];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "SheMove-App/1.0 (https://shemove.ke)",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.warn("Reverse geocoding response:", response.status, "- trying next endpoint");
        continue;
      }

      const data = await response.json();
      const address = data.address || {};

      // Construct a friendly name
      const name =
        address.road ||
        address.suburb ||
        address.village ||
        address.city ||
        "Unknown Location";
      return {
        name,
        full_name: data.display_name,
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
      };
    } catch (error) {
      console.warn("Reverse geocoding attempt failed:", error.message);
      continue;
    }
  }

  console.error("All reverse geocoding endpoints failed");
  return null;
}
