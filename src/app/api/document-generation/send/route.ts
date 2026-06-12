// POST /api/document-generation/send — render the contract with eSign tags + send
// via Dropbox Sign (mechanism A), then persist a GeneratedDocument row.
// Body: { payload: DocPayload, districtLeaId?: string }.
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { sendForSignature } from "@/features/document-generation/lib/render-apps-script";
import { getDropboxSignTestMode } from "@/features/shared/lib/app-settings";
import type { DocPayload } from "@/features/document-generation/lib/payload-types";
import { promotedFields } from "@/features/document-generation/lib/persist";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { payload?: DocPayload; districtLeaId?: string };
    const payload = body.payload;
    if (!payload || !payload.doc_type) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }
    // Contract-only: BOCES quotes are not sent for signature.
    if (payload.doc_type !== "contract") {
      return NextResponse.json({ error: "Only contracts can be sent for signature" }, { status: 400 });
    }

    const deal = payload.deal;
    const recipientEmail = deal.signer_email || deal.client_email || "";
    const companyName = deal.client_company || "";

    const testMode = await getDropboxSignTestMode();
    const result = await sendForSignature(payload, { testMode });
    const promoted = promotedFields(payload);

    // NOTE: if this write fails after a successful send, the signature request is already
    // in-flight at Dropbox Sign with no local record. A retry will create a duplicate
    // signature request. Acceptable for v1 (test-mode); wire idempotency before prod.
    const row = await prisma.generatedDocument.create({
      data: {
        docType: payload.doc_type,
        docUrl: result.docUrl,
        docId: result.docId ?? "",
        signatureRequestId: result.sent ? (result.signatureRequestId ?? null) : null,
        recipientEmail,
        companyName,
        status: result.sent ? "processing" : "error",
        errorMessage: result.sent ? null : (result.sendError ?? "send failed"),
        districtLeaId: body.districtLeaId ?? null,
        ownerProfileId: user.id,
        sentAt: result.sent ? new Date() : null,
        payload: payload as unknown as Prisma.InputJsonValue,
        ...promoted,
      },
    });

    return NextResponse.json({
      id: row.id,
      docUrl: result.docUrl,
      status: result.sent ? "processing" : "error",
      signatureRequestId: result.signatureRequestId ?? null,
      sendError: result.sent ? undefined : (result.sendError ?? "send failed"),
      recipientEmail,
    });
  } catch (error) {
    console.error("Document send error:", error);
    return NextResponse.json({ error: "Failed to send document" }, { status: 500 });
  }
}
