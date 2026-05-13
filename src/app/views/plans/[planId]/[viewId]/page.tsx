/**
 * /views/plans/[planId]/[viewId] — renders the GroupCanvas for a Plan.
 *
 * If the URL's viewId segment isn't a recognized view, redirects to the
 * default view rather than 404ing — accommodates typos and stale links.
 *
 * Phase C wires the real GroupCanvas (header + tabs strip + view bodies).
 */
import { redirect, notFound } from "next/navigation";
import GroupCanvas from "@/features/views/components/GroupCanvas";
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
  return <GroupCanvas kind="plan" groupId={planId} viewId={viewId} />;
}
