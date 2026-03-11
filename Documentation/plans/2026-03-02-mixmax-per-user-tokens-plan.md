# MixMax Per-User Token Model — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Switch MixMax from one org-wide admin token to per-user tokens so each rep sees their own sequence recipients.

**Architecture:** Reuse the existing `MixmaxConnection` table with a unique constraint on `createdById`. Replace the admin-only route with a user-scoped route at `/api/user/integrations/mixmax`. Modify `getMixmaxClient` to take a `userId` parameter. Move the connect/disconnect UI from Admin > Integrations into the user's Profile > Settings modal.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma, TanStack Query, Tailwind CSS 4

---

### Task 1: Schema migration — add unique constraint on `createdById`

**Files:**
- Modify: `prisma/schema.prisma:897-909`
- Create: migration SQL via `npx prisma migrate dev`

**Step 1: Update the Prisma schema**

In `prisma/schema.prisma`, find the `MixmaxConnection` model (line ~897) and add `@@unique([createdById])` before `@@map`:

```prisma
model MixmaxConnection {
  id             String    @id @default(uuid())
  apiToken       String    @map("api_token") @db.VarChar(500)
  createdById    String    @map("created_by_id") @db.Uuid
  status         String    @default("connected") @db.VarChar(20)
  lastVerifiedAt DateTime? @map("last_verified_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  createdBy UserProfile @relation("MixmaxConnectionCreator", fields: [createdById], references: [id])

  @@unique([createdById])
  @@map("mixmax_connections")
}
```

**Step 2: Delete existing org-wide rows**

Before migrating, clear any existing connections that aren't per-user:

```bash
npx prisma db execute --stdin <<< "DELETE FROM mixmax_connections;"
```

**Step 3: Generate and apply migration**

```bash
npx prisma migrate dev --name per-user-mixmax-tokens
```

Expected: Migration created and applied. `@@unique([createdById])` adds a unique index.

**Step 4: Verify**

```bash
npx prisma db execute --stdin <<< "SELECT indexname FROM pg_indexes WHERE tablename = 'mixmax_connections';"
```

Expected: Shows a unique index on `created_by_id`.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add unique constraint on createdById for per-user MixMax tokens"
```

---

### Task 2: Create `/api/user/integrations/mixmax` route

**Files:**
- Create: `src/app/api/user/integrations/mixmax/route.ts`

**Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { MixmaxClient } from "@/features/mixmax/lib/mixmax-client";

export const dynamic = "force-dynamic";

// GET - Check current user's MixMax connection status
export async function GET(_request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.mixmaxConnection.findUnique({
    where: { createdById: user.id },
    select: {
      id: true,
      status: true,
      lastVerifiedAt: true,
      createdAt: true,
    },
  });

  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: connection.status === "connected",
    status: connection.status,
    lastVerifiedAt: connection.lastVerifiedAt?.toISOString() ?? null,
    createdAt: connection.createdAt.toISOString(),
  });
}

// POST - Connect MixMax with user's personal API token
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { apiToken } = body;

  if (!apiToken || typeof apiToken !== "string") {
    return NextResponse.json({ error: "apiToken is required" }, { status: 400 });
  }

  // Verify the token works
  const client = new MixmaxClient(apiToken);
  const isValid = await client.verifyToken();

  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid MixMax API token — verification failed" },
      { status: 422 }
    );
  }

  // Upsert: use the unique createdById constraint
  const connection = await prisma.mixmaxConnection.upsert({
    where: { createdById: user.id },
    create: {
      apiToken,
      createdById: user.id,
      status: "connected",
      lastVerifiedAt: new Date(),
    },
    update: {
      apiToken,
      status: "connected",
      lastVerifiedAt: new Date(),
    },
  });

  return NextResponse.json(
    {
      connected: true,
      status: connection.status,
      lastVerifiedAt: connection.lastVerifiedAt?.toISOString(),
    },
    { status: 201 }
  );
}

// DELETE - Disconnect current user's MixMax
export async function DELETE(_request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.mixmaxConnection.findUnique({
    where: { createdById: user.id },
  });

  if (!connection) {
    return NextResponse.json({ error: "No MixMax connection found" }, { status: 404 });
  }

  await prisma.mixmaxConnection.delete({ where: { id: connection.id } });

  return NextResponse.json({ disconnected: true });
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i mixmax | head -10
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/user/integrations/mixmax/route.ts
git commit -m "feat: add per-user MixMax connection API route"
```

---

### Task 3: Modify `getMixmaxClient` to accept `userId`

**Files:**
- Modify: `src/features/mixmax/lib/get-mixmax-client.ts`

**Step 1: Update the function**

Replace the entire file with:

```typescript
import prisma from "@/lib/prisma";
import { MixmaxClient } from "./mixmax-client";

const clientCache = new Map<string, { client: MixmaxClient; tokenHash: string }>();

/**
 * Get an authenticated MixMax client for a specific user.
 * Returns null if the user has no active connection.
 * Caches the client instance per userId to preserve in-memory recipient cache.
 */
export async function getMixmaxClient(userId: string): Promise<MixmaxClient | null> {
  const connection = await prisma.mixmaxConnection.findUnique({
    where: { createdById: userId, status: "connected" },
    select: { apiToken: true },
  });

  if (!connection) return null;

  // Reuse cached client if token hasn't changed
  const cached = clientCache.get(userId);
  if (cached && cached.tokenHash === connection.apiToken) {
    return cached.client;
  }

  const client = new MixmaxClient(connection.apiToken);
  clientCache.set(userId, { client, tokenHash: connection.apiToken });
  return client;
}
```

Key changes:
- Takes `userId: string` parameter instead of finding any connection
- Uses `findUnique` with the new `createdById` unique constraint
- Adds `status: "connected"` to the where clause
- Cache is keyed by `userId` instead of a single global variable

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "get-mixmax-client\|getMixmaxClient" | head -10
```

Expected: Errors in `sequences/route.ts` and `sequences/[id]/stats/route.ts` because they still call `getMixmaxClient()` without arguments. That's expected — we fix them next.

**Step 3: Commit**

```bash
git add src/features/mixmax/lib/get-mixmax-client.ts
git commit -m "feat: getMixmaxClient takes userId for per-user token lookup"
```

---

### Task 4: Update sequences and stats routes to pass `user.id`

**Files:**
- Modify: `src/app/api/mixmax/sequences/route.ts`
- Modify: `src/app/api/mixmax/sequences/[id]/stats/route.ts`

**Step 1: Update sequences route**

In `src/app/api/mixmax/sequences/route.ts`, change line 14:

```typescript
// Before
const client = await getMixmaxClient();

// After
const client = await getMixmaxClient(user.id);
```

Also update the 503 error message (line 16-19):

```typescript
// Before
{ error: "MixMax is not connected. Ask your admin to configure it." }

// After
{ error: "MixMax is not connected. Connect your account in Profile > Settings." }
```

**Step 2: Update stats route**

In `src/app/api/mixmax/sequences/[id]/stats/route.ts`, change line 21:

```typescript
// Before
const client = await getMixmaxClient();

// After
const client = await getMixmaxClient(user.id);
```

Also update the 503 error message (line 23):

```typescript
// Before
{ error: "MixMax is not connected" }

// After
{ error: "MixMax is not connected. Connect your account in Profile > Settings." }
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i mixmax | head -10
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/app/api/mixmax/sequences/route.ts src/app/api/mixmax/sequences/\[id\]/stats/route.ts
git commit -m "feat: pass user.id to getMixmaxClient in sequences and stats routes"
```

---

### Task 5: Update React Query hooks to use new user route

**Files:**
- Modify: `src/features/mixmax/lib/queries.ts`

**Step 1: Update `useMixmaxConnectionStatus`**

Change the `queryFn` URL from `/admin/integrations/mixmax` to `/user/integrations/mixmax`:

```typescript
export function useMixmaxConnectionStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["mixmax", "connection"],
    queryFn: () =>
      fetchJson<MixmaxConnectionStatus>(
        `${API_BASE}/user/integrations/mixmax`
      ),
    staleTime: 2 * 60 * 1000,
    enabled: options?.enabled,
  });
}
```

**Step 2: Update `useConnectMixmax`**

Change the mutation URL:

```typescript
export function useConnectMixmax() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (apiToken: string) =>
      fetchJson<MixmaxConnectionStatus>(
        `${API_BASE}/user/integrations/mixmax`,
        {
          method: "POST",
          body: JSON.stringify({ apiToken }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mixmax", "connection"] });
      queryClient.invalidateQueries({ queryKey: ["mixmax", "sequences"] });
    },
  });
}
```

**Step 3: Update `useDisconnectMixmax`**

Change the mutation URL:

```typescript
export function useDisconnectMixmax() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/user/integrations/mixmax`,
        {
          method: "DELETE",
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mixmax"] });
    },
  });
}
```

**Step 4: Remove `createdByName` from `MixmaxConnectionStatus` type**

The user route doesn't return `createdByName` (it's the user's own connection). Update the type:

```typescript
export interface MixmaxConnectionStatus {
  connected: boolean;
  status?: string;
  lastVerifiedAt?: string;
  createdAt?: string;
}
```

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "queries\|MixmaxAdmin" | head -10
```

Expected: May show errors in `MixmaxAdminSettings.tsx` if it references `createdByName` — that's fine, we remove that component in Task 8.

**Step 6: Commit**

```bash
git add src/features/mixmax/lib/queries.ts
git commit -m "feat: point MixMax hooks at per-user API route"
```

---

### Task 6: Create `MixmaxUserSettings` component

**Files:**
- Create: `src/features/mixmax/components/MixmaxUserSettings.tsx`

**Step 1: Create the component**

This is based on the existing `MixmaxAdminSettings` but adapted for the user's Profile > Settings context (no admin language, no "Connected by" field):

```tsx
"use client";

import { useState } from "react";
import {
  useMixmaxConnectionStatus,
  useConnectMixmax,
  useDisconnectMixmax,
} from "@/features/mixmax/lib/queries";

export default function MixmaxUserSettings() {
  const { data: status, isLoading } = useMixmaxConnectionStatus();
  const connectMutation = useConnectMixmax();
  const disconnectMutation = useDisconnectMixmax();
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const handleConnect = async () => {
    if (!apiToken.trim()) return;
    try {
      await connectMutation.mutateAsync(apiToken.trim());
      setApiToken("");
      setShowToken(false);
    } catch {
      // Error is available via connectMutation.error
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect MixMax? Your campaign stats will no longer be available.")) return;
    await disconnectMutation.mutateAsync();
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-[#C4E7E6]/20 rounded w-1/3" />
        <div className="h-10 bg-[#C4E7E6]/20 rounded" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#403770]">MixMax</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Connect your MixMax API token to see your sequence engagement data.
          </p>
        </div>
        {status?.connected && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#EDFFE3] text-[#5f665b]">
            Connected
          </span>
        )}
      </div>

      {status?.connected ? (
        <div className="space-y-3">
          {status.lastVerifiedAt && (
            <p className="text-xs text-gray-500">
              Last verified: {new Date(status.lastVerifiedAt).toLocaleString()}
            </p>
          )}
          <button
            onClick={handleDisconnect}
            disabled={disconnectMutation.isPending}
            className="px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              API Token
            </label>
            <div className="flex gap-2">
              <input
                type={showToken ? "text" : "password"}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Paste your MixMax API token"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="px-3 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Find your token at mixmax.com → Settings → API
            </p>
          </div>

          {connectMutation.isError && (
            <p className="text-sm text-red-600">
              {connectMutation.error instanceof Error
                ? connectMutation.error.message
                : "Failed to connect"}
            </p>
          )}

          <button
            onClick={handleConnect}
            disabled={!apiToken.trim() || connectMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connectMutation.isPending ? "Verifying..." : "Verify & Connect"}
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "MixmaxUserSettings" | head -10
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/features/mixmax/components/MixmaxUserSettings.tsx
git commit -m "feat: add MixmaxUserSettings component for Profile settings"
```

---

### Task 7: Add MixmaxUserSettings to Profile > Settings modal

**Files:**
- Modify: `src/features/shared/components/views/ProfileView.tsx`

**Step 1: Add import**

At the top of `ProfileView.tsx`, add:

```tsx
import MixmaxUserSettings from "@/features/mixmax/components/MixmaxUserSettings";
```

**Step 2: Replace the "Coming Soon" placeholder**

Find the `{/* Content */}` section inside the Settings modal (lines 188–213). Replace the placeholder with `MixmaxUserSettings`:

```tsx
{/* Content */}
<div className="px-6 py-6 space-y-6">
  <MixmaxUserSettings />
</div>
```

This replaces the "Coming Soon" icon, heading, and description paragraph.

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "ProfileView" | head -10
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/features/shared/components/views/ProfileView.tsx
git commit -m "feat: add MixMax connection to Profile settings modal"
```

---

### Task 8: Remove MixMax from admin Integrations

**Files:**
- Modify: `src/features/admin/components/IntegrationsTab.tsx`
- Delete: `src/features/mixmax/components/MixmaxAdminSettings.tsx`
- Delete: `src/app/api/admin/integrations/mixmax/route.ts`

**Step 1: Remove MixmaxAdminSettings from IntegrationsTab**

Replace `IntegrationsTab.tsx` with:

```tsx
"use client";

import { AdminSlackSettings } from "@/features/slack/components/AdminSlackSettings";

export default function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#403770]">Integrations</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage third-party service connections for your organization.
        </p>
      </div>
      <AdminSlackSettings />
    </div>
  );
}
```

**Step 2: Delete MixmaxAdminSettings component**

```bash
rm src/features/mixmax/components/MixmaxAdminSettings.tsx
```

**Step 3: Delete admin MixMax route**

```bash
rm src/app/api/admin/integrations/mixmax/route.ts
```

If the `admin/integrations/mixmax` directory is now empty:

```bash
rmdir src/app/api/admin/integrations/mixmax
```

If `admin/integrations` is now empty too:

```bash
rmdir src/app/api/admin/integrations 2>/dev/null || true
```

**Step 4: Check for any remaining references to the old admin route**

```bash
grep -r "admin/integrations/mixmax" src/ --include="*.ts" --include="*.tsx" | head -10
```

Expected: No results (the hooks were already updated in Task 5).

**Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove admin MixMax settings — now per-user in Profile"
```

---

### Task 9: Update CampaignStatsPanel error state for unconnected users

**Files:**
- Modify: `src/features/mixmax/components/CampaignStatsPanel.tsx`

**Step 1: Detect 503 "not connected" vs other errors**

The `CampaignStatsPanel` currently shows a generic "Stats temporarily unavailable" for all errors. When the stats route returns 503 (user hasn't connected MixMax), show a friendly prompt instead.

Find the error block (lines 99-111) and replace with:

```tsx
if (error) {
  // Check if this is a "not connected" 503 error
  const isNotConnected =
    error instanceof Error && error.message?.includes("not connected");

  if (isNotConnected) {
    return (
      <div className="p-4 bg-[#FFFCFA] border border-gray-200 rounded-lg text-center">
        <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <p className="text-sm font-medium text-[#403770]">Connect your MixMax account</p>
        <p className="text-xs text-gray-500 mt-1">
          Go to Profile → Settings to connect your MixMax API token and see campaign stats.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-sm text-red-700">Stats temporarily unavailable</p>
      <button
        onClick={() => refetch()}
        className="mt-2 text-xs text-red-600 underline hover:no-underline"
      >
        Retry
      </button>
    </div>
  );
}
```

This depends on how `fetchJson` propagates the error message. Check how `fetchJson` works — if it throws an Error with the response body's `error` field in the message, `error.message` will contain "MixMax is not connected". If it doesn't, we may need to check the status code instead.

**Step 2: Verify the error detection works**

Check how `fetchJson` handles errors:

```bash
grep -A 10 "function fetchJson\|throw.*Error\|res.ok\|response.ok" src/features/shared/lib/api-client.ts | head -20
```

If `fetchJson` throws an Error with the response body message, the `includes("not connected")` check will work. If not, adjust the detection to match however `fetchJson` surfaces non-ok responses.

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -i "CampaignStatsPanel" | head -10
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/features/mixmax/components/CampaignStatsPanel.tsx
git commit -m "feat: show connect prompt in stats panel when user has no MixMax token"
```

---

### Task 10: Verify end-to-end

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: Clean — no errors.

**Step 2: Run tests**

```bash
npm test 2>&1 | tail -20
```

Expected: All tests pass.

**Step 3: Manual smoke test checklist**

1. Go to Profile > Settings → MixMax section should show "Verify & Connect" form
2. Enter a valid MixMax API token → should show "Connected" badge
3. Go to Activities → edit a MixMax-linked activity → stats panel should load with your recipients
4. Go to Admin > Integrations → MixMax section should be gone, only Slack remains
5. Disconnect MixMax from Profile > Settings → stats panel should show "Connect your MixMax account" prompt
6. Another user without a token → stats panel shows connect prompt, not an error

**Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: address any issues found during smoke test"
```
