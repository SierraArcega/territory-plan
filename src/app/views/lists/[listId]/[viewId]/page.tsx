/**
 * /views/lists/[listId]/[viewId] — renders the GroupCanvas for a saved List.
 *
 * Mirrors plans/[planId]/[viewId]/page.tsx: redirects to default view on
 * unknown viewId, 404s on missing listId. Phase C wires the real GroupCanvas
 * (header + tabs strip + view bodies).
 */
import { redirect, notFound } from "next/navigation";
import GroupCanvas from "@/features/views/components/GroupCanvas";
import {
  DEFAULT_VIEW_ID,
  isViewId,
} from "@/features/views/lib/view-types";
import { LISTS_ENABLED } from "@/features/views/lib/feature-flags";

interface PageProps {
  params: Promise<{ listId: string; viewId: string }>;
}

export default async function ListViewPage({ params }: PageProps) {
  // Lists ships gated; bounce direct navigation back to the plans portfolio.
  if (!LISTS_ENABLED) redirect("/views");
  const { listId, viewId } = await params;
  if (!listId) {
    notFound();
  }
  if (!isViewId(viewId)) {
    redirect(`/views/lists/${encodeURIComponent(listId)}/${DEFAULT_VIEW_ID}`);
  }
  return <GroupCanvas kind="list" groupId={listId} viewId={viewId} />;
}
