import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchLocations, geocodeAddress } from "../geocode";

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helper to build a Nominatim-shaped response
// ---------------------------------------------------------------------------
function nominatimResult(
  display_name: string,
  lat: string,
  lon: string
) {
  return { display_name, lat, lon };
}

function okResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  };
}

function errorResponse(status = 500) {
  return {
    ok: false,
    status,
    json: async () => ({}),
  };
}

// ---------------------------------------------------------------------------
// searchLocations
// ---------------------------------------------------------------------------
describe("searchLocations", () => {
  it("returns empty array for empty string", async () => {
    const result = await searchLocations("");
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty array for single character query", async () => {
    const result = await searchLocations("a");
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty array for whitespace-only query shorter than 2 chars", async () => {
    const result = await searchLocations("  ");
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls fetch with correct URL and headers", async () => {
    mockFetch.mockResolvedValueOnce(okResponse([]));

    await searchLocations("Austin");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    expect(url).toContain("https://nominatim.openstreetmap.org/search?");
    expect(url).toContain("q=Austin");
    expect(url).toContain("format=json");
    expect(url).toContain("limit=5");
    expect(url).toContain("countrycodes=us");
    expect(options.headers["User-Agent"]).toBe("TerritoryPlanBuilder/1.0");
  });

  it("returns mapped suggestions on success", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse([
        nominatimResult("Austin, TX, USA", "30.2672", "-97.7431"),
        nominatimResult("Austin, MN, USA", "43.6666", "-92.9746"),
      ])
    );

    const result = await searchLocations("Austin");

    expect(result).toEqual([
      { displayName: "Austin, TX, USA", lat: 30.2672, lng: -97.7431 },
      { displayName: "Austin, MN, USA", lat: 43.6666, lng: -92.9746 },
    ]);
  });

  it("returns empty array on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500));

    const result = await searchLocations("Austin");

    expect(result).toEqual([]);
  });

  it("returns empty array on empty results array", async () => {
    mockFetch.mockResolvedValueOnce(okResponse([]));

    const result = await searchLocations("NonexistentPlace12345");

    expect(result).toEqual([]);
  });

  it("parses lat/lon correctly as floats", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse([nominatimResult("Place", "40.7128", "-74.0060")])
    );

    const result = await searchLocations("New York");

    expect(result[0].lat).toBe(40.7128);
    expect(result[0].lng).toBe(-74.006);
    expect(typeof result[0].lat).toBe("number");
    expect(typeof result[0].lng).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// geocodeAddress
// ---------------------------------------------------------------------------
describe("geocodeAddress", () => {
  it("returns null when all address parts are undefined", async () => {
    const result = await geocodeAddress({});
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when all address parts are empty strings", async () => {
    const result = await geocodeAddress({
      street: "",
      city: "",
      state: "",
      zip: "",
    });
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("joins address parts with ', ' in query", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse([nominatimResult("Result", "30.0", "-97.0")])
    );

    await geocodeAddress({
      street: "123 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
    });

    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get("q")).toBe(
      "123 Main St, Austin, TX, 78701"
    );
  });

  it("uses only non-empty address parts (filters out undefined/empty)", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse([nominatimResult("Result", "30.0", "-97.0")])
    );

    await geocodeAddress({
      street: "",
      city: "Austin",
      state: undefined,
      zip: "78701",
    });

    const [url] = mockFetch.mock.calls[0];
    const parsed = new URL(url);
    // Only "Austin" and "78701" should be present, joined with ", "
    expect(parsed.searchParams.get("q")).toBe("Austin, 78701");
  });

  it("sends request with limit=1 and correct headers", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse([nominatimResult("Result", "30.0", "-97.0")])
    );

    await geocodeAddress({ city: "Austin" });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("limit=1");
    expect(url).toContain("format=json");
    expect(url).toContain("countrycodes=us");
    expect(options.headers["User-Agent"]).toBe("TerritoryPlanBuilder/1.0");
  });

  it("returns { lat, lng } on success", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse([nominatimResult("Austin, TX, USA", "30.2672", "-97.7431")])
    );

    const result = await geocodeAddress({ city: "Austin", state: "TX" });

    expect(result).toEqual({ lat: 30.2672, lng: -97.7431 });
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(503));

    const result = await geocodeAddress({ city: "Austin" });

    expect(result).toBeNull();
  });

  it("returns null when no results returned", async () => {
    mockFetch.mockResolvedValueOnce(okResponse([]));

    const result = await geocodeAddress({ city: "Nonexistent" });

    expect(result).toBeNull();
  });

  it("returns null when fetch throws an error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await geocodeAddress({ city: "Austin" });

    expect(result).toBeNull();
  });
});
