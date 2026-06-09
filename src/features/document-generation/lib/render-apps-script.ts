import "server-only";
import { google } from "googleapis";
import type { DocPayload, RenderResult } from "./payload-types";

// Scopes are provisional — confirmed/adjusted by the Task B1 auth spike against the
// domain-restricted web app deployment.
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/** Builds the service-account JWT from whichever credential source is configured.
 *
 *  - Local dev: set `GOOGLE_DOC_RENDER_KEY_FILE` to the path of the downloaded
 *    service-account JSON. No multi-line PEM wrangling required.
 *  - Production (Vercel): set `GOOGLE_DOC_RENDER_SA_EMAIL` + `GOOGLE_DOC_RENDER_SA_KEY`
 *    as inline env vars. KEY_FILE takes precedence if both are present.
 */
function buildJwt() {
  const subject = requireEnv("GOOGLE_DOC_RENDER_SUBJECT");
  const keyFile = process.env.GOOGLE_DOC_RENDER_KEY_FILE;
  if (keyFile) {
    // Local-dev convenience: point at the downloaded service-account JSON.
    return new google.auth.JWT({ keyFile, subject, scopes: SCOPES });
  }
  // Production (e.g. Vercel): inline credentials from env.
  return new google.auth.JWT({
    email: requireEnv("GOOGLE_DOC_RENDER_SA_EMAIL"),
    key: requireEnv("GOOGLE_DOC_RENDER_SA_KEY").replace(/\\n/g, "\n"),
    subject,
    scopes: SCOPES,
  });
}

// Server-side only — called by the /api/document-generation/render route handler,
// NOT used directly as a RenderClient. The client-side RenderClient
// (appsScriptRenderClient) fetches that route; the route bridges to this. Hence the
// flat (payload, tags) signature rather than the RenderClient (payload, opts) shape.
/** Mints a service-account OAuth token (domain-wide delegation) and POSTs the
 *  payload to the deployed Apps Script web app, returning the doc URL. */
export async function renderViaAppsScript(payload: DocPayload, tags: boolean): Promise<RenderResult> {
  const jwt = buildJwt();
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Failed to mint service-account access token");

  const res = await fetch(requireEnv("GOOGLE_DOC_RENDER_URL"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, tags }),
    // Apps Script /exec 302-redirects to script.googleusercontent.com; follow it.
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Renderer returned HTTP ${res.status}`);

  const data = (await res.json()) as { success: boolean; url?: string; agreementUrl?: string; error?: string };
  if (!data.success || !data.url) throw new Error(`Renderer failed: ${data.error ?? "unknown error"}`);

  return data.agreementUrl ? { docUrl: data.url, agreementUrl: data.agreementUrl } : { docUrl: data.url };
}
