/**
 * /views/lists/[listId]/[viewId] — renders the GroupCanvas for a saved List.
 *
 * Mirrors plans/[planId]/[viewId]/page.tsx: redirects to default view on
 * unknown viewId, 404s on missing listId, stubs the canvas until Phase C.
 */
import { redirect, notFound } from "next/navigation";
import GroupCanvasStub from "@/features/views/components/__stubs__/GroupCanvasStub";
import {
  DEFAULT_VIEW_ID,
  isViewId,
} from "@/features/views/lib/view-types";

interface PageProps {
  params: Promise<{ listId: string; viewId: string }>;
}

export default async function ListViewPage({ params }: PageProps) {
  const { listId, viewId } = await params;
  if (!listId) {
    notFound();
  }
  if (!isViewId(viewId)) {
    redirect(`/views/lists/${encodeURIComponent(listId)}/${DEFAULT_VIEW_ID}`);
  }
  return <GroupCanvasStub kind="list" groupId={listId} viewId={viewId} />;
}
