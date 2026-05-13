/**
 * /views/plans/[planId]/[viewId] — renders the GroupCanvas for a Plan.
 *
 * If the URL's viewId segment isn't a recognized view, redirects to the
 * default view rather than 404ing — accommodates typos and stale links.
 *
 * Phase B3 mounts a stub canvas; Phase C replaces with the full
 * GroupHeader + ViewTabsStrip + view-body composition.
 */
import { redirect, notFound } from "next/navigation";
import GroupCanvasStub from "@/features/views/components/__stubs__/GroupCanvasStub";
import {
  DEFAULT_VIEW_ID,
  isViewId,
} from "@/features/views/lib/view-types";

interface PageProps {
  params: Promise<{ planId: string; viewId: string }>;
}

export default async function PlanViewPage({ params }: PageProps) {
  const { planId, viewId } = await params;
  if (!planId) {
    notFound();
  }
  if (!isViewId(viewId)) {
    redirect(`/views/plans/${encodeURIComponent(planId)}/${DEFAULT_VIEW_ID}`);
  }
  return <GroupCanvasStub kind="plan" groupId={planId} viewId={viewId} />;
}
