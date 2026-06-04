import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    contact: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    district: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { createContact, updateContact } from "../service";
import { ServiceError } from "@/features/shared/lib/service-error";

const contactRow = {
  id: 7,
  leaid: "0601234",
  salutation: null,
  name: "Jane Doe",
  title: "Superintendent",
  email: null,
  phone: null,
  isPrimary: false,
  linkedinUrl: null,
  persona: null,
  seniorityLevel: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createContact", () => {
  it("rejects when leaid or name is missing", async () => {
    await expect(createContact({ name: "Jane" })).rejects.toMatchObject({ status: 400 });
    await expect(createContact({ leaid: "0601234" })).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an invalid persona", async () => {
    await expect(
      createContact({ leaid: "0601234", name: "Jane", persona: "not-a-persona" }),
    ).rejects.toBeInstanceOf(ServiceError);
  });

  it("404s when the district does not exist", async () => {
    mockPrisma.district.findUnique.mockResolvedValue(null);
    await expect(
      createContact({ leaid: "missing", name: "Jane" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("unsets other primary contacts when creating a primary", async () => {
    mockPrisma.district.findUnique.mockResolvedValue({ leaid: "0601234" });
    mockPrisma.contact.create.mockResolvedValue({ ...contactRow, isPrimary: true });
    await createContact({ leaid: "0601234", name: "Jane", isPrimary: true });
    expect(mockPrisma.contact.updateMany).toHaveBeenCalledWith({
      where: { leaid: "0601234", isPrimary: true },
      data: { isPrimary: false },
    });
  });

  it("creates the contact under the given district", async () => {
    mockPrisma.district.findUnique.mockResolvedValue({ leaid: "0601234" });
    mockPrisma.contact.create.mockResolvedValue(contactRow);
    const result = await createContact({ leaid: "0601234", name: "Jane Doe", title: "Superintendent" });
    expect(result.id).toBe(7);
    const arg = mockPrisma.contact.create.mock.calls[0][0];
    expect(arg.data.leaid).toBe("0601234");
    expect(arg.data.name).toBe("Jane Doe");
  });
});

describe("updateContact", () => {
  it("404s when the contact is missing", async () => {
    mockPrisma.contact.findUnique.mockResolvedValue(null);
    await expect(updateContact(7, { title: "VP" })).rejects.toMatchObject({ status: 404 });
  });

  it("rejects an invalid seniority level", async () => {
    mockPrisma.contact.findUnique.mockResolvedValue(contactRow);
    await expect(
      updateContact(7, { seniorityLevel: "galactic-overlord" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("unsets other primaries when promoting a non-primary contact", async () => {
    mockPrisma.contact.findUnique.mockResolvedValue({ ...contactRow, isPrimary: false });
    mockPrisma.contact.update.mockResolvedValue({ ...contactRow, isPrimary: true });
    await updateContact(7, { isPrimary: true });
    expect(mockPrisma.contact.updateMany).toHaveBeenCalledWith({
      where: { leaid: "0601234", isPrimary: true },
      data: { isPrimary: false },
    });
  });

  it("updates only the provided fields", async () => {
    mockPrisma.contact.findUnique.mockResolvedValue(contactRow);
    mockPrisma.contact.update.mockResolvedValue({ ...contactRow, title: "VP" });
    const result = await updateContact(7, { title: "VP" });
    expect(result.title).toBe("VP");
    const arg = mockPrisma.contact.update.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 7 });
    expect(arg.data.name).toBeUndefined();
  });
});
