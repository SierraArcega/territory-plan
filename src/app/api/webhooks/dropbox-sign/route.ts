// POST /api/webhooks/dropbox-sign — Dropbox Sign event callback.
// Dropbox Sign POSTs multipart/form-data with a single field "json".
// Verify HMAC, map event_type → status, update the GeneratedDocument by
// signature_request_id. Always reply 200 "Hello API Event Received" for valid
// events (incl. callback_test / unknown ids); 400 on bad HMAC.
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyEventHash } from "@/features/document-generation/lib/dropbox-sign-verify";
import { mapEventToStatus } from "@/features/document-generation/lib/signature-status";
import { fetchExecutedPdf } from "@/features/document-generation/lib/dropbox-files";
import { uploadExecutedPdf } from "@/features/document-generation/lib/drive-archive";
import { buildExecutedPdfName } from "@/features/document-generation/lib/naming";

export const dynamic = "force-dynamic";

const ACK = "Hello API Event Received";

// Terminal statuses never transition backward; guard against out-of-order webhook delivery.
const TERMINAL_STATUSES = ["signed", "declined", "canceled"] as const;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const jsonStr = form.get("json");
    if (typeof jsonStr !== "string") {
      return NextResponse.json({ error: "Missing json field" }, { status: 400 });
    }
    let parsed: {
      event?: { event_time?: string; event_type?: string; event_hash?: string };
      signature_request?: { signature_request_id?: string };
    };
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: "Unparseable json field" }, { status: 400 });
    }
    const ev = parsed.event;
    if (!ev?.event_time || !ev?.event_type || !ev?.event_hash) {
      return NextResponse.json({ error: "Malformed event" }, { status: 400 });
    }

    const apiKey = process.env.DROPBOX_SIGN_API_KEY ?? "";
    if (!verifyEventHash(apiKey, ev.event_time, ev.event_type, ev.event_hash)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const status = mapEventToStatus(ev.event_type);
    const sigId = parsed.signature_request?.signature_request_id;
    if (status && sigId) {
      await prisma.generatedDocument.updateMany({
        where: { signatureRequestId: sigId, status: { notIn: [...TERMINAL_STATUSES] } },
        data: {
          status,
          ...(status === "signed" ? { signedAt: new Date() } : {}),
          ...(status === "error" ? { errorMessage: ev.event_type } : {}),
        },
      });
      console.log(`Dropbox Sign event: ${ev.event_type} → ${status} for ${sigId}`);
      // updateMany with count 0 (unknown id) is fine — idempotent ack.

      // Archive the executed PDF on signed events. Strictly best-effort: any failure
      // logs and leaves the columns null — Dropbox Sign must always get the ack.
      // signed + all_signed both map here and can arrive concurrently: both can pass the
      // findUnique guard and double-upload; the second row update overwrites — DB stays
      // correct, the spare Drive file is harmless at current volume. Likewise the archive
      // is awaited before the ack (adds seconds; Dropbox Sign retries slow acks and the
      // guard absorbs the retry) — switch to next/server after() if volume ever makes
      // retries noisy.
      if (status === "signed") {
        try {
          const row = await prisma.generatedDocument.findUnique({
            where: { signatureRequestId: sigId },
            select: {
              id: true, companyName: true, schoolYear: true,
              orderTotal: true, payload: true, executedPdfFileId: true,
            },
          });
          if (row && !row.executedPdfFileId) {
            const pdf = await fetchExecutedPdf(sigId);
            if (pdf) {
              const name = buildExecutedPdfName({
                companyName: row.companyName,
                schoolYear: row.schoolYear,
                signatureRequestId: sigId,
                date: new Date(),
              });
              const uploaded = await uploadExecutedPdf(pdf, name);
              await prisma.generatedDocument.update({
                where: { id: row.id },
                data: { executedPdfUrl: uploaded.url, executedPdfFileId: uploaded.fileId },
              });
            }
          }
        } catch (archiveError) {
          console.error("Executed-PDF archive error:", archiveError);
        }
      }
    }

    // Dropbox Sign requires a plain-text body containing this exact string to ack.
    return new NextResponse(ACK, { status: 200 });
  } catch (error) {
    console.error("Dropbox Sign webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
