import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";
import { getActivityAttachmentSignedUrl } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

// GET /api/activities/[id]/attachments/[attachmentId]/url
// Returns a short-lived signed URL for the blob.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attachment = await prisma.activityAttachment.findUnique({
    where: { id: attachmentId },
    include: { activity: { select: { createdByUserId: true } } },
  });
  if (!attachment || attachment.activityId !== id) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  if (
    attachment.activity.createdByUserId &&
    attachment.activity.createdByUserId !== user.id
  ) {
    const linkedToPlan = await prisma.activityPlan.findFirst({
      where: { activityId: id },
      select: { planId: true },
    });
    if (!linkedToPlan && !(await isAdmin(user.id))) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  try {
    const url = await getActivityAttachmentSignedUrl(attachment.storagePath);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("signed url failed", err);
    return NextResponse.json({ error: "url_failed" }, { status: 500 });
  }
}
