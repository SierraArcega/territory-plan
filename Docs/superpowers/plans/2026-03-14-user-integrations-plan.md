# User Integrations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable reps to connect Gmail, Google Calendar, Slack, and Mixmax from their profile, sync activity into a unified district timeline, and perform outreach from contact cards.

**Architecture:** Direct OAuth flows per service via Next.js API routes, encrypted token storage in a unified `UserIntegration` Prisma model, per-service adapter modules under `src/features/integrations/`, and normalized activity data flowing into the existing `Activity` model with junction tables for district/contact correlation.

**Tech Stack:** Next.js 16, React 19, Prisma/PostgreSQL, Google APIs (`googleapis`), Slack Web API (`@slack/web-api`), Mixmax REST API, TanStack Query, Vitest, TailwindCSS v4

**Spec:** `docs/superpowers/specs/2026-03-14-user-integrations-design.md`

---

## Chunk 1: OAuth Infrastructure + Profile Connection UI

### File Structure

```
Create: prisma/migrations/XXXXXX_add_user_integrations/migration.sql (auto-generated)
Create: src/features/integrations/lib/encryption.ts                    — AES-256-GCM encrypt/decrypt
Create: src/features/integrations/lib/__tests__/encryption.test.ts     — Encryption unit tests
Create: src/features/integrations/lib/queries.ts                       — TanStack Query hooks
Create: src/features/integrations/types.ts                             — Shared types
Create: src/app/api/integrations/route.ts                              — GET list all connections for user
Create: src/app/api/integrations/gmail/connect/route.ts                — GET redirect to Gmail OAuth
Create: src/app/api/integrations/gmail/callback/route.ts               — GET handle Gmail OAuth callback
Create: src/app/api/integrations/gmail/disconnect/route.ts             — POST disconnect Gmail
Create: src/app/api/integrations/slack/connect/route.ts                — GET redirect to Slack OAuth
Create: src/app/api/integrations/slack/callback/route.ts               — GET handle Slack OAuth callback
Create: src/app/api/integrations/slack/disconnect/route.ts             — POST disconnect Slack
Create: src/app/api/integrations/mixmax/connect/route.ts               — POST connect via API key
Create: src/app/api/integrations/mixmax/disconnect/route.ts            — POST disconnect Mixmax
Create: src/features/integrations/lib/google-gmail.ts                  — Gmail OAuth helpers
Create: src/features/integrations/lib/slack-oauth.ts                   — Slack OAuth helpers
Create: src/features/integrations/components/ConnectedAccountsSection.tsx — Profile UI
Create: src/features/integrations/components/MixmaxConnectModal.tsx    — API key input modal
Create: scripts/migrate-calendar-tokens.ts                             — One-time script to encrypt existing CalendarConnection tokens
Modify: prisma/schema.prisma                                           — Add UserIntegration model
Modify: src/features/shared/components/views/ProfileView.tsx           — Add ConnectedAccountsSection
Modify: src/features/shared/types/api-types.ts                         — Widen Activity.source union type
Modify: src/lib/api.ts                                                 — Export integration queries
Modify: .env.example                                                   — Add ENCRYPTION_KEY, SLACK_CLIENT_ID/SECRET
```

---

### Task 1: Add UserIntegration Prisma model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add UserIntegration model to schema**

Add after `UserProfile` model (around line 670):

```prisma
// ===== Service Integrations =====
// Per-user OAuth connections for Gmail, Google Calendar, Slack, Mixmax
// Tokens are encrypted at rest via AES-256-GCM (see src/features/integrations/lib/encryption.ts)

model UserIntegration {
  id             String    @id @default(uuid())
  userId         String    @map("user_id") @db.Uuid
  service        String    @db.VarChar(30) // "gmail", "google_calendar", "slack", "mixmax"
  accountEmail   String?   @map("account_email") @db.VarChar(255)
  accountName    String?   @map("account_name") @db.VarChar(255)
  accessToken    String    @map("access_token") @db.Text // encrypted
  refreshToken   String?   @map("refresh_token") @db.Text // encrypted
  tokenExpiresAt DateTime? @map("token_expires_at")
  scopes         String[]  @default([])
  metadata       Json?     // service-specific (Slack workspace, Calendar companyDomain, etc.)
  syncEnabled    Boolean   @default(true) @map("sync_enabled")
  status         String    @default("connected") @db.VarChar(20)
  lastSyncAt     DateTime? @map("last_sync_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  user UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, service])
  @@index([userId])
  @@map("user_integrations")
}
```

Add relation to `UserProfile` model:

```prisma
  integrations       UserIntegration[]
```

- [ ] **Step 2: Add new Activity fields for Gmail/Slack dedup and Mixmax enrichment**

Add to the Activity model after the existing `source` field:

```prisma
  // Gmail dedup (parallel to existing googleEventId)
  gmailMessageId      String?  @unique @map("gmail_message_id")

  // Slack dedup
  slackChannelId      String?  @map("slack_channel_id") @db.VarChar(50)
  slackMessageTs      String?  @map("slack_message_ts")

  // Service-specific metadata
  integrationMeta     Json?    @map("integration_meta")

  // Mixmax sequence enrichment
  mixmaxSequenceName  String?  @map("mixmax_sequence_name") @db.VarChar(255)
  mixmaxSequenceStep  Int?     @map("mixmax_sequence_step")
  mixmaxSequenceTotal Int?     @map("mixmax_sequence_total")
  mixmaxStatus        String?  @map("mixmax_status") @db.VarChar(30)
  mixmaxOpenCount     Int?     @map("mixmax_open_count")
  mixmaxClickCount    Int?     @map("mixmax_click_count")
```

Add unique constraint to Activity:

```prisma
  @@unique([slackChannelId, slackMessageTs])
```

- [ ] **Step 3: Widen Activity.source to VarChar(30)**

Change existing `source` field from `@db.VarChar(20)` to `@db.VarChar(30)` to accommodate future source values.

- [ ] **Step 4: Generate and run migration**

Run: `npx prisma migrate dev --name add_user_integrations`
Expected: Migration SQL generated and applied. No errors.

- [ ] **Step 5: Verify Prisma client generation**

Run: `npx prisma generate`
Expected: Prisma client regenerated with new `UserIntegration` model and Activity fields.

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add UserIntegration model and Activity integration fields"
```

---

### Task 2: Build encryption utility

**Files:**
- Create: `src/features/integrations/lib/encryption.ts`
- Create: `src/features/integrations/lib/__tests__/encryption.test.ts`

- [ ] **Step 1: Write failing tests for encryption**

```typescript
// src/features/integrations/lib/__tests__/encryption.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock env var
vi.stubEnv("ENCRYPTION_KEY", "aab1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1");

import { encrypt, decrypt } from "../encryption";

describe("encryption", () => {
  it("encrypts and decrypts a string round-trip", () => {
    const plaintext = "my-secret-token-12345";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(":"); // iv:authTag:ciphertext format
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const plaintext = "same-token";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", () => {
    const encrypted = encrypt("test");
    const [iv, authTag, ciphertext] = encrypted.split(":");
    const tampered = `${iv}:${authTag}:${ciphertext.slice(0, -2)}aa`;
    expect(() => decrypt(tampered)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/integrations/lib/__tests__/encryption.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement encryption module**

```typescript
// src/features/integrations/lib/encryption.ts
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 64) {
    throw new Error("ENCRYPTION_KEY must be set (64 hex chars = 32 bytes)");
  }
  return Buffer.from(key, "hex");
}

/** Encrypt plaintext → "iv:authTag:ciphertext" (all hex-encoded) */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypt "iv:authTag:ciphertext" → plaintext */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted format — expected iv:authTag:ciphertext");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"), {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/integrations/lib/__tests__/encryption.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Add ENCRYPTION_KEY to .env.example**

Add to `.env.example`:
```
# Token encryption (64 hex chars = 32 bytes for AES-256)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=
```

- [ ] **Step 6: Commit**

```bash
git add src/features/integrations/lib/encryption.ts src/features/integrations/lib/__tests__/encryption.test.ts .env.example
git commit -m "feat(integrations): add AES-256-GCM token encryption utility"
```

---

### Task 3: Build integration types and API list endpoint

**Files:**
- Create: `src/features/integrations/types.ts`
- Create: `src/app/api/integrations/route.ts`

- [ ] **Step 1: Create shared types**

```typescript
// src/features/integrations/types.ts
export type IntegrationService = "gmail" | "google_calendar" | "slack" | "mixmax";

export type IntegrationStatus = "connected" | "expired" | "disconnected" | "error";

export interface IntegrationConnection {
  id: string;
  service: IntegrationService;
  accountEmail: string | null;
  accountName: string | null;
  status: IntegrationStatus;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  metadata: Record<string, unknown> | null;
  connectedAt: string;
}

// All supported services with display metadata
export const INTEGRATION_SERVICES: Record<IntegrationService, {
  label: string;
  description: string;
  color: string;
  icon: string; // short letter(s) for avatar
  isOAuth: boolean;
}> = {
  gmail: {
    label: "Gmail",
    description: "Sync emails and send messages to district contacts",
    color: "#EA4335",
    icon: "G",
    isOAuth: true,
  },
  google_calendar: {
    label: "Google Calendar",
    description: "Sync meetings and schedule events",
    color: "#4285F4",
    icon: "C",
    isOAuth: true,
  },
  slack: {
    label: "Slack",
    description: "Read channels, send messages, and get notifications",
    color: "#4A154B",
    icon: "S",
    isOAuth: true,
  },
  mixmax: {
    label: "Mixmax",
    description: "Track email sequences and engagement",
    color: "#FF6B4A",
    icon: "Mx",
    isOAuth: false,
  },
};
```

- [ ] **Step 2: Create GET /api/integrations endpoint**

```typescript
// src/app/api/integrations/route.ts
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import type { IntegrationConnection } from "@/features/integrations/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integrations = await prisma.userIntegration.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        service: true,
        accountEmail: true,
        accountName: true,
        status: true,
        syncEnabled: true,
        lastSyncAt: true,
        metadata: true,
        createdAt: true,
      },
    });

    const connections: IntegrationConnection[] = integrations.map((i) => ({
      id: i.id,
      service: i.service as IntegrationConnection["service"],
      accountEmail: i.accountEmail,
      accountName: i.accountName,
      status: i.status as IntegrationConnection["status"],
      syncEnabled: i.syncEnabled,
      lastSyncAt: i.lastSyncAt?.toISOString() ?? null,
      metadata: i.metadata as Record<string, unknown> | null,
      connectedAt: i.createdAt.toISOString(),
    }));

    return NextResponse.json(connections);
  } catch (error) {
    console.error("Failed to list integrations:", error);
    return NextResponse.json({ error: "Failed to list integrations" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/integrations/types.ts src/app/api/integrations/route.ts
git commit -m "feat(integrations): add shared types and list endpoint"
```

---

### Task 4: Build Gmail OAuth connect/callback/disconnect routes

**Files:**
- Create: `src/features/integrations/lib/google-gmail.ts`
- Create: `src/app/api/integrations/gmail/connect/route.ts`
- Create: `src/app/api/integrations/gmail/callback/route.ts`
- Create: `src/app/api/integrations/gmail/disconnect/route.ts`

- [ ] **Step 1: Create Gmail OAuth helper**

Follow the pattern in `src/features/calendar/lib/google.ts` but with Gmail scopes:

```typescript
// src/features/integrations/lib/google-gmail.ts
import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CALENDAR_CLIENT_ID, // same Google Cloud project
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
```

- [ ] **Step 2: Create Gmail connect route**

Follow pattern from `src/app/api/calendar/connect/route.ts`:

```typescript
// src/app/api/integrations/gmail/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getGmailAuthUrl } from "@/features/integrations/lib/google-gmail";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { origin } = new URL(request.url);
    const redirectUri = `${origin}/api/integrations/gmail/callback`;

    const state = Buffer.from(
      JSON.stringify({
        userId: user.id,
        nonce: crypto.randomBytes(16).toString("hex"),
      })
    ).toString("base64url");

    return NextResponse.redirect(getGmailAuthUrl(redirectUri, state));
  } catch (error) {
    console.error("Gmail connect error:", error);
    return NextResponse.json({ error: "Failed to initiate Gmail connection" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create Gmail callback route**

```typescript
// src/app/api/integrations/gmail/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { exchangeGmailCode } from "@/features/integrations/lib/google-gmail";
import { encrypt } from "@/features/integrations/lib/encryption";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/?integrationError=access_denied&service=gmail`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/?integrationError=no_code&service=gmail`);
  }

  try {
    const user = await getUser();
    if (!user) return NextResponse.redirect(`${origin}/login`);

    // Verify CSRF state
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
        if (stateData.userId !== user.id) {
          return NextResponse.redirect(`${origin}/?integrationError=state_mismatch&service=gmail`);
        }
      } catch {
        console.warn("Gmail callback: could not parse state token");
      }
    }

    const redirectUri = `${origin}/api/integrations/gmail/callback`;
    const tokens = await exchangeGmailCode(code, redirectUri);

    await prisma.userIntegration.upsert({
      where: { userId_service: { userId: user.id, service: "gmail" } },
      update: {
        accountEmail: tokens.email,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scopes: ["gmail.readonly", "gmail.send", "userinfo.email"],
        status: "connected",
        syncEnabled: true,
      },
      create: {
        userId: user.id,
        service: "gmail",
        accountEmail: tokens.email,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scopes: ["gmail.readonly", "gmail.send", "userinfo.email"],
        status: "connected",
        syncEnabled: true,
      },
    });

    return NextResponse.redirect(`${origin}/?tab=profile&gmailConnected=true`);
  } catch (err) {
    console.error("Gmail callback error:", err);
    return NextResponse.redirect(`${origin}/?integrationError=token_exchange_failed&service=gmail`);
  }
}
```

- [ ] **Step 4: Create Gmail disconnect route**

```typescript
// src/app/api/integrations/gmail/disconnect/route.ts
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.userIntegration.delete({
      where: { userId_service: { userId: user.id, service: "gmail" } },
    }).catch(() => null); // Ignore if not found

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Gmail disconnect error:", error);
    return NextResponse.json({ error: "Failed to disconnect Gmail" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/integrations/lib/google-gmail.ts src/app/api/integrations/gmail/
git commit -m "feat(integrations): add Gmail OAuth connect/callback/disconnect routes"
```

---

### Task 5: Build Slack OAuth connect/callback/disconnect routes

**Files:**
- Create: `src/features/integrations/lib/slack-oauth.ts`
- Create: `src/app/api/integrations/slack/connect/route.ts`
- Create: `src/app/api/integrations/slack/callback/route.ts`
- Create: `src/app/api/integrations/slack/disconnect/route.ts`

- [ ] **Step 1: Add Slack OAuth env vars to .env.example**

```
# Slack OAuth (create at api.slack.com/apps)
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
```

- [ ] **Step 2: Create Slack OAuth helper**

```typescript
// src/features/integrations/lib/slack-oauth.ts

const SLACK_SCOPES = [
  "channels:read",
  "channels:history",
  "chat:write",
  "users:read",
  "users:read.email",
].join(",");

export function getSlackAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID || "",
    scope: SLACK_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCode(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  teamId: string;
  teamName: string;
  botUserId: string;
  authedUserEmail: string;
}> {
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID || "",
      client_secret: process.env.SLACK_CLIENT_SECRET || "",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`);
  }

  // Fetch authed user's email
  let authedUserEmail = "";
  try {
    const userRes = await fetch("https://slack.com/api/users.info", {
      headers: { Authorization: `Bearer ${data.access_token}` },
      method: "POST",
      body: new URLSearchParams({ user: data.authed_user?.id || "" }),
    });
    const userData = await userRes.json();
    authedUserEmail = userData.user?.profile?.email || "";
  } catch {
    console.warn("Could not fetch Slack user email");
  }

  return {
    accessToken: data.access_token,
    teamId: data.team?.id || "",
    teamName: data.team?.name || "",
    botUserId: data.bot_user_id || "",
    authedUserEmail,
  };
}
```

- [ ] **Step 3: Create Slack connect/callback/disconnect routes**

Follow exact same patterns as Gmail routes (Tasks 4.2-4.4) but with Slack-specific logic:
- Connect: redirect to `getSlackAuthUrl()`
- Callback: exchange code via `exchangeSlackCode()`, store encrypted token in `UserIntegration` with `service: "slack"`, store `metadata: { teamId, teamName, botUserId }`
- Disconnect: delete `UserIntegration` where `service: "slack"`

- [ ] **Step 4: Commit**

```bash
git add src/features/integrations/lib/slack-oauth.ts src/app/api/integrations/slack/ .env.example
git commit -m "feat(integrations): add Slack OAuth connect/callback/disconnect routes"
```

---

### Task 6: Build Mixmax API key connection

**Files:**
- Create: `src/app/api/integrations/mixmax/connect/route.ts`
- Create: `src/app/api/integrations/mixmax/disconnect/route.ts`

- [ ] **Step 1: Create Mixmax connect route (API key, not OAuth)**

```typescript
// src/app/api/integrations/mixmax/connect/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { encrypt } from "@/features/integrations/lib/encryption";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    // Validate the key against Mixmax API
    const validateRes = await fetch("https://api.mixmax.com/v1/users/me", {
      headers: { "X-API-Token": apiKey },
    });

    if (!validateRes.ok) {
      return NextResponse.json({ error: "Invalid Mixmax API key" }, { status: 400 });
    }

    const mixmaxUser = await validateRes.json();

    await prisma.userIntegration.upsert({
      where: { userId_service: { userId: user.id, service: "mixmax" } },
      update: {
        accountEmail: mixmaxUser.email || null,
        accountName: mixmaxUser.name || null,
        accessToken: encrypt(apiKey),
        status: "connected",
      },
      create: {
        userId: user.id,
        service: "mixmax",
        accountEmail: mixmaxUser.email || null,
        accountName: mixmaxUser.name || null,
        accessToken: encrypt(apiKey),
        status: "connected",
        syncEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      accountEmail: mixmaxUser.email,
      accountName: mixmaxUser.name,
    });
  } catch (error) {
    console.error("Mixmax connect error:", error);
    return NextResponse.json({ error: "Failed to connect Mixmax" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create Mixmax disconnect route (same pattern as Gmail/Slack)**

- [ ] **Step 3: Commit**

```bash
git add src/app/api/integrations/mixmax/
git commit -m "feat(integrations): add Mixmax API key connect/disconnect routes"
```

---

### Task 7: Build TanStack Query hooks for integrations

**Files:**
- Create: `src/features/integrations/lib/queries.ts`
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Create query hooks**

```typescript
// src/features/integrations/lib/queries.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/features/shared/lib/api-client";
import type { IntegrationConnection, IntegrationService } from "../types";

const API = "/api/integrations";

export function useIntegrations() {
  return useQuery<IntegrationConnection[]>({
    queryKey: ["integrations"],
    queryFn: () => fetchJson(API),
    staleTime: 5 * 60_000, // 5 min
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (service: IntegrationService) =>
      fetchJson(`${API}/${service}/disconnect`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}

export function useConnectMixmax() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (apiKey: string) =>
      fetchJson(`${API}/mixmax/connect`, {
        method: "POST",
        body: JSON.stringify({ apiKey }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}
```

- [ ] **Step 2: Add export to barrel file**

Add to `src/lib/api.ts`:
```typescript
export * from "@/features/integrations/lib/queries";
```

- [ ] **Step 3: Commit**

```bash
git add src/features/integrations/lib/queries.ts src/lib/api.ts
git commit -m "feat(integrations): add TanStack Query hooks"
```

---

### Task 8: Build Connected Accounts UI on Profile

**Files:**
- Create: `src/features/integrations/components/ConnectedAccountsSection.tsx`
- Create: `src/features/integrations/components/MixmaxConnectModal.tsx`
- Modify: `src/features/shared/components/views/ProfileView.tsx`

- [ ] **Step 1: Create MixmaxConnectModal component**

A small modal with an API key input field and "Connect" button. Uses `useConnectMixmax()` mutation. Shows inline error on invalid key. Follow the modal pattern from `ActivityFormModal.tsx` (escape to close, backdrop click to close).

- [ ] **Step 2: Create ConnectedAccountsSection component**

```
ConnectedAccountsSection
├── Uses useIntegrations() to fetch connection status
├── Renders a card for each service in INTEGRATION_SERVICES
├── For OAuth services (Gmail, Calendar, Slack): "Connect" links to /api/integrations/[service]/connect
├── For Mixmax: "Connect" opens MixmaxConnectModal
├── Connected services show: green dot, account email, "Disconnect" button
├── Disconnected services show: "Not connected", "Connect" button (Plum #403770)
├── Mixmax labeled as "Gmail enhancement"
├── Loading state: skeleton cards
├── Disconnect uses useDisconnectIntegration() mutation with confirmation
```

- [ ] **Step 3: Integrate into ProfileView**

Add `<ConnectedAccountsSection />` between the profile card and the actions section in `ProfileView.tsx`. Import from `@/features/integrations/components/ConnectedAccountsSection`.

- [ ] **Step 4: Test manually**

Run: `npm run dev`
Navigate to Profile tab. Verify:
- All 4 services render with correct icons and colors
- Gmail/Calendar/Slack "Connect" buttons redirect to OAuth (will fail without creds, that's OK)
- Mixmax "Connect" opens the API key modal
- Connected state shows email + disconnect button (test with mock data if needed)

- [ ] **Step 5: Commit**

```bash
git add src/features/integrations/components/ src/features/shared/components/views/ProfileView.tsx
git commit -m "feat(integrations): add Connected Accounts section to profile page"
```

---

### Task 9: CalendarConnection → UserIntegration migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/XXXXXX_migrate_calendar_connection/migration.sql` (auto or manual)
- Modify: `src/features/calendar/lib/google.ts` — update token helpers to use UserIntegration
- Modify: `src/features/calendar/lib/sync.ts` — update queries from CalendarConnection to UserIntegration
- Modify: `src/features/calendar/lib/queries.ts` — update connection status queries
- Modify: `src/app/api/calendar/connect/route.ts` — write to UserIntegration
- Modify: `src/app/api/calendar/callback/route.ts` — write to UserIntegration
- Modify: `src/app/api/calendar/disconnect/route.ts` — delete from UserIntegration
- Modify: `src/app/api/calendar/status/route.ts` — read from UserIntegration
- Modify: `src/app/api/calendar/sync/route.ts` — read from UserIntegration
- Modify: `src/app/api/calendar/events/route.ts` — update CalendarEvent FK
- Modify: `src/app/api/calendar/events/[id]/route.ts` — update queries
- Modify: `src/app/api/calendar/events/batch-confirm/route.ts` — update queries

- [ ] **Step 1: Run token encryption migration script**

`CalendarConnection` stores tokens unencrypted. `UserIntegration` expects encrypted tokens. Run a Node.js script to migrate data:

```typescript
// scripts/migrate-calendar-tokens.ts
import prisma from "../src/lib/prisma";
import { encrypt } from "../src/features/integrations/lib/encryption";

async function main() {
  const connections = await prisma.calendarConnection.findMany();
  for (const conn of connections) {
    await prisma.userIntegration.upsert({
      where: { userId_service: { userId: conn.userId, service: "google_calendar" } },
      update: {},
      create: {
        userId: conn.userId,
        service: "google_calendar",
        accountEmail: conn.googleAccountEmail,
        accessToken: encrypt(conn.accessToken),
        refreshToken: encrypt(conn.refreshToken),
        tokenExpiresAt: conn.tokenExpiresAt,
        metadata: { companyDomain: conn.companyDomain },
        syncEnabled: conn.syncEnabled,
        status: conn.status,
        lastSyncAt: conn.lastSyncAt,
      },
    });
  }
  console.log(`Migrated ${connections.length} calendar connections`);
}
main();
```

Run: `npx tsx scripts/migrate-calendar-tokens.ts`

- [ ] **Step 2: Write Prisma migration SQL**

`CalendarEvent` already has a `userId` column. The migration must:
1. Drop FK from `calendar_events.connection_id` → `calendar_connections.id`
2. Drop `@@unique([connectionId, googleEventId])` constraint
3. Add `@@unique([userId, googleEventId])` constraint on `calendar_events`
4. Drop `connection_id` column from `calendar_events`
5. Drop `calendar_connections` table

- [ ] **Step 3: Update calendar sync lib (`src/features/calendar/lib/sync.ts`)**

Replace `prisma.calendarConnection.findUnique({ where: { userId } })` with:
```typescript
const integration = await prisma.userIntegration.findUnique({
  where: { userId_service: { userId, service: "google_calendar" } },
});
// Access companyDomain from metadata:
const companyDomain = (integration?.metadata as any)?.companyDomain || "";
// Decrypt tokens before use:
const accessToken = decrypt(integration.accessToken);
const refreshToken = integration.refreshToken ? decrypt(integration.refreshToken) : null;
```

- [ ] **Step 4: Update calendar API routes**

For each file, replace `prisma.calendarConnection` with `prisma.userIntegration` queries filtered by `service: "google_calendar"`:
- `src/app/api/calendar/connect/route.ts` — write to UserIntegration instead of CalendarConnection
- `src/app/api/calendar/callback/route.ts` — upsert UserIntegration, encrypt tokens with `encrypt()`
- `src/app/api/calendar/disconnect/route.ts` — delete from UserIntegration
- `src/app/api/calendar/status/route.ts` — read from UserIntegration, decrypt for display
- `src/app/api/calendar/sync/route.ts` — read from UserIntegration
- `src/app/api/calendar/events/route.ts` — replace `connectionId` queries with `userId` queries
- `src/app/api/calendar/events/[id]/route.ts` — same
- `src/app/api/calendar/events/batch-confirm/route.ts` — same

- [ ] **Step 5: Update CalendarEvent model in schema**

Remove `connectionId` field and `CalendarConnection` relation. Update unique constraint to `@@unique([userId, googleEventId])`.

- [ ] **Step 6: Remove CalendarConnection model from schema**

- [ ] **Step 4: Run existing calendar tests**

Run: `npx vitest run --reporter=verbose 2>&1 | head -50`
Expected: All existing tests pass (calendar tests may need mock updates for the new model shape).

- [ ] **Step 5: Run full migration**

Run: `npx prisma migrate dev --name migrate_calendar_to_user_integration`

- [ ] **Step 6: Verify calendar still works end-to-end**

Manual test: connect calendar, trigger sync, verify events appear in inbox.

- [ ] **Step 7: Commit**

```bash
git add prisma/ src/features/calendar/ src/app/api/calendar/
git commit -m "refactor(calendar): migrate CalendarConnection to UserIntegration model"
```

---

## Chunk 2: Activity Timeline + Gmail Sync + Mixmax Enrichment

> **Implementer note:** The Gmail and Mixmax sync engines should closely follow the patterns in the existing calendar sync code at `src/features/calendar/lib/sync.ts` (smart matching, contact email lookup, Activity creation with junction tables). Read that file before implementing Tasks 12-13. The Gmail API client uses `googleapis` (already a dependency) — see `src/features/calendar/lib/google.ts` for the OAuth client pattern. Store `historyId` for incremental Gmail sync in `UserIntegration.metadata.historyId`.

### Task 10: Add source filter to activities API and widen Activity types

**Files:**
- Modify: `src/features/shared/types/api-types.ts`
- Modify: `src/features/activities/lib/queries.ts`
- Modify: `src/app/api/activities/route.ts`

- [ ] **Step 1: Widen Activity.source union type**

In `src/features/shared/types/api-types.ts`, find the `Activity` type (around line 457) and the `ActivityListItem` type (around line 476). Change the `source` field from:
```typescript
source: "manual" | "calendar_sync";
```
to:
```typescript
source: "manual" | "calendar_sync" | "gmail_sync" | "slack_sync";
```

- [ ] **Step 2: Add source to ActivitiesParams**

In `src/features/shared/types/api-types.ts`, add to `ActivitiesParams` (around line 490):
```typescript
source?: string;
```

In `src/features/activities/lib/queries.ts`, in `useActivities()`, add:
```typescript
if (params.source) searchParams.set("source", params.source);
```

- [ ] **Step 3: Add source filtering to GET /api/activities**

In `src/app/api/activities/route.ts`, add after other filter params:
```typescript
const source = searchParams.get("source");
// In the Prisma where clause:
...(source && { source }),
```

- [ ] **Step 4: Commit**

```bash
git add src/features/shared/types/api-types.ts src/features/activities/lib/queries.ts src/app/api/activities/route.ts
git commit -m "feat(activities): add source filter to activities API"
```

---

### Task 11: Build unified activity timeline component

**Files:**
- Create: `src/features/activities/components/ActivityTimeline.tsx`
- Create: `src/features/activities/components/ActivityTimelineItem.tsx`
- Create: `src/features/activities/components/ActivityFilterChips.tsx`

- [ ] **Step 1: Create ActivityFilterChips component**

Filter chips: All / Email / Calendar / Slack / Manual. Each chip toggles a `source` filter. Uses the Fullmind pill style (Plum bg for active, outlined for inactive).

- [ ] **Step 2: Create ActivityTimelineItem component**

Renders a single activity in the timeline. Props: `activity: Activity`. Key logic:
- Left border icon: color-coded by source (Gmail red, Calendar blue, Slack purple, Manual gray)
- Title line: activity type + title
- Detail line: contacts, time
- Mixmax badge: if `mixmaxSequenceName` exists, show "Step X/Y · Sequence Name" in coral badge
- Mixmax tracking: if `mixmaxOpenCount`/`mixmaxClickCount` exist, show below

- [ ] **Step 3: Create ActivityTimeline component**

Props: `districtLeaid: string`. Uses `useActivities({ districtLeaid })` filtered by source. Groups activities by date (Today, Yesterday, date). Renders `ActivityTimelineItem` for each. Includes `ActivityFilterChips` at top.

- [ ] **Step 4: Integrate into district detail view**

Add `<ActivityTimeline districtLeaid={leaid} />` as a new "Activity" tab in `src/features/map/components/panels/district/DistrictDetailPanel.tsx`. The district panel uses `DistrictTabStrip.tsx` for tab navigation (existing tabs: planning, signals, schools, contacts). Add "Activity" as a new tab that renders the timeline component.

- [ ] **Step 5: Commit**

```bash
git add src/features/activities/components/
git commit -m "feat(activities): add unified activity timeline with filter chips"
```

---

### Task 12: Build Gmail sync engine

**Files:**
- Create: `src/features/integrations/lib/gmail-sync.ts`
- Create: `src/features/integrations/lib/__tests__/gmail-sync.test.ts`
- Create: `src/app/api/integrations/gmail/sync/route.ts`

- [ ] **Step 1: Write failing tests for email-to-contact matching**

```typescript
// src/features/integrations/lib/__tests__/gmail-sync.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    contact: { findMany: vi.fn() },
    activity: { upsert: vi.fn() },
    activityDistrict: { create: vi.fn() },
    activityContact: { create: vi.fn() },
  },
}));

import { matchEmailToContacts } from "../gmail-sync";
import prisma from "@/lib/prisma";
const mockPrisma = vi.mocked(prisma);

describe("matchEmailToContacts", () => {
  it("matches email address to contacts and returns district leaids", async () => {
    mockPrisma.contact.findMany.mockResolvedValue([
      { id: 1, email: "jane@springfield.edu", leaid: "1234567", name: "Jane Smith" },
    ] as any);

    const result = await matchEmailToContacts(["jane@springfield.edu", "unknown@test.com"]);
    expect(result).toHaveLength(1);
    expect(result[0].districtLeaid).toBe("1234567");
  });

  it("returns empty for no matches", async () => {
    mockPrisma.contact.findMany.mockResolvedValue([]);
    const result = await matchEmailToContacts(["nobody@test.com"]);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/integrations/lib/__tests__/gmail-sync.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Gmail sync engine**

```typescript
// src/features/integrations/lib/gmail-sync.ts
// Key functions:
// - matchEmailToContacts(emails: string[]) → ContactMatch[]
// - syncGmailMessages(userId: string) → SyncResult
//   1. Get UserIntegration for gmail
//   2. Decrypt + refresh token if needed
//   3. Fetch messages via Gmail API (last 90 days on first sync, incremental after)
//   4. For each message: extract sender/recipients, match to contacts
//   5. Upsert Activity with gmailMessageId for dedup
//   6. Create ActivityDistrict + ActivityContact junction rows
//   7. Update lastSyncAt
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/integrations/lib/__tests__/gmail-sync.test.ts`
Expected: PASS

- [ ] **Step 5: Create sync API endpoint**

```typescript
// src/app/api/integrations/gmail/sync/route.ts
// POST /api/integrations/gmail/sync — triggers Gmail sync for authenticated user
// Calls syncGmailMessages(userId) and returns SyncResult
```

- [ ] **Step 6: Commit**

```bash
git add src/features/integrations/lib/gmail-sync.ts src/features/integrations/lib/__tests__/gmail-sync.test.ts src/app/api/integrations/gmail/sync/
git commit -m "feat(integrations): add Gmail sync engine with contact matching"
```

---

### Task 13: Build Mixmax enrichment engine

**Files:**
- Create: `src/features/integrations/lib/mixmax-enrichment.ts`
- Create: `src/features/integrations/lib/__tests__/mixmax-enrichment.test.ts`

- [ ] **Step 1: Write failing tests**

Test that given a set of gmail message IDs, the enrichment function:
- Calls Mixmax API to check for sequence data
- Updates matching Activity rows with sequence name, step, status, open/click counts
- Handles no-match gracefully (activity stays unchanged)

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement enrichment engine**

```typescript
// src/features/integrations/lib/mixmax-enrichment.ts
// - enrichActivitiesWithMixmax(userId: string, gmailMessageIds: string[])
//   1. Get UserIntegration for mixmax, decrypt API key
//   2. Query Mixmax API for sequence data matching those message IDs
//   3. For each match: update Activity with mixmax* fields
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Wire enrichment into Gmail sync**

At the end of `syncGmailMessages()`, if user has a Mixmax integration, call `enrichActivitiesWithMixmax()` with the synced message IDs.

- [ ] **Step 6: Commit**

```bash
git add src/features/integrations/lib/mixmax-enrichment.ts src/features/integrations/lib/__tests__/mixmax-enrichment.test.ts src/features/integrations/lib/gmail-sync.ts
git commit -m "feat(integrations): add Mixmax enrichment engine for Gmail activities"
```

---

## Chunk 3: Slack Sync + Outreach Actions + Unlinked Triage

> **Implementer note:** Slack sync follows the same Activity creation pattern as Gmail (Task 12). For outreach actions, each send endpoint creates an Activity on success so it appears in the timeline. The unlinked triage view should render as a slide-out drawer from the notification badge. Both `ContactCard.tsx` (plan view) and `ContactDetail.tsx` (map panel) need outreach buttons.

### Task 14: Build Slack sync engine

**Files:**
- Create: `src/features/integrations/lib/slack-sync.ts`
- Create: `src/features/integrations/lib/__tests__/slack-sync.test.ts`
- Create: `src/app/api/integrations/slack/sync/route.ts`

- [ ] **Step 1: Write failing tests for Slack message → Activity creation + dedup**

- [ ] **Step 2: Implement Slack sync engine**

```typescript
// src/features/integrations/lib/slack-sync.ts
// - syncSlackMessages(userId: string) → SyncResult
//   1. Get UserIntegration for slack, decrypt token
//   2. List joined channels
//   3. For each channel: fetch recent messages via conversations.history
//   4. Match to districts: channel name/topic matching, mentioned user emails → Contact
//   5. Upsert Activity with slackChannelId + slackMessageTs for dedup
//   6. Store channelName, threadTs, permalink in integrationMeta
//   7. Create junction rows where matched
```

- [ ] **Step 3: Run tests to verify they pass**

- [ ] **Step 4: Create sync endpoint**

- [ ] **Step 5: Commit**

```bash
git add src/features/integrations/lib/slack-sync.ts src/features/integrations/lib/__tests__/slack-sync.test.ts src/app/api/integrations/slack/sync/
git commit -m "feat(integrations): add Slack sync engine"
```

---

### Task 15: Build outreach actions on contact cards

**Files:**
- Create: `src/features/integrations/components/ComposeEmailPanel.tsx`
- Create: `src/features/integrations/components/ComposeSlackPanel.tsx`
- Create: `src/features/integrations/components/MixmaxCampaignModal.tsx`
- Create: `src/app/api/integrations/gmail/send/route.ts`
- Create: `src/app/api/integrations/slack/send/route.ts`
- Create: `src/app/api/integrations/mixmax/campaigns/route.ts`
- Modify: `src/features/plans/components/ContactCard.tsx` — add outreach buttons in plan view
- Modify: `src/features/map/components/right-panels/ContactDetail.tsx` — add outreach buttons in map panel

- [ ] **Step 1: Create Gmail send endpoint**

```typescript
// POST /api/integrations/gmail/send
// Body: { to: string, subject: string, body: string, districtLeaid?: string, contactId?: number }
// Sends via Gmail API, creates Activity with source: "gmail_sync", links to district/contact
```

- [ ] **Step 2: Create Slack send endpoint**

```typescript
// POST /api/integrations/slack/send
// Body: { channelId: string, message: string, districtLeaid?: string }
// Sends via Slack API, creates Activity with source: "slack_sync"
```

- [ ] **Step 3: Create Mixmax campaigns endpoint**

```typescript
// GET /api/integrations/mixmax/campaigns — list active sequences
// POST /api/integrations/mixmax/campaigns — add contact to sequence
// Body: { sequenceId: string, contactEmail: string }
```

- [ ] **Step 4: Build ComposeEmailPanel component**

Slide-out panel with To (pre-filled), Subject, Body fields. Send button calls Gmail send endpoint. Shows success/error toast.

- [ ] **Step 5: Build ComposeSlackPanel component**

Slide-out panel with channel picker and message field. Requires Slack connected.

- [ ] **Step 6: Build MixmaxCampaignModal component**

Modal listing active Mixmax sequences. "Add to sequence" button for each. Requires Mixmax connected.

- [ ] **Step 7: Add action buttons to contact cards**

Add Email / Slack / Mixmax buttons to contact card. Each opens the corresponding compose panel/modal. Buttons disabled with tooltip if service not connected.

- [ ] **Step 8: Commit**

```bash
git add src/features/integrations/components/ src/app/api/integrations/gmail/send/ src/app/api/integrations/slack/send/ src/app/api/integrations/mixmax/campaigns/
git commit -m "feat(integrations): add outreach actions on contact cards"
```

---

### Task 16: Build unlinked activity triage

**Files:**
- Create: `src/app/api/activities/unlinked/route.ts`
- Create: `src/features/activities/components/UnlinkedActivityBadge.tsx`
- Create: `src/features/activities/components/UnlinkedActivityTriage.tsx`

- [ ] **Step 1: Create unlinked activities endpoint**

```typescript
// GET /api/activities/unlinked — returns activities with no ActivityDistrict links
// where source != "manual" (synced from integrations but unmatched)
```

- [ ] **Step 2: Create UnlinkedActivityBadge component**

Shows count of unlinked activities. Uses query hook. Renders as a notification badge (red dot with count) on the sidebar or activity section.

- [ ] **Step 3: Create UnlinkedActivityTriage component**

List of unlinked activities with a district picker dropdown per item. Selecting a district calls `useLinkActivityDistricts()` to create the junction row. Activity disappears from list once linked.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/activities/unlinked/ src/features/activities/components/UnlinkedActivity*
git commit -m "feat(activities): add unlinked activity triage with notification badge"
```

---

### Task 17: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: address test and build issues from integrations feature"
```
