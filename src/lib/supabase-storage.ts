import { createClient as createServerSupabase } from "@/lib/supabase/server";

export const ACTIVITY_ATTACHMENTS_BUCKET = "activity-attachments";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function buildStoragePath(activityId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${activityId}/${Date.now()}-${safeName}`;
}

export async function uploadActivityAttachment(args: {
  activityId: string;
  file: { arrayBuffer: () => Promise<ArrayBuffer>; type: string; name: string };
}): Promise<{ storagePath: string }> {
  const supabase = await createServerSupabase();
  const storagePath = buildStoragePath(args.activityId, args.file.name);
  const buffer = Buffer.from(await args.file.arrayBuffer());

  const { error } = await supabase.storage
    .from(ACTIVITY_ATTACHMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: args.file.type,
      upsert: false,
    });

  if (error) throw error;
  return { storagePath };
}

export async function getActivityAttachmentSignedUrl(
  storagePath: string
): Promise<string> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.storage
    .from(ACTIVITY_ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  if (error || !data) throw error ?? new Error("signed_url_failed");
  return data.signedUrl;
}

export async function deleteActivityAttachment(
  storagePath: string
): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.storage
    .from(ACTIVITY_ATTACHMENTS_BUCKET)
    .remove([storagePath]);
  if (error) throw error;
}
