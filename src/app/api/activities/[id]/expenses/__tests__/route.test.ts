import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockIsAdmin = vi.fn().mockResolvedValue(false);
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    activity: {
      findUnique: vi.fn(),
    },
    activityPlan: { findFirst: vi.fn() },
    activityExpense: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { POST as createExpense, GET as listExpenses } from "../route";
import { DELETE as deleteExpense } from "../[expenseId]/route";

const TEST_USER = { id: "user-1", email: "test@example.com" };

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3000"), init as never);
}

describe("POST /api/activities/[id]/expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const req = makeRequest("/api/activities/a-1/expenses", {
      method: "POST",
      body: JSON.stringify({ description: "Lunch", amount: 25, category: "meals" }),
    });
    const res = await createExpense(req, {
      params: Promise.resolve({ id: "a-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when activity does not exist", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue(null);

    const req = makeRequest("/api/activities/a-1/expenses", {
      method: "POST",
      body: JSON.stringify({ description: "Lunch", amount: 25, category: "meals" }),
    });
    const res = await createExpense(req, {
      params: Promise.resolve({ id: "a-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when user is neither owner nor admin", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "a-1",
      createdByUserId: "other-user",
    });
    mockIsAdmin.mockResolvedValueOnce(false);

    const req = makeRequest("/api/activities/a-1/expenses", {
      method: "POST",
      body: JSON.stringify({ description: "Lunch", amount: 25, category: "meals" }),
    });
    const res = await createExpense(req, {
      params: Promise.resolve({ id: "a-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid category", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "a-1",
      createdByUserId: "user-1",
    });

    const req = makeRequest("/api/activities/a-1/expenses", {
      method: "POST",
      body: JSON.stringify({
        description: "Lunch",
        amount: 25,
        category: "rocket_fuel",
      }),
    });
    const res = await createExpense(req, {
      params: Promise.resolve({ id: "a-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("category must be one of:");
  });

  it("returns 400 for missing description", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "a-1",
      createdByUserId: "user-1",
    });

    const req = makeRequest("/api/activities/a-1/expenses", {
      method: "POST",
      body: JSON.stringify({ amount: 25, category: "meals" }),
    });
    const res = await createExpense(req, {
      params: Promise.resolve({ id: "a-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative amount", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "a-1",
      createdByUserId: "user-1",
    });

    const req = makeRequest("/api/activities/a-1/expenses", {
      method: "POST",
      body: JSON.stringify({ description: "Lunch", amount: -5, category: "meals" }),
    });
    const res = await createExpense(req, {
      params: Promise.resolve({ id: "a-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("creates an expense and returns the serialized row", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "a-1",
      createdByUserId: "user-1",
    });
    mockPrisma.activityExpense.create.mockResolvedValue({
      id: "exp-1",
      description: "Lunch with super",
      amount: "32.50",
      category: "meals",
      incurredOn: new Date("2026-04-20T00:00:00Z"),
      receiptStoragePath: null,
      createdById: "user-1",
    });

    const req = makeRequest("/api/activities/a-1/expenses", {
      method: "POST",
      body: JSON.stringify({
        description: "Lunch with super",
        amount: 32.5,
        category: "meals",
        incurredOn: "2026-04-20T00:00:00Z",
      }),
    });
    const res = await createExpense(req, {
      params: Promise.resolve({ id: "a-1" }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe("exp-1");
    expect(body.amount).toBe(32.5);
    expect(body.amountCents).toBe(3250);
    expect(body.category).toBe("meals");
    expect(body.incurredOn).toBe("2026-04-20T00:00:00.000Z");

    expect(mockPrisma.activityExpense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activityId: "a-1",
          description: "Lunch with super",
          amount: 32.5,
          category: "meals",
          createdById: "user-1",
        }),
      })
    );
  });
});

describe("DELETE /api/activities/[id]/expenses/[expenseId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);

    const req = makeRequest("/api/activities/a-1/expenses/exp-1", {
      method: "DELETE",
    });
    const res = await deleteExpense(req, {
      params: Promise.resolve({ id: "a-1", expenseId: "exp-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is neither owner nor admin", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "a-1",
      createdByUserId: "other-user",
    });
    mockIsAdmin.mockResolvedValueOnce(false);

    const req = makeRequest("/api/activities/a-1/expenses/exp-1", {
      method: "DELETE",
    });
    const res = await deleteExpense(req, {
      params: Promise.resolve({ id: "a-1", expenseId: "exp-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when expense belongs to a different activity", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "a-1",
      createdByUserId: "user-1",
    });
    mockPrisma.activityExpense.findUnique.mockResolvedValue({
      id: "exp-1",
      activityId: "a-different",
    });

    const req = makeRequest("/api/activities/a-1/expenses/exp-1", {
      method: "DELETE",
    });
    const res = await deleteExpense(req, {
      params: Promise.resolve({ id: "a-1", expenseId: "exp-1" }),
    });
    expect(res.status).toBe(404);
    expect(mockPrisma.activityExpense.delete).not.toHaveBeenCalled();
  });

  it("deletes the expense for the owner", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "a-1",
      createdByUserId: "user-1",
    });
    mockPrisma.activityExpense.findUnique.mockResolvedValue({
      id: "exp-1",
      activityId: "a-1",
    });
    mockPrisma.activityExpense.delete.mockResolvedValue({});

    const req = makeRequest("/api/activities/a-1/expenses/exp-1", {
      method: "DELETE",
    });
    const res = await deleteExpense(req, {
      params: Promise.resolve({ id: "a-1", expenseId: "exp-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockPrisma.activityExpense.delete).toHaveBeenCalledWith({
      where: { id: "exp-1" },
    });
  });
});

describe("GET /api/activities/[id]/expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns expenses for the owner", async () => {
    mockGetUser.mockResolvedValue(TEST_USER);
    mockPrisma.activity.findUnique.mockResolvedValue({
      id: "a-1",
      createdByUserId: "user-1",
    });
    mockPrisma.activityExpense.findMany.mockResolvedValue([
      {
        id: "exp-1",
        description: "Coffee",
        amount: "4.25",
        category: "meals",
        incurredOn: new Date("2026-04-20T00:00:00Z"),
        receiptStoragePath: null,
        createdById: "user-1",
      },
    ]);

    const req = makeRequest("/api/activities/a-1/expenses");
    const res = await listExpenses(req, {
      params: Promise.resolve({ id: "a-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.expenses).toHaveLength(1);
    expect(body.expenses[0].amountCents).toBe(425);
    expect(body.expenses[0].category).toBe("meals");
  });
});
