import prisma from "@/lib/prisma";
import { ServiceError, type DbClient } from "@/features/shared/lib/service-error";
import { isValidPersona, isValidSeniorityLevel } from "@/features/shared/types/contact-types";

/**
 * Contact mutation service. Extracted from the contact routes so the same
 * validation runs from `POST /api/contacts` + `PUT /api/contacts/[id]` and the
 * AI copilot's execute endpoint. Contacts have no owner field, so there is no
 * per-record authorization here (the routes never gated on ownership); callers
 * that need auth (the copilot) gate at their own boundary.
 */

export interface CreateContactInput {
  leaid?: string;
  salutation?: string | null;
  name?: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
  linkedinUrl?: string | null;
  persona?: string | null;
  seniorityLevel?: string | null;
}

export async function createContact(input: CreateContactInput, db: DbClient = prisma) {
  const { leaid, salutation, name, title, email, phone, isPrimary, linkedinUrl, persona, seniorityLevel } = input;

  if (!leaid || !name) {
    throw new ServiceError("leaid and name are required", 400);
  }
  if (persona && !isValidPersona(persona)) {
    throw new ServiceError("Invalid persona value", 400);
  }
  if (seniorityLevel && !isValidSeniorityLevel(seniorityLevel)) {
    throw new ServiceError("Invalid seniority level value", 400);
  }

  const district = await db.district.findUnique({ where: { leaid } });
  if (!district) {
    throw new ServiceError("District not found", 404);
  }

  // Promoting a new primary demotes the existing one(s) for that district.
  if (isPrimary) {
    await db.contact.updateMany({
      where: { leaid, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  return db.contact.create({
    data: {
      leaid,
      salutation: salutation || null,
      name,
      title: title || null,
      email: email || null,
      phone: phone || null,
      isPrimary: isPrimary || false,
      linkedinUrl: linkedinUrl || null,
      persona: persona || null,
      seniorityLevel: seniorityLevel || null,
    },
  });
}

export interface UpdateContactInput {
  salutation?: string | null;
  name?: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
  linkedinUrl?: string | null;
  persona?: string | null;
  seniorityLevel?: string | null;
}

export async function updateContact(id: number, input: UpdateContactInput, db: DbClient = prisma) {
  const { salutation, name, title, email, phone, isPrimary, linkedinUrl, persona, seniorityLevel } = input;

  if (persona && !isValidPersona(persona)) {
    throw new ServiceError("Invalid persona value", 400);
  }
  if (seniorityLevel && !isValidSeniorityLevel(seniorityLevel)) {
    throw new ServiceError("Invalid seniority level value", 400);
  }

  const existing = await db.contact.findUnique({ where: { id } });
  if (!existing) {
    throw new ServiceError("Contact not found", 404);
  }

  if (isPrimary && !existing.isPrimary) {
    await db.contact.updateMany({
      where: { leaid: existing.leaid, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  return db.contact.update({
    where: { id },
    data: {
      salutation: salutation !== undefined ? salutation : undefined,
      name: name !== undefined ? name : undefined,
      title: title !== undefined ? title : undefined,
      email: email !== undefined ? email : undefined,
      phone: phone !== undefined ? phone : undefined,
      isPrimary: isPrimary !== undefined ? isPrimary : undefined,
      linkedinUrl: linkedinUrl !== undefined ? linkedinUrl : undefined,
      persona: persona !== undefined ? persona : undefined,
      seniorityLevel: seniorityLevel !== undefined ? seniorityLevel : undefined,
    },
  });
}
