import "server-only";
import { google } from "googleapis";
import type { DocPayload, RenderResult } from "./payload-types";
import { requireEnv } from "@/features/shared/lib/env";

// Scopes are provisional — confirmed/adjusted by the Task B1 auth spike against the
// domain-restricted web app deployment.
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
];

/** Builds the service-account JWT from whichever credential source is configured.
 *
 *  - Local dev: set `GOOGLE_DOC_RENDER_KEY_FILE` to the path of the downloaded
 *    service-account JSON. No multi-line PEM wrangling required.
 *  - Production (Vercel): set `GOOGLE_DOC_RENDER_SA_EMAIL` + `GOOGLE_DOC_RENDER_SA_KEY`
 *    as inline env vars. KEY_FILE takes precedence if both are present.
 */
export function buildJwt() {
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

/** Mints the service-account token, POSTs the JSON body to the renderer web app,
 *  and returns the parsed JSON. Throws on token-mint failure or a non-OK HTTP status.
 *  Callers own their own success/url validation and result mapping. */
async function callRenderer(body: object): Promise<Record<string, unknown>> {
  const jwt = buildJwt();
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Failed to mint service-account access token");

  const res = await fetch(requireEnv("GOOGLE_DOC_RENDER_URL"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Apps Script /exec 302-redirects to script.googleusercontent.com; follow it.
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Renderer returned HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

// Server-side only — called by the /api/document-generation/render route handler,
// NOT used directly as a RenderClient. The client-side RenderClient
// (appsScriptRenderClient) fetches that route; the route bridges to this. Hence the
// flat (payload, tags) signature rather than the RenderClient (payload, opts) shape.
/** Mints a service-account OAuth token (domain-wide delegation) and POSTs the
 *  payload to the deployed Apps Script web app, returning the doc URL. */
export async function renderViaAppsScript(payload: DocPayload, tags: boolean): Promise<RenderResult> {
  const data = (await callRenderer({ ...payload, tags })) as { success: boolean; url?: string; agreementUrl?: string; error?: string };
  if (!data.success || !data.url) throw new Error(`Renderer failed: ${data.error ?? "unknown error"}`);

  return data.agreementUrl ? { docUrl: data.url, agreementUrl: data.agreementUrl } : { docUrl: data.url };
}

export interface SendResult {
  docUrl: string;
  docId?: string;
  sent: boolean;
  signatureRequestId?: string;
  sendError?: string;
}

/** Re-renders the payload with eSign tags ON and auto_send ON (mechanism A) and
 *  returns the Dropbox Sign send result. test_mode is server-injected from
 *  app_settings — never read from the client payload. Reuses buildJwt()/SCOPES. */
export async function sendForSignature(payload: DocPayload, opts: { testMode: boolean }): Promise<SendResult> {
  const data = (await callRenderer({
    ...payload,
    tags: true,
    auto_send: true,
    test_mode: opts.testMode ? "1" : "0",
  })) as {
    success: boolean; url?: string; docId?: string;
    sent?: boolean; signatureRequestId?: string; sendError?: string; error?: string;
  };
  if (!data.success || !data.url) throw new Error(`Send failed: ${data.error ?? "unknown error"}`);

  return {
    docUrl: data.url,
    docId: data.docId,
    sent: data.sent ?? false,
    signatureRequestId: data.signatureRequestId,
    sendError: data.sendError,
  };
}
