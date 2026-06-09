// POST /api/document-generation/render — render a document via the deployed Apps Script.
// Body: { payload: DocPayload, tags: boolean }. Returns { docUrl, agreementUrl? }.
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { renderViaAppsScript } from "@/features/document-generation/lib/render-apps-script";
import type { DocPayload } from "@/features/document-generation/lib/payload-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { payload?: DocPayload; tags?: boolean };
    if (!body.payload || !body.payload.doc_type) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const result = await renderViaAppsScript(body.payload, body.tags === true);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Document render error:", error);
    return NextResponse.json({ error: "Failed to render document" }, { status: 500 });
  }
}
