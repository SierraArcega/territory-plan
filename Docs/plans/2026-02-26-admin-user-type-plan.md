# Admin User Type Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a three-tier role system (Admin, Manager, Rep) with team goals, user management, and bulk territory assignment.

**Architecture:** Role enum + managerId FK + isActive flag on UserProfile, new TeamGoal model, `withRole()` API middleware, dedicated `/admin` route with Users/Team Goals/Territory Assignment tabs.

**Tech Stack:** Next.js 16, React 19, Prisma 5, Supabase Auth, Zustand, TanStack React Query, Tailwind CSS 4, Vitest

---

### Task 1: Add Role Enum and UserProfile Fields to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma:634-662` (UserProfile model)

**Step 1: Add the UserRole enum after the existing ServiceCategory enum (line ~664)**

Add this above the `Service` model:

```prisma
enum UserRole {
  admin
  manager
  rep

  @@map("user_role")
}
```

**Step 2: Add role, managerId, isActive fields to UserProfile model**

Add these fields to the UserProfile model (after `lastLoginAt`):

```prisma
  role            UserRole  @default(rep)
  managerId       String?   @map("manager_id") @db.Uuid
  isActive        Boolean   @default(true) @map("is_active")

  // Self-referential manager hierarchy
  manager         UserProfile?  @relation("ManagerReports", fields: [managerId], references: [id])
  directReports   UserProfile[] @relation("ManagerReports")
```

Also add to the existing relations section (after `savedMapViews`):

```prisma
  createdTeamGoals TeamGoal[] @relation("TeamGoalCreator")
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add UserRole enum and role/managerId/isActive to UserProfile"
```

---

### Task 2: Add TeamGoal Model to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma` (add after UserProfile model)

**Step 1: Add the TeamGoal model**

```prisma
// ===== Team Goals =====
// Organization-wide targets set by admins, one per fiscal year
model TeamGoal {
  id                 String   @id @default(uuid()) @db.Uuid
  fiscalYear         Int      @unique @map("fiscal_year")
  earningsTarget     Decimal? @map("earnings_target") @db.Decimal(15, 2)
  renewalTarget      Decimal? @map("renewal_target") @db.Decimal(15, 2)
  winbackTarget      Decimal? @map("winback_target") @db.Decimal(15, 2)
  expansionTarget    Decimal? @map("expansion_target") @db.Decimal(15, 2)
  newBusinessTarget  Decimal? @map("new_business_target") @db.Decimal(15, 2)
  takeTarget         Decimal? @map("take_target") @db.Decimal(15, 2)
  newDistrictsTarget Int?     @map("new_districts_target")
  createdById        String   @map("created_by_id") @db.Uuid
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  createdBy UserProfile @relation("TeamGoalCreator", fields: [createdById], references: [id])

  @@map("team_goals")
}
```

**Step 2: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add TeamGoal model for team-wide fiscal year targets"
```

---

### Task 3: Create and Apply Database Migration

**Files:**
- Create: `prisma/migrations/20260226_admin_roles_team_goals/migration.sql` (auto-generated)

**Step 1: Generate the migration**

```bash
npx prisma migrate dev --name admin_roles_team_goals
```

This creates the migration SQL and applies it. Expected output: migration applied, Prisma Client regenerated.

**Step 2: Verify the migration applied**

```bash
npx prisma migrate status
```

Expected: All migrations applied, no pending.

**Step 3: Commit the migration**

```bash
git add prisma/migrations/
git commit -m "migrate: add admin roles, manager hierarchy, team goals"
```

---

### Task 4: Create `withRole` Authorization Helper

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/__tests__/auth.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/__tests__/auth.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}));

import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { getUserWithRole, requireRole } from "@/lib/auth";

const mockGetUser = vi.mocked(getUser);
const mockPrisma = vi.mocked(prisma);

describe("getUserWithRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null as never);
    const result = await getUserWithRole();
    expect(result).toBeNull();
  });

  it("returns null when profile not found", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" } as never);
    mockPrisma.userProfile.findUnique.mockResolvedValue(null);
    const result = await getUserWithRole();
    expect(result).toBeNull();
  });

  it("returns null when user is deactivated", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" } as never);
    mockPrisma.userProfile.findUnique.mockResolvedValue({
      id: "user-1",
      role: "rep",
      isActive: false,
      managerId: null,
    } as never);
    const result = await getUserWithRole();
    expect(result).toBeNull();
  });

  it("returns user with role when active", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" } as never);
    mockPrisma.userProfile.findUnique.mockResolvedValue({
      id: "user-1",
      role: "admin",
      isActive: true,
      managerId: null,
    } as never);
    const result = await getUserWithRole();
    expect(result).toEqual({
      id: "user-1",
      role: "admin",
      isActive: true,
      managerId: null,
    });
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null as never);
    const result = await requireRole(["admin"]);
    expect(result.error).toBe("Authentication required");
    expect(result.status).toBe(401);
  });

  it("returns 403 when role not allowed", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" } as never);
    mockPrisma.userProfile.findUnique.mockResolvedValue({
      id: "user-1",
      role: "rep",
      isActive: true,
      managerId: null,
    } as never);
    const result = await requireRole(["admin"]);
    expect(result.error).toBe("Insufficient permissions");
    expect(result.status).toBe(403);
  });

  it("returns user when role matches", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" } as never);
    mockPrisma.userProfile.findUnique.mockResolvedValue({
      id: "user-1",
      role: "admin",
      isActive: true,
      managerId: null,
    } as never);
    const result = await requireRole(["admin"]);
    expect(result.user).toEqual({
      id: "user-1",
      role: "admin",
      isActive: true,
      managerId: null,
    });
    expect(result.error).toBeUndefined();
  });

  it("allows any of multiple roles", async () => {
    mockGetUser.mockResolvedValue({ id: "user-1" } as never);
    mockPrisma.userProfile.findUnique.mockResolvedValue({
      id: "user-1",
      role: "manager",
      isActive: true,
      managerId: null,
    } as never);
    const result = await requireRole(["admin", "manager"]);
    expect(result.user).toBeDefined();
    expect(result.error).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/auth.test.ts
```

Expected: FAIL — module `@/lib/auth` not found.

**Step 3: Implement the auth helper**

```typescript
// src/lib/auth.ts
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import type { UserRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  role: UserRole;
  isActive: boolean;
  managerId: string | null;
};

/**
 * Get the current authenticated user with their role from the database.
 * Returns null if not authenticated, profile not found, or user is deactivated.
 */
export async function getUserWithRole(): Promise<AuthUser | null> {
  const user = await getUser();
  if (!user) return null;

  const profile = await prisma.userProfile.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, isActive: true, managerId: true },
  });

  if (!profile || !profile.isActive) return null;

  return profile;
}

type RequireRoleResult =
  | { user: AuthUser; error?: undefined; status?: undefined }
  | { user?: undefined; error: string; status: number };

/**
 * Require the current user to have one of the specified roles.
 * Returns { user } on success, { error, status } on failure.
 */
export async function requireRole(
  roles: UserRole[],
): Promise<RequireRoleResult> {
  const user = await getUserWithRole();

  if (!user) {
    return { error: "Authentication required", status: 401 };
  }

  if (!roles.includes(user.role)) {
    return { error: "Insufficient permissions", status: 403 };
  }

  return { user };
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/__tests__/auth.test.ts
```

Expected: All 7 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "feat: add withRole authorization helper for role-based access control"
```

---

### Task 5: Admin Users API — GET (List All Users with Roles)

**Files:**
- Modify: `src/app/api/admin/users/route.ts`
- Test: `src/app/api/admin/users/__tests__/route.test.ts`

**Step 1: Write the failing test**

```typescript
// src/app/api/admin/users/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    userProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { GET, POST } from "../route";
import { requireRole } from "@/lib/auth";
import prisma from "@/lib/prisma";

const mockRequireRole = vi.mocked(requireRole);
const mockPrisma = vi.mocked(prisma);

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireRole.mockResolvedValue({
      error: "Authentication required",
      status: 401,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Authentication required");
  });

  it("returns 403 when not admin", async () => {
    mockRequireRole.mockResolvedValue({
      error: "Insufficient permissions",
      status: 403,
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Insufficient permissions");
  });

  it("returns all users with roles for admin", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin", isActive: true, managerId: null },
    });

    const mockUsers = [
      {
        id: "user-1",
        email: "rep@test.com",
        fullName: "Test Rep",
        avatarUrl: null,
        role: "rep",
        isActive: true,
        managerId: "mgr-1",
        lastLoginAt: new Date("2026-01-15"),
        manager: { id: "mgr-1", fullName: "Manager" },
        directReports: [],
      },
      {
        id: "mgr-1",
        email: "mgr@test.com",
        fullName: "Manager",
        avatarUrl: null,
        role: "manager",
        isActive: true,
        managerId: null,
        lastLoginAt: new Date("2026-01-20"),
        manager: null,
        directReports: [{ id: "user-1" }],
      },
    ];

    mockPrisma.userProfile.findMany.mockResolvedValue(mockUsers as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].role).toBe("rep");
    expect(data[0].manager).toEqual({ id: "mgr-1", fullName: "Manager" });
    expect(data[1].role).toBe("manager");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/admin/users/__tests__/route.test.ts
```

Expected: FAIL — GET is not exported from `../route` (currently only POST exists).

**Step 3: Rewrite the admin users route to add GET and use requireRole**

Replace the entire file `src/app/api/admin/users/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/admin/users - List all users with roles (admin only)
export async function GET() {
  try {
    const auth = await requireRole(["admin"]);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const users = await prisma.userProfile.findMany({
      orderBy: { fullName: "asc" },
      include: {
        manager: { select: { id: true, fullName: true } },
        directReports: { select: { id: true } },
      },
    });

    const result = users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      role: u.role,
      isActive: u.isActive,
      managerId: u.managerId,
      manager: u.manager
        ? { id: u.manager.id, fullName: u.manager.fullName }
        : null,
      directReportCount: u.directReports.length,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing users:", error);
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 },
    );
  }
}

// POST /api/admin/users - Create a stub user profile (admin only)
export async function POST(request: Request) {
  try {
    const auth = await requireRole(["admin"]);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { email, fullName, role } = body as {
      email?: string;
      fullName?: string;
      role?: string;
    };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.userProfile.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A user profile with this email already exists" },
        { status: 409 },
      );
    }

    const validRoles = ["admin", "manager", "rep"];
    const userRole = role && validRoles.includes(role) ? role : "rep";

    const profile = await prisma.userProfile.create({
      data: {
        id: randomUUID(),
        email: normalizedEmail,
        fullName: fullName?.trim() || null,
        role: userRole as "admin" | "manager" | "rep",
        hasCompletedSetup: false,
      },
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    console.error("Error creating stub user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 },
    );
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/app/api/admin/users/__tests__/route.test.ts
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add src/app/api/admin/users/route.ts src/app/api/admin/users/__tests__/route.test.ts
git commit -m "feat: add GET /api/admin/users with role-based access control"
```

---

### Task 6: Admin Users API — PUT (Update User Role/Manager/Status)

**Files:**
- Create: `src/app/api/admin/users/[id]/route.ts`
- Test: `src/app/api/admin/users/__tests__/route.test.ts` (add to existing)

**Step 1: Write the failing test**

Add to `src/app/api/admin/users/__tests__/route.test.ts`:

```typescript
// Add import at top:
import { PUT } from "../[id]/route";

// Add test suite:
describe("PUT /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when not admin", async () => {
    mockRequireRole.mockResolvedValue({
      error: "Insufficient permissions",
      status: 403,
    });

    const request = new NextRequest("http://localhost/api/admin/users/user-1", {
      method: "PUT",
      body: JSON.stringify({ role: "manager" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "user-1" }),
    });
    expect(response.status).toBe(403);
  });

  it("updates user role", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin", isActive: true, managerId: null },
    });

    const updatedUser = {
      id: "user-1",
      email: "rep@test.com",
      fullName: "Test Rep",
      role: "manager",
      isActive: true,
      managerId: null,
      lastLoginAt: new Date(),
    };

    mockPrisma.userProfile.findUnique.mockResolvedValue({
      id: "user-1",
    } as never);
    (mockPrisma.userProfile as any).update = vi.fn().mockResolvedValue(updatedUser);

    const request = new NextRequest("http://localhost/api/admin/users/user-1", {
      method: "PUT",
      body: JSON.stringify({ role: "manager" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "user-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.role).toBe("manager");
  });

  it("returns 404 when user not found", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin", isActive: true, managerId: null },
    });

    mockPrisma.userProfile.findUnique.mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/admin/users/nonexistent",
      {
        method: "PUT",
        body: JSON.stringify({ role: "manager" }),
      },
    );

    const response = await PUT(request, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(response.status).toBe(404);
  });

  it("returns 400 for invalid role", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin", isActive: true, managerId: null },
    });

    mockPrisma.userProfile.findUnique.mockResolvedValue({
      id: "user-1",
    } as never);

    const request = new NextRequest("http://localhost/api/admin/users/user-1", {
      method: "PUT",
      body: JSON.stringify({ role: "superadmin" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "user-1" }),
    });
    expect(response.status).toBe(400);
  });

  it("prevents admin from deactivating themselves", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin", isActive: true, managerId: null },
    });

    mockPrisma.userProfile.findUnique.mockResolvedValue({
      id: "admin-1",
    } as never);

    const request = new NextRequest(
      "http://localhost/api/admin/users/admin-1",
      {
        method: "PUT",
        body: JSON.stringify({ isActive: false }),
      },
    );

    const response = await PUT(request, {
      params: Promise.resolve({ id: "admin-1" }),
    });
    expect(response.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/admin/users/__tests__/route.test.ts
```

Expected: FAIL — cannot import PUT from `../[id]/route`.

**Step 3: Implement PUT endpoint**

```typescript
// src/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// PUT /api/admin/users/[id] - Update user role, manager, or active status
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireRole(["admin"]);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    const body = await request.json();
    const { role, managerId, isActive } = body as {
      role?: string;
      managerId?: string | null;
      isActive?: boolean;
    };

    // Validate role if provided
    const validRoles = ["admin", "manager", "rep"];
    if (role !== undefined && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be admin, manager, or rep" },
        { status: 400 },
      );
    }

    // Check target user exists
    const targetUser = await prisma.userProfile.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent admin from deactivating or demoting themselves
    if (id === auth.user.id) {
      if (isActive === false) {
        return NextResponse.json(
          { error: "Cannot deactivate your own account" },
          { status: 400 },
        );
      }
      if (role && role !== "admin") {
        return NextResponse.json(
          { error: "Cannot demote your own admin role" },
          { status: 400 },
        );
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (role !== undefined) updateData.role = role;
    if (managerId !== undefined) updateData.managerId = managerId;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await prisma.userProfile.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      isActive: updated.isActive,
      managerId: updated.managerId,
      lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npx vitest run src/app/api/admin/users/__tests__/route.test.ts
```

Expected: All 8 tests PASS.

**Step 5: Commit**

```bash
git add src/app/api/admin/users/[id]/route.ts src/app/api/admin/users/__tests__/route.test.ts
git commit -m "feat: add PUT /api/admin/users/[id] for role and status management"
```

---

### Task 7: Team Goals API

**Files:**
- Create: `src/app/api/admin/team-goals/route.ts`
- Create: `src/app/api/admin/team-goals/[fiscalYear]/route.ts`
- Test: `src/app/api/admin/team-goals/__tests__/route.test.ts`

**Step 1: Write the failing tests**

```typescript
// src/app/api/admin/team-goals/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    teamGoal: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    userGoal: {
      aggregate: vi.fn(),
    },
  },
}));

import { GET, POST } from "../route";
import { PUT } from "../[fiscalYear]/route";
import { requireRole } from "@/lib/auth";
import prisma from "@/lib/prisma";

const mockRequireRole = vi.mocked(requireRole);
const mockPrisma = vi.mocked(prisma);

describe("GET /api/admin/team-goals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when not admin", async () => {
    mockRequireRole.mockResolvedValue({
      error: "Insufficient permissions",
      status: 403,
    });
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("returns team goals for admin", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin", isActive: true, managerId: null },
    });

    const mockGoals = [
      {
        id: "goal-1",
        fiscalYear: 2026,
        earningsTarget: { toNumber: () => 5000000 },
        renewalTarget: null,
        winbackTarget: null,
        expansionTarget: null,
        newBusinessTarget: null,
        takeTarget: null,
        newDistrictsTarget: 50,
        createdBy: { id: "admin-1", fullName: "Admin" },
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ];

    mockPrisma.teamGoal.findMany.mockResolvedValue(mockGoals as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].fiscalYear).toBe(2026);
  });
});

describe("POST /api/admin/team-goals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates or updates a team goal", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin", isActive: true, managerId: null },
    });

    const mockGoal = {
      id: "goal-1",
      fiscalYear: 2026,
      earningsTarget: { toNumber: () => 5000000 },
      renewalTarget: null,
      winbackTarget: null,
      expansionTarget: null,
      newBusinessTarget: null,
      takeTarget: null,
      newDistrictsTarget: 50,
      createdById: "admin-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.teamGoal.upsert.mockResolvedValue(mockGoal as never);

    const request = new NextRequest(
      "http://localhost/api/admin/team-goals",
      {
        method: "POST",
        body: JSON.stringify({
          fiscalYear: 2026,
          earningsTarget: 5000000,
          newDistrictsTarget: 50,
        }),
      },
    );

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid fiscal year", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin", isActive: true, managerId: null },
    });

    const request = new NextRequest(
      "http://localhost/api/admin/team-goals",
      {
        method: "POST",
        body: JSON.stringify({ fiscalYear: 1999 }),
      },
    );

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/admin/team-goals/__tests__/route.test.ts
```

Expected: FAIL — modules not found.

**Step 3: Implement team goals GET/POST**

```typescript
// src/app/api/admin/team-goals/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

function toNumber(val: { toNumber(): number } | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return val.toNumber();
}

// GET /api/admin/team-goals - List all team goals
export async function GET() {
  try {
    const auth = await requireRole(["admin"]);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const goals = await prisma.teamGoal.findMany({
      orderBy: { fiscalYear: "desc" },
      include: {
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    const result = goals.map((g) => ({
      id: g.id,
      fiscalYear: g.fiscalYear,
      earningsTarget: toNumber(g.earningsTarget),
      renewalTarget: toNumber(g.renewalTarget),
      winbackTarget: toNumber(g.winbackTarget),
      expansionTarget: toNumber(g.expansionTarget),
      newBusinessTarget: toNumber(g.newBusinessTarget),
      takeTarget: toNumber(g.takeTarget),
      newDistrictsTarget: g.newDistrictsTarget ?? 0,
      createdBy: g.createdBy
        ? { id: g.createdBy.id, fullName: g.createdBy.fullName }
        : null,
      createdAt: g.createdAt.toISOString(),
      updatedAt: g.updatedAt.toISOString(),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing team goals:", error);
    return NextResponse.json(
      { error: "Failed to list team goals" },
      { status: 500 },
    );
  }
}

// POST /api/admin/team-goals - Create or update a team goal by fiscal year
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(["admin"]);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      fiscalYear,
      earningsTarget,
      renewalTarget,
      winbackTarget,
      expansionTarget,
      newBusinessTarget,
      takeTarget,
      newDistrictsTarget,
    } = body;

    if (
      !fiscalYear ||
      typeof fiscalYear !== "number" ||
      fiscalYear < 2020 ||
      fiscalYear > 2050
    ) {
      return NextResponse.json(
        { error: "fiscalYear is required and must be between 2020 and 2050" },
        { status: 400 },
      );
    }

    const data = {
      earningsTarget: earningsTarget ?? null,
      renewalTarget: renewalTarget ?? null,
      winbackTarget: winbackTarget ?? null,
      expansionTarget: expansionTarget ?? null,
      newBusinessTarget: newBusinessTarget ?? null,
      takeTarget: takeTarget ?? null,
      newDistrictsTarget: newDistrictsTarget ?? null,
    };

    const goal = await prisma.teamGoal.upsert({
      where: { fiscalYear },
      update: data,
      create: {
        fiscalYear,
        ...data,
        createdById: auth.user.id,
      },
    });

    return NextResponse.json(
      {
        id: goal.id,
        fiscalYear: goal.fiscalYear,
        earningsTarget: toNumber(goal.earningsTarget),
        renewalTarget: toNumber(goal.renewalTarget),
        winbackTarget: toNumber(goal.winbackTarget),
        expansionTarget: toNumber(goal.expansionTarget),
        newBusinessTarget: toNumber(goal.newBusinessTarget),
        takeTarget: toNumber(goal.takeTarget),
        newDistrictsTarget: goal.newDistrictsTarget ?? 0,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating team goal:", error);
    return NextResponse.json(
      { error: "Failed to create team goal" },
      { status: 500 },
    );
  }
}
```

**Step 4: Implement team goals PUT (by fiscal year)**

```typescript
// src/app/api/admin/team-goals/[fiscalYear]/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

function toNumber(val: { toNumber(): number } | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return val.toNumber();
}

// PUT /api/admin/team-goals/[fiscalYear] - Update a team goal
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ fiscalYear: string }> },
) {
  try {
    const auth = await requireRole(["admin"]);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { fiscalYear: fyStr } = await params;
    const fiscalYear = parseInt(fyStr, 10);

    if (isNaN(fiscalYear) || fiscalYear < 2020 || fiscalYear > 2050) {
      return NextResponse.json(
        { error: "Invalid fiscal year" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    const decimalFields = [
      "earningsTarget",
      "renewalTarget",
      "winbackTarget",
      "expansionTarget",
      "newBusinessTarget",
      "takeTarget",
    ] as const;

    for (const field of decimalFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    if (body.newDistrictsTarget !== undefined) {
      updateData.newDistrictsTarget = body.newDistrictsTarget;
    }

    const goal = await prisma.teamGoal.update({
      where: { fiscalYear },
      data: updateData,
    });

    return NextResponse.json({
      id: goal.id,
      fiscalYear: goal.fiscalYear,
      earningsTarget: toNumber(goal.earningsTarget),
      renewalTarget: toNumber(goal.renewalTarget),
      winbackTarget: toNumber(goal.winbackTarget),
      expansionTarget: toNumber(goal.expansionTarget),
      newBusinessTarget: toNumber(goal.newBusinessTarget),
      takeTarget: toNumber(goal.takeTarget),
      newDistrictsTarget: goal.newDistrictsTarget ?? 0,
    });
  } catch (error) {
    console.error("Error updating team goal:", error);
    return NextResponse.json(
      { error: "Failed to update team goal" },
      { status: 500 },
    );
  }
}
```

**Step 5: Run tests**

```bash
npx vitest run src/app/api/admin/team-goals/__tests__/route.test.ts
```

Expected: All 4 tests PASS.

**Step 6: Commit**

```bash
git add src/app/api/admin/team-goals/
git commit -m "feat: add team goals API for admin-managed fiscal year targets"
```

---

### Task 8: Bulk Assign API

**Files:**
- Create: `src/app/api/admin/bulk-assign/route.ts`
- Test: `src/app/api/admin/bulk-assign/__tests__/route.test.ts`

**Step 1: Write the failing test**

```typescript
// src/app/api/admin/bulk-assign/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    district: {
      updateMany: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}));

import { POST } from "../route";
import { requireRole } from "@/lib/auth";
import prisma from "@/lib/prisma";

const mockRequireRole = vi.mocked(requireRole);
const mockPrisma = vi.mocked(prisma);

describe("POST /api/admin/bulk-assign", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when not admin", async () => {
    mockRequireRole.mockResolvedValue({
      error: "Insufficient permissions",
      status: 403,
    });

    const request = new NextRequest(
      "http://localhost/api/admin/bulk-assign",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "user-1",
          districtLeaids: ["1234567"],
        }),
      },
    );

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("assigns districts to a user", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin", isActive: true, managerId: null },
    });

    mockPrisma.userProfile.findUnique.mockResolvedValue({
      id: "user-1",
      fullName: "Rep",
    } as never);
    mockPrisma.district.updateMany.mockResolvedValue({ count: 3 });

    const request = new NextRequest(
      "http://localhost/api/admin/bulk-assign",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "user-1",
          districtLeaids: ["1234567", "2345678", "3456789"],
        }),
      },
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.updated).toBe(3);
  });

  it("returns 400 when missing fields", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "admin", isActive: true, managerId: null },
    });

    const request = new NextRequest(
      "http://localhost/api/admin/bulk-assign",
      {
        method: "POST",
        body: JSON.stringify({ userId: "user-1" }),
      },
    );

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/admin/bulk-assign/__tests__/route.test.ts
```

**Step 3: Implement bulk assign endpoint**

The District model already has an `owner` string field (line ~87 in schema). This endpoint updates the `owner` field on districts in bulk.

```typescript
// src/app/api/admin/bulk-assign/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/admin/bulk-assign - Bulk assign district ownership
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(["admin"]);
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { userId, districtLeaids } = body as {
      userId?: string;
      districtLeaids?: string[];
    };

    if (!userId || !districtLeaids || !Array.isArray(districtLeaids) || districtLeaids.length === 0) {
      return NextResponse.json(
        { error: "userId and districtLeaids (non-empty array) are required" },
        { status: 400 },
      );
    }

    // Verify target user exists
    const targetUser = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "Target user not found" },
        { status: 404 },
      );
    }

    // Update the owner field on all specified districts
    const result = await prisma.district.updateMany({
      where: { leaid: { in: districtLeaids } },
      data: { owner: targetUser.fullName || targetUser.id },
    });

    return NextResponse.json({
      updated: result.count,
      userId,
      userName: targetUser.fullName,
    });
  } catch (error) {
    console.error("Error bulk assigning districts:", error);
    return NextResponse.json(
      { error: "Failed to bulk assign districts" },
      { status: 500 },
    );
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run src/app/api/admin/bulk-assign/__tests__/route.test.ts
```

Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add src/app/api/admin/bulk-assign/
git commit -m "feat: add bulk district ownership assignment API for admins"
```

---

### Task 9: Update Auth Callback for Role/Manager Merge

**Files:**
- Modify: `src/app/auth/callback/route.ts`

**Step 1: Update the stub merge to preserve role and managerId**

In the auth callback, when a stub user is merged into a real Supabase user, the role and managerId from the stub should be transferred. Update the upsert `create` block to check for stub data first:

In the upsert's `create` block (line ~56-68), before the upsert, save stub data if it exists:

```typescript
// After the stub merge transaction, before the upsert, capture stub role/managerId:
let stubRole: string | undefined;
let stubManagerId: string | null | undefined;

if (stub) {
  stubRole = (stub as any).role;
  stubManagerId = (stub as any).managerId;
  // ... existing merge transaction ...
}
```

Then include in the upsert `create`:

```typescript
create: {
  id: data.user.id,
  email: data.user.email!,
  fullName: /* ... existing ... */,
  avatarUrl: /* ... existing ... */,
  hasCompletedSetup: false,
  lastLoginAt: new Date(),
  ...(stubRole ? { role: stubRole } : {}),
  ...(stubManagerId ? { managerId: stubManagerId } : {}),
},
```

To do this properly, update the stub query to select `role` and `managerId`:

```typescript
const stub = await prisma.userProfile.findFirst({
  where: {
    email: data.user.email!,
    id: { not: data.user.id },
  },
  select: {
    id: true,
    role: true,
    managerId: true,
  },
})
```

**Step 2: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "fix: preserve role and managerId when merging stub users on login"
```

---

### Task 10: Update Territory Plans API for Manager/Admin Access

**Files:**
- Modify: `src/app/api/territory-plans/[id]/route.ts`

**Step 1: Update the PUT handler to allow manager/admin edits**

Currently the PUT handler on territory plans likely only checks that the user is the plan creator. Update it to:
1. Import `getUserWithRole` from `@/lib/auth`
2. After fetching the plan, check permissions:
   - If user is the plan creator (`userId`) → allowed
   - If user is admin → allowed
   - If user is manager AND the plan's `userId` is one of their direct reports → allowed
   - Otherwise → 403

Replace the existing auth check in the PUT handler with:

```typescript
import { getUserWithRole } from "@/lib/auth";

// In PUT handler, after finding the plan:
const authUser = await getUserWithRole();
if (!authUser) {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

// Check edit permission
const isCreator = plan.userId === authUser.id;
const isAdmin = authUser.role === "admin";
let isManager = false;

if (authUser.role === "manager") {
  // Check if plan owner is a direct report of this manager
  const planOwnerProfile = await prisma.userProfile.findUnique({
    where: { id: plan.userId },
    select: { managerId: true },
  });
  isManager = planOwnerProfile?.managerId === authUser.id;
}

if (!isCreator && !isAdmin && !isManager) {
  return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
}
```

**Step 2: Commit**

```bash
git add src/app/api/territory-plans/[id]/route.ts
git commit -m "feat: allow managers and admins to edit territory plans"
```

---

### Task 11: Update Goals API for Manager/Admin Access

**Files:**
- Modify: `src/app/api/profile/goals/route.ts`

**Step 1: Update the POST handler to allow setting goals for other users**

Currently the goals endpoint only creates goals for the authenticated user. Add optional `targetUserId` parameter:

```typescript
import { getUserWithRole } from "@/lib/auth";

// In POST handler:
const authUser = await getUserWithRole();
if (!authUser) {
  return NextResponse.json({ error: "Authentication required" }, { status: 401 });
}

const body = await request.json();
const { targetUserId, fiscalYear, ...goalFields } = body;

// Determine whose goal to set
let goalUserId = authUser.id;

if (targetUserId && targetUserId !== authUser.id) {
  // Manager can set goals for their direct reports
  if (authUser.role === "manager") {
    const targetProfile = await prisma.userProfile.findUnique({
      where: { id: targetUserId },
      select: { managerId: true },
    });
    if (targetProfile?.managerId !== authUser.id) {
      return NextResponse.json({ error: "Can only set goals for your direct reports" }, { status: 403 });
    }
    goalUserId = targetUserId;
  }
  // Admin can set goals for anyone
  else if (authUser.role === "admin") {
    goalUserId = targetUserId;
  }
  // Rep cannot set goals for others
  else {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }
}

// ... rest of upsert logic using goalUserId instead of user.id
```

**Step 2: Commit**

```bash
git add src/app/api/profile/goals/route.ts
git commit -m "feat: allow managers and admins to set goals for other users"
```

---

### Task 12: Add Role to Profile API Response

**Files:**
- Modify: `src/app/api/profile/route.ts`

**Step 1: Include role, managerId, isActive in the profile GET response**

The profile API already fetches UserProfile. Add the new fields to the response:

```typescript
// In the profile serialization, add:
role: profile.role,
managerId: profile.managerId,
isActive: profile.isActive,
```

**Step 2: Commit**

```bash
git add src/app/api/profile/route.ts
git commit -m "feat: include role and manager info in profile API response"
```

---

### Task 13: Admin Page — Layout and Users Tab

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/features/admin/components/AdminPage.tsx`
- Create: `src/features/admin/components/UsersTab.tsx`
- Create: `src/features/admin/lib/api.ts` (React Query hooks)

**Step 1: Create the admin API hooks**

```typescript
// src/features/admin/lib/api.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  role: "admin" | "manager" | "rep";
  isActive: boolean;
  managerId: string | null;
  manager: { id: string; fullName: string | null } | null;
  directReportCount: number;
  lastLoginAt: string | null;
};

export type TeamGoal = {
  id: string;
  fiscalYear: number;
  earningsTarget: number;
  renewalTarget: number;
  winbackTarget: number;
  expansionTarget: number;
  newBusinessTarget: number;
  takeTarget: number;
  newDistrictsTarget: number;
  createdBy: { id: string; fullName: string | null } | null;
  createdAt: string;
  updatedAt: string;
};

export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      role?: string;
      managerId?: string | null;
      isActive?: boolean;
    }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      email: string;
      fullName?: string;
      role?: string;
    }) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to invite user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useTeamGoals() {
  return useQuery<TeamGoal[]>({
    queryKey: ["admin", "team-goals"],
    queryFn: async () => {
      const res = await fetch("/api/admin/team-goals");
      if (!res.ok) throw new Error("Failed to fetch team goals");
      return res.json();
    },
  });
}

export function useUpsertTeamGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<TeamGoal> & { fiscalYear: number }) => {
      const res = await fetch("/api/admin/team-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save team goal");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "team-goals"] });
    },
  });
}

export function useBulkAssign() {
  return useMutation({
    mutationFn: async (data: {
      userId: string;
      districtLeaids: string[];
    }) => {
      const res = await fetch("/api/admin/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to bulk assign");
      }
      return res.json();
    },
  });
}
```

**Step 2: Create UsersTab component**

Refer to existing table patterns in the codebase (TanStack React Table). Build a users table with inline role dropdown, manager dropdown, active/inactive toggle. Include an "Invite User" button that opens a form.

Use existing Fullmind brand colors:
- Primary purple: `#403770`
- Accent coral: `#F37167`
- Background warm white: `#FFFCFA`
- Font: Plus Jakarta Sans (already loaded)

```typescript
// src/features/admin/components/UsersTab.tsx
"use client";

import { useState } from "react";
import { useAdminUsers, useUpdateUser, useInviteUser, type AdminUser } from "../lib/api";

export default function UsersTab() {
  const { data: users, isLoading } = useAdminUsers();
  const updateUser = useUpdateUser();
  const inviteUser = useInviteUser();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("rep");

  const managers = users?.filter(
    (u) => u.role === "manager" || u.role === "admin",
  );

  const handleRoleChange = (userId: string, role: string) => {
    updateUser.mutate({ id: userId, role });
  };

  const handleManagerChange = (userId: string, managerId: string | null) => {
    updateUser.mutate({ id: userId, managerId });
  };

  const handleToggleActive = (userId: string, isActive: boolean) => {
    updateUser.mutate({ id: userId, isActive: !isActive });
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    inviteUser.mutate(
      { email: inviteEmail, fullName: inviteName, role: inviteRole },
      {
        onSuccess: () => {
          setShowInvite(false);
          setInviteEmail("");
          setInviteName("");
          setInviteRole("rep");
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F37167] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-[#403770]">
          Users ({users?.length ?? 0})
        </h2>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="px-4 py-2 bg-[#403770] text-white rounded-lg text-sm font-medium hover:bg-[#332c5a] transition-colors"
        >
          Invite User
        </button>
      </div>

      {showInvite && (
        <div className="mb-6 p-4 bg-white rounded-lg border border-gray-200">
          <h3 className="text-sm font-medium text-[#403770] mb-3">
            Invite New User
          </h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@company.com"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              >
                <option value="rep">Rep</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={inviteUser.isPending}
              className="px-4 py-2 bg-[#F37167] text-white rounded-lg text-sm font-medium hover:bg-[#e0625a] transition-colors disabled:opacity-50"
            >
              {inviteUser.isPending ? "Sending..." : "Send Invite"}
            </button>
          </div>
          {inviteUser.isError && (
            <p className="mt-2 text-sm text-red-600">
              {inviteUser.error.message}
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                User
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Role
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Manager
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Status
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Last Login
              </th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr
                key={user.id}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#403770] flex items-center justify-center text-white text-xs font-medium">
                        {(user.fullName || user.email)[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {user.fullName || "—"}
                      </div>
                      <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="px-2 py-1 border border-gray-200 rounded text-sm bg-white"
                  >
                    <option value="rep">Rep</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={user.managerId ?? ""}
                    onChange={(e) =>
                      handleManagerChange(
                        user.id,
                        e.target.value || null,
                      )
                    }
                    className="px-2 py-1 border border-gray-200 rounded text-sm bg-white"
                  >
                    <option value="">None</option>
                    {managers
                      ?.filter((m) => m.id !== user.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName || m.email}
                        </option>
                      ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggleActive(user.id, user.isActive)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      user.isActive
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleDateString()
                    : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/features/admin/
git commit -m "feat: add admin users tab with role management and invite flow"
```

---

### Task 14: Admin Page — Team Goals Tab

**Files:**
- Create: `src/features/admin/components/TeamGoalsTab.tsx`

**Step 1: Build the team goals form component**

Display a form per fiscal year to set team-wide targets. Show the team goal alongside sum of individual user goals for comparison.

Follow the same patterns as UsersTab — use the hooks from `api.ts`, brand colors, consistent styling.

Key fields: earningsTarget, renewalTarget, winbackTarget, expansionTarget, newBusinessTarget, takeTarget, newDistrictsTarget.

Include a fiscal year selector (2025–2028), input fields for each target, and save button.

**Step 2: Commit**

```bash
git add src/features/admin/components/TeamGoalsTab.tsx
git commit -m "feat: add admin team goals tab for fiscal year target management"
```

---

### Task 15: Admin Page — Territory Assignment Tab

**Files:**
- Create: `src/features/admin/components/TerritoryAssignmentTab.tsx`

**Step 1: Build the bulk assignment interface**

A simple interface:
1. Select a user from a dropdown (populated from admin users list)
2. Enter or paste district LEAIDs (comma or newline separated)
3. Submit button calls the bulk-assign API
4. Show result (N districts updated)

Later iterations can add a map-based selection interface, but start with the text-based approach.

**Step 2: Commit**

```bash
git add src/features/admin/components/TerritoryAssignmentTab.tsx
git commit -m "feat: add admin territory assignment tab for bulk ownership"
```

---

### Task 16: Admin Page — Main Page and Route

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/features/admin/components/AdminPage.tsx`

**Step 1: Create the AdminPage component with tab navigation**

```typescript
// src/features/admin/components/AdminPage.tsx
"use client";

import { useState } from "react";
import UsersTab from "./UsersTab";
import TeamGoalsTab from "./TeamGoalsTab";
import TerritoryAssignmentTab from "./TerritoryAssignmentTab";

type Tab = "users" | "team-goals" | "territory-assignment";

const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "team-goals", label: "Team Goals" },
  { id: "territory-assignment", label: "Territory Assignment" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("users");

  return (
    <div className="min-h-screen bg-[#FFFCFA]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-[#403770] mb-6">
          Administration
        </h1>

        <div className="flex gap-1 mb-8 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#F37167] text-[#403770]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "users" && <UsersTab />}
        {activeTab === "team-goals" && <TeamGoalsTab />}
        {activeTab === "territory-assignment" && <TerritoryAssignmentTab />}
      </div>
    </div>
  );
}
```

**Step 2: Create the Next.js page**

```typescript
// src/app/admin/page.tsx
import { redirect } from "next/navigation";
import { getUserWithRole } from "@/lib/auth";
import AdminPage from "@/features/admin/components/AdminPage";

export const dynamic = "force-dynamic";

export default async function AdminRoute() {
  const user = await getUserWithRole();

  if (!user || user.role !== "admin") {
    redirect("/");
  }

  return <AdminPage />;
}
```

**Step 3: Update middleware to allow `/admin` route**

In `src/middleware.ts` or `src/lib/supabase/middleware.ts`, ensure `/admin` is not in the public routes list (it requires auth, which it already does since it's not in the exclusion list for `/login`, `/signup`, `/auth/*`).

No changes needed — the existing middleware already protects all routes except the auth routes.

**Step 4: Commit**

```bash
git add src/app/admin/ src/features/admin/
git commit -m "feat: add /admin route with server-side role check and tab navigation"
```

---

### Task 17: Add Admin Link to Navigation

**Files:**
- Modify: The sidebar/navigation component (check `src/features/shared/components/layout/AppShell.tsx` or similar)

**Step 1: Find the navigation component**

Look for the AppShell or sidebar component that renders the tab navigation. Add a conditional link to `/admin` that only shows for admin users.

This requires fetching the current user's role on the client side. Use the profile API response (which now includes `role` from Task 12) to conditionally show the admin link.

**Step 2: Add an admin link**

If the profile response includes `role === "admin"`, render a link to `/admin` in the sidebar or nav bar. Use an external link (`<a href="/admin">`) since `/admin` is a separate Next.js route outside the SPA.

**Step 3: Commit**

```bash
git add src/features/shared/components/layout/
git commit -m "feat: show admin link in navigation for admin users"
```

---

### Task 18: Seed First Admin User

**Files:**
- Create: `scripts/seed-admin.ts` (or add to existing seed)

**Step 1: Create a script to promote a user to admin by email**

```typescript
// scripts/seed-admin.ts
import prisma from "../src/lib/prisma";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/seed-admin.ts <email>");
    process.exit(1);
  }

  const user = await prisma.userProfile.update({
    where: { email },
    data: { role: "admin" },
  });

  console.log(`Promoted ${user.fullName || user.email} to admin`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Step 2: Commit**

```bash
git add scripts/seed-admin.ts
git commit -m "feat: add script to promote a user to admin role"
```

---

### Task 19: Run All Tests

**Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: All existing tests + new tests pass.

**Step 2: Fix any failures**

If any existing tests break (e.g., because the UserProfile model now requires/has new fields), update the mocks in those test files to include the new fields with defaults (`role: "rep"`, `isActive: true`, `managerId: null`).

**Step 3: Commit any test fixes**

```bash
git add -u
git commit -m "test: fix existing tests for new role fields"
```

---

### Task 20: Final Verification

**Step 1: Verify Prisma schema is valid**

```bash
npx prisma validate
```

Expected: "The schema is valid."

**Step 2: Verify build passes**

```bash
npm run build
```

Expected: No TypeScript errors, build succeeds.

**Step 3: Manual smoke test (if dev server available)**

1. Start dev server: `npm run dev`
2. Log in, verify profile response includes `role: "rep"`
3. Run seed-admin script for your user
4. Refresh, verify `/admin` link appears in nav
5. Navigate to `/admin`, verify Users/Team Goals/Territory tabs render
6. Change a user's role, verify it persists
7. Set a team goal, verify it saves
8. Test bulk assignment
