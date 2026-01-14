// src/services/geocoding.js

// Using OpenStreetMap Nominatim API via Vite proxy (bypasses CORS)
// Usage Policy: Maximum 1 request per second, valid User-Agent required.

// Use proxy in development, direct URL in production
const NOMINATIM_SEARCH = "/api/nominatim/search";
const NOMINATIM_REVERSE = "/api/nominatim/reverse";

export async function searchLocation(query) {
  if (!query || query.length < 3) return [];

  try {
    const params = new URLSearchParams({
      q: `${query}, Kenya`, // Bias results to Kenya
      format: "json",
      limit: 5,
      addressdetails: 1,
    });

    const response = await fetch(`${NOMINATIM_SEARCH}?${params.toString()}`);

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

    const response = await fetch(`${NOMINATIM_REVERSE}?${params.toString()}`);

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
