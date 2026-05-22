/**
 * /views/plans/[planId] — redirects to the plan's default view.
 *
 * The default view is `map` for v1; future iterations may persist a per-user
 * "last view" preference and redirect there instead.
 *
 * Using Next.js's `redirect` keeps the response server-side — no client
 * flicker, no double-render of any layout below.
 */
import { redirect } from "next/navigation";
import { DEFAULT_VIEW_ID } from "@/features/views/lib/view-types";

interface PageProps {
  params: Promise<{ planId: string }>;
}

export default async function PlanIndexPage({ params }: PageProps) {
  const { planId } = await params;
  redirect(`/views/plans/${encodeURIComponent(planId)}/${DEFAULT_VIEW_ID}`);
}
