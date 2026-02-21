// Shared fetch helper and API base URL for all feature queries

export const API_BASE = "/api";

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    // Try to read the error body for more context
    let detail = "";
    try {
      const body = await res.json();
      detail = body.error || JSON.stringify(body);
    } catch {
      // Response body isn't JSON (e.g., HTML from a redirect)
      if (res.redirected) {
        detail = "Session expired - please refresh the page";
      }
    }
    throw new Error(
      detail
        ? `${res.status}: ${detail}`
        : `API Error: ${res.status} ${res.statusText}`
    );
  }
  // Verify we actually got JSON (not HTML from a redirect)
  const contentType = res.headers.get("content-type");
  if (contentType && !contentType.includes("application/json")) {
    throw new Error("Session expired - please refresh the page");
  }
  return res.json();
}
