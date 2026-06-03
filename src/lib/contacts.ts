import type { Prisma, PrismaClient, Contact } from "@prisma/client";

// A Prisma client OR an interactive-transaction client — both expose `.contact`.
type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Single source of truth for the (leaid, email) contact-dedup predicate.
 * Used by the contacts API, the calendar confirm transaction, and the Clay
 * webhook so the match rule (case-insensitive email, scoped to the district)
 * can't drift between callers. Returns null when email is falsy.
 */
export async function findContactByEmail(
  db: DbClient,
  leaid: string,
  email: string | null | undefined
): Promise<Contact | null> {
  if (!email) return null;
  return db.contact.findFirst({
    where: { leaid, email: { equals: email, mode: "insensitive" } },
  });
}
