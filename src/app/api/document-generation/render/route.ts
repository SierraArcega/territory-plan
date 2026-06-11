// POST /api/document-generation/render — render a document via the deployed Apps Script.
// Body: { payload: DocPayload, tags: boolean, districtLeaId?: string }. Returns { docUrl, agreementUrl? }.
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { renderViaAppsScript } from "@/features/document-generation/lib/render-apps-script";
import { upsertBocesRender } from "@/features/document-generation/lib/persist";
import { docIdFromUrl } from "@/features/document-generation/lib/ids";
import type { DocPayload } from "@/features/document-generation/lib/payload-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { payload?: DocPayload; tags?: boolean; districtLeaId?: string };
    if (!body.payload || !body.payload.doc_type) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    // Default to tags:true (eSign-ready) when absent, matching the Apps Script default.
    const result = await renderViaAppsScript(body.payload, body.tags !== false);

    if (body.payload.doc_type === "boces_quote") {
      try {
        const docId = docIdFromUrl(result.docUrl) ?? "";
        await upsertBocesRender({
          payload: body.payload,
          docUrl: result.docUrl,
          docId,
          districtLeaId: body.districtLeaId ?? null,
          ownerProfileId: user.id,
        });
      } catch (persistError) {
        console.error("BOCES render persist error:", persistError); // never break the render response
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Document render error:", error);
    return NextResponse.json({ error: "Failed to render document" }, { status: 500 });
  }
}
