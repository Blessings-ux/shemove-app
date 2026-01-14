// src/services/geocoding.js

// Using OpenStreetMap Nominatim API (Free, no key required)
// Usage Policy: Maximum 1 request per second, valid User-Agent required.

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const REVERSE_GEOCODE_URL = "https://nominatim.openstreetmap.org/reverse";

export async function searchLocation(query) {
  if (!query || query.length < 3) return [];

  try {
    const params = new URLSearchParams({
      q: `${query}, Kenya`, // Bias results to Kenya
      format: "json",
      limit: 5,
      addressdetails: 1,
    });

    const response = await fetch(`${NOMINATIM_BASE_URL}?${params.toString()}`, {
      headers: {
        "User-Agent": "JiraniRide-App/1.0", // Required by Nominatim
        "Accept-Language": "en",
      },
    });

    if (!response.ok) throw new Error("Geocoding service unavailable");

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

    const response = await fetch(
      `${REVERSE_GEOCODE_URL}?${params.toString()}`,
      {
        headers: {
          "User-Agent": "JiraniRide-App/1.0",
          "Accept-Language": "en",
        },
      }
    );

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
