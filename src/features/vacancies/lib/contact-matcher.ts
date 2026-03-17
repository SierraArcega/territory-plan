import prisma from "@/lib/prisma";

/**
 * Matches a hiring email against contacts for the given district (leaid).
 * Returns the contact id if an exact email match is found, null otherwise.
 */
export async function matchContact(
  hiringEmail: string,
  leaid: string
): Promise<number | null> {
  const contact = await prisma.contact.findFirst({
    where: {
      leaid,
      email: hiringEmail.toLowerCase().trim(),
    },
    select: { id: true },
  });

  return contact?.id ?? null;
}
