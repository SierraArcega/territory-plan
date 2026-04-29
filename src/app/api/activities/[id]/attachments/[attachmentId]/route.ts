import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";
import { deleteActivityAttachment } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

// DELETE /api/activities/[id]/attachments/[attachmentId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id, attachmentId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const attachment = await prisma.activityAttachment.findUnique({
    where: { id: attachmentId },
  });
  if (!attachment || attachment.activityId !== id) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }
  if (attachment.uploadedById !== user.id && !(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    await deleteActivityAttachment(attachment.storagePath);
  } catch (err) {
    console.error("attachment storage delete failed", err);
    // continue — orphaned blob is preferable to a stuck row
  }

  await prisma.activityAttachment.delete({ where: { id: attachmentId } });
  return NextResponse.json({ success: true });
}
