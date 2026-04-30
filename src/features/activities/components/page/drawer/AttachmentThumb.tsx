"use client";

import { useActivityAttachmentUrl } from "@/features/activities/lib/queries";

export default function AttachmentThumb({
  activityId,
  attachmentId,
  alt,
  className,
}: {
  activityId: string;
  attachmentId: string;
  alt: string;
  className?: string;
}) {
  const { data: url, isLoading } = useActivityAttachmentUrl(activityId, attachmentId);
  if (isLoading || !url) {
    return <div className={`bg-[#F0EDF7] ${className ?? ""}`} aria-label="Loading thumbnail" />;
  }
  // Signed Supabase Storage URLs rotate hourly, which doesn't fit next/image's
  // long-cached optimisation pipeline. Intentional plain <img> is fine here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

export function useSignedHref(activityId: string, attachmentId: string) {
  return useActivityAttachmentUrl(activityId, attachmentId);
}
