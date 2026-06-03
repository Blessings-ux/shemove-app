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

// Headers required by Nominatim usage policy (must identify the app)
const nominatimHeaders = isDev
  ? {}
  : {
      "User-Agent": "SheMove-App/1.0 (https://shemove.ke)",
    };

export async function searchLocation(query) {
  if (!query || query.length < 3) return [];

  try {
    const params = new URLSearchParams({
      q: `${query}, Kenya`, // Bias results to Kenya
      format: "json",
      limit: 5,
      addressdetails: 1,
    });

    const response = await fetch(`${NOMINATIM_SEARCH}?${params.toString()}`, {
      headers: nominatimHeaders,
    });

    if (!response.ok) {
      console.error(
        "Nominatim response:",
        response.status,
        response.statusText
      );
      throw new Error("Geocoding service unavailable");
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
    console.error("Geocoding error:", error);
    return [];
  }
}

export async function reverseGeocode(lat, lng) {
  try {
    const params = new URLSearchParams({
      lat,
      lon: lng,
      format: "json",
      zoom: 18,
      addressdetails: 1,
    });

    const response = await fetch(`${NOMINATIM_REVERSE}?${params.toString()}`, {
      headers: nominatimHeaders,
    });

    if (!response.ok) throw new Error("Reverse geocoding error");

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
    console.error("Reverse geocoding error:", error);
    return null;
  }
}
