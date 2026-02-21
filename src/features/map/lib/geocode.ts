export interface GeocodeSuggestion {
  displayName: string;
  lat: number;
  lng: number;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

export async function searchLocations(
  query: string
): Promise<GeocodeSuggestion[]> {
  if (!query || query.trim().length < 2) return [];

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "5",
    countrycodes: "us",
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: {
        "User-Agent": "TerritoryPlanBuilder/1.0",
      },
    }
  );

  if (!res.ok) return [];

  const data: NominatimResult[] = await res.json();

  return data.map((r) => ({
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));
}

// Geocode a structured address to a single lat/lng point
// Returns null if geocoding fails or no results found
export async function geocodeAddress(address: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}): Promise<{ lat: number; lng: number } | null> {
  const parts = [address.street, address.city, address.state, address.zip].filter(Boolean);
  if (parts.length === 0) return null;

  const query = parts.join(", ");

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      countrycodes: "us",
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: { "User-Agent": "TerritoryPlanBuilder/1.0" } }
    );

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}
