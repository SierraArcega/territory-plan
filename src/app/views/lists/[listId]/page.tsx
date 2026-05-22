/**
 * /views/lists/[listId] — redirects to the list's default view.
 */
import { redirect } from "next/navigation";
import { DEFAULT_VIEW_ID } from "@/features/views/lib/view-types";
import { LISTS_ENABLED } from "@/features/views/lib/feature-flags";

interface PageProps {
  params: Promise<{ listId: string }>;
}

export default async function ListIndexPage({ params }: PageProps) {
  // Lists ships gated; bounce direct navigation back to the plans portfolio.
  if (!LISTS_ENABLED) redirect("/views");
  const { listId } = await params;
  redirect(`/views/lists/${encodeURIComponent(listId)}/${DEFAULT_VIEW_ID}`);
}
