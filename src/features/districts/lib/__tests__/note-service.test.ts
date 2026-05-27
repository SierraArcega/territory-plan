import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    districtNote: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    district: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { createDistrictNote, updateDistrictNote } from "../note-service";

const author = { id: "user-1", fullName: "Rep One", email: "rep@x.com", avatarUrl: null };
const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }] };
const noteRow = {
  id: "note-1",
  districtLeaid: "0601234",
  authorId: "user-1",
  bodyJson: doc,
  bodyText: "hi",
  noteType: "general_update",
  createdAt: new Date("2026-05-27T00:00:00Z"),
  updatedAt: new Date("2026-05-27T00:00:00Z"),
  author,
};

const never = () => Promise.resolve(false);
const always = () => Promise.resolve(true);

beforeEach(() => vi.clearAllMocks());

describe("createDistrictNote", () => {
  it("rejects empty bodyText", async () => {
    await expect(
      createDistrictNote("0601234", { bodyText: "   ", bodyJson: doc }, "user-1"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a non-object bodyJson", async () => {
    await expect(
      createDistrictNote("0601234", { bodyText: "hi", bodyJson: "nope" }, "user-1"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an invalid noteType", async () => {
    await expect(
      createDistrictNote("0601234", { bodyText: "hi", bodyJson: doc, noteType: "rumor" }, "user-1"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("404s when the district does not exist (clean error, not a raw FK 500)", async () => {
    mockPrisma.district.findUnique.mockResolvedValue(null);
    await expect(
      createDistrictNote("ghost", { bodyText: "hi", bodyJson: doc }, "user-1"),
    ).rejects.toMatchObject({ status: 404 });
    expect(mockPrisma.districtNote.create).not.toHaveBeenCalled();
  });

  it("defaults the noteType and stamps the author", async () => {
    mockPrisma.district.findUnique.mockResolvedValue({ leaid: "0601234" });
    mockPrisma.districtNote.create.mockResolvedValue(noteRow);
    const result = await createDistrictNote("0601234", { bodyText: "hi", bodyJson: doc }, "user-1");
    expect(result.id).toBe("note-1");
    const arg = mockPrisma.districtNote.create.mock.calls[0][0];
    expect(arg.data.authorId).toBe("user-1");
    expect(arg.data.districtLeaid).toBe("0601234");
    expect(arg.data.noteType).toBe("general_update");
  });
});

describe("updateDistrictNote", () => {
  it("404s when the note is missing", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue(null);
    await expect(
      updateDistrictNote("0601234", "note-x", { bodyText: "hi", bodyJson: doc }, "user-1", never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("404s when the note belongs to another district", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue({ ...noteRow, districtLeaid: "9999999" });
    await expect(
      updateDistrictNote("0601234", "note-1", { bodyText: "hi", bodyJson: doc }, "user-1", never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("403s when the user is neither author nor admin", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue({ ...noteRow, authorId: "someone-else" });
    await expect(
      updateDistrictNote("0601234", "note-1", { bodyText: "hi", bodyJson: doc }, "user-1", never),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("allows an admin to edit someone else's note", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue({ ...noteRow, authorId: "someone-else" });
    mockPrisma.districtNote.update.mockResolvedValue(noteRow);
    const result = await updateDistrictNote(
      "0601234", "note-1", { bodyText: "hi", bodyJson: doc }, "user-1", always,
    );
    expect(result.id).toBe("note-1");
    expect(mockPrisma.districtNote.update).toHaveBeenCalledOnce();
  });

  it("rejects an invalid noteType before writing", async () => {
    mockPrisma.districtNote.findUnique.mockResolvedValue(noteRow);
    await expect(
      updateDistrictNote("0601234", "note-1", { bodyText: "hi", bodyJson: doc, noteType: "rumor" }, "user-1", never),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockPrisma.districtNote.update).not.toHaveBeenCalled();
  });
});
