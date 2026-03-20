import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID, // same Google Cloud project as calendar
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
);

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function getGmailAuthUrl(redirectUri: string, state?: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GMAIL_SCOPES,
    prompt: "consent",
    redirect_uri: redirectUri,
    state: state || "",
  });
}

export async function exchangeGmailCode(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  email: string;
}> {
  const { tokens } = await oauth2Client.getToken({ code, redirect_uri: redirectUri });

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Missing access or refresh token from Google");
  }

  let email = "";
  try {
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    email = data.email || "";
  } catch {
    console.warn("Could not fetch Gmail user info");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(tokens.expiry_date || Date.now() + 3600_000),
    email,
  };
}

export async function refreshGmailToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error("Failed to refresh Gmail access token");
  }
  return {
    accessToken: credentials.access_token,
    expiresAt: new Date(credentials.expiry_date || Date.now() + 3600_000),
  };
}

export function isTokenExpired(expiresAt: Date): boolean {
  return expiresAt <= new Date(Date.now() + 5 * 60_000);
}
