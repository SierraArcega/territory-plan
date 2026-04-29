import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";
import {
  uploadActivityAttachment,
} from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB, matches storage bucket file_size_limit
const PHOTO_MIMES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/heic"]);

async function assertCanReadActivity(activityId: string, userId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, createdByUserId: true },
  });
  if (!activity) return { error: "not_found" as const };
  if (activity.createdByUserId && activity.createdByUserId !== userId) {
    const linkedToPlan = await prisma.activityPlan.findFirst({
      where: { activityId },
      select: { planId: true },
    });
    if (!linkedToPlan && !(await isAdmin(userId))) return { error: "forbidden" as const };
  }
  return { activity };
}

// GET /api/activities/[id]/attachments — list attachment metadata
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await assertCanReadActivity(id, user.id);
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "not_found" ? 404 : 403 }
    );
  }

  const attachments = await prisma.activityAttachment.findMany({
    where: { activityId: id },
    orderBy: { uploadedAt: "desc" },
    include: {
      uploader: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    attachments: attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      sizeBytes: a.sizeBytes,
      mime: a.mime,
      uploadedAt: a.uploadedAt.toISOString(),
      uploader: {
        id: a.uploader.id,
        fullName: a.uploader.fullName,
        email: a.uploader.email,
        avatarUrl: a.uploader.avatarUrl,
      },
    })),
  });
}

// POST /api/activities/[id]/attachments — multipart upload
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await assertCanReadActivity(id, user.id);
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error },
      { status: access.error === "not_found" ? 404 : 403 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 25MB)" }, { status: 413 });
  }

  const kind = PHOTO_MIMES.has(file.type) ? "photo" : "file";

  let storagePath: string;
  try {
    ({ storagePath } = await uploadActivityAttachment({ activityId: id, file }));
  } catch (err) {
    console.error("attachment upload failed", err);
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  const attachment = await prisma.activityAttachment.create({
    data: {
      activityId: id,
      kind,
      name: file.name,
      sizeBytes: file.size,
      mime: file.type || "application/octet-stream",
      storagePath,
      uploadedById: user.id,
    },
    include: {
      uploader: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    id: attachment.id,
    kind: attachment.kind,
    name: attachment.name,
    sizeBytes: attachment.sizeBytes,
    mime: attachment.mime,
    uploadedAt: attachment.uploadedAt.toISOString(),
    uploader: {
      id: attachment.uploader.id,
      fullName: attachment.uploader.fullName,
      email: attachment.uploader.email,
      avatarUrl: attachment.uploader.avatarUrl,
    },
  });
}
