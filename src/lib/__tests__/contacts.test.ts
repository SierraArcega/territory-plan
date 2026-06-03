import { describe, it, expect, vi } from "vitest";
import { findContactByEmail } from "../contacts";

function makeDb() {
  return {
    contact: { findFirst: vi.fn() },
  };
}

describe("findContactByEmail", () => {
  it("calls findFirst with case-insensitive where clause and returns its result", async () => {
    const db = makeDb();
    const fakeContact = { id: 1, name: "Alice", email: "a@b.org", leaid: "100" };
    db.contact.findFirst.mockResolvedValue(fakeContact);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findContactByEmail(db as any, "100", "A@B.org");

    expect(db.contact.findFirst).toHaveBeenCalledWith({
      where: { leaid: "100", email: { equals: "A@B.org", mode: "insensitive" } },
    });
    expect(result).toBe(fakeContact);
  });

  it("returns null without calling findFirst when email is empty string", async () => {
    const db = makeDb();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findContactByEmail(db as any, "100", "");

    expect(db.contact.findFirst).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("returns null without calling findFirst when email is null", async () => {
    const db = makeDb();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await findContactByEmail(db as any, "100", null);

    expect(db.contact.findFirst).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});
