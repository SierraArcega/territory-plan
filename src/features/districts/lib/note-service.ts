import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { ServiceError, type DbClient } from "@/features/shared/lib/service-error";
import { isNoteType, DEFAULT_NOTE_TYPE } from "@/features/views/lib/note-types";

/**
 * District-note mutation service. Extracted from the note routes so the same
 * validation + author/admin authorization runs from
 * `POST/PATCH /api/districts/[leaid]/notes[/noteId]` and the AI copilot's
 * execute endpoint. `isAdmin` is passed as a resolver so the service stays
 * decoupled from the Supabase auth helper and only pays the lookup when the
 * author check fails (matching the route's lazy evaluation).
 */

const AUTHOR_SELECT = { id: true, fullName: true, email: true, avatarUrl: true } as const;

interface NoteRow {
  id: string;
  bodyJson: unknown;
  bodyText: string;
  noteType: string;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; fullName: string | null; email: string; avatarUrl: string | null };
}

function serialize(n: NoteRow) {
  return {
    id: n.id,
    bodyJson: n.bodyJson,
    bodyText: n.bodyText,
    noteType: n.noteType,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    author: n.author,
  };
}

export interface DistrictNoteInput {
  bodyText: string;
  bodyJson: unknown;
  noteType?: string;
}

function validateBody(input: DistrictNoteInput): string {
  const bodyText = typeof input.bodyText === "string" ? input.bodyText.trim() : "";
  if (!bodyText || input.bodyJson == null || typeof input.bodyJson !== "object") {
    throw new ServiceError("bodyJson + non-empty bodyText required", 400);
  }
  return bodyText;
}

export async function createDistrictNote(
  leaid: string,
  input: DistrictNoteInput,
  userId: string,
  db: DbClient = prisma,
) {
  const bodyText = validateBody(input);
  const noteType = input.noteType === undefined ? DEFAULT_NOTE_TYPE : input.noteType;
  if (!isNoteType(noteType)) {
    throw new ServiceError("Invalid noteType", 400);
  }

  // Guard the FK so a bad/guessed leaid is a clean 404, not a raw constraint 500.
  const district = await db.district.findUnique({ where: { leaid }, select: { leaid: true } });
  if (!district) {
    throw new ServiceError("District not found", 404);
  }

  const note = await db.districtNote.create({
    data: {
      districtLeaid: leaid,
      authorId: userId,
      bodyJson: input.bodyJson as Prisma.InputJsonValue,
      bodyText,
      noteType,
    },
    include: { author: { select: AUTHOR_SELECT } },
  });
  return serialize(note);
}

export async function updateDistrictNote(
  leaid: string,
  noteId: string,
  input: DistrictNoteInput,
  userId: string,
  isAdmin: () => Promise<boolean>,
  db: DbClient = prisma,
) {
  const existing = await db.districtNote.findUnique({ where: { id: noteId } });
  if (!existing || existing.districtLeaid !== leaid) {
    throw new ServiceError("Note not found", 404);
  }
  if (existing.authorId !== userId && !(await isAdmin())) {
    throw new ServiceError("Not authorized", 403);
  }

  const bodyText = validateBody(input);
  if (input.noteType !== undefined && !isNoteType(input.noteType)) {
    throw new ServiceError("Invalid noteType", 400);
  }

  const note = await db.districtNote.update({
    where: { id: noteId },
    data: {
      bodyJson: input.bodyJson as Prisma.InputJsonValue,
      bodyText,
      ...(input.noteType !== undefined ? { noteType: input.noteType } : {}),
    },
    include: { author: { select: AUTHOR_SELECT } },
  });
  return serialize(note);
}
