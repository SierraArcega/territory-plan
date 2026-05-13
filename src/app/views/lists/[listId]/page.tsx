/**
 * /views/lists/[listId] — redirects to the list's default view.
 */
import { redirect } from "next/navigation";
import { DEFAULT_VIEW_ID } from "@/features/views/lib/view-types";

interface PageProps {
  params: Promise<{ listId: string }>;
}

export default async function ListIndexPage({ params }: PageProps) {
  const { listId } = await params;
  redirect(`/views/lists/${encodeURIComponent(listId)}/${DEFAULT_VIEW_ID}`);
}
