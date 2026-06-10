import "server-only";
import { Readable } from "node:stream";
import { google } from "googleapis";
import { buildJwt } from "./render-apps-script";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/** Uploads an executed-contract PDF into the Executed Drive folder.
 *  Auth reuses the doc-gen service account (DWD grant already includes drive). */
export async function uploadExecutedPdf(pdf: Buffer, filename: string): Promise<{ fileId: string; url: string }> {
  const folderId = requireEnv("GOOGLE_DOC_EXECUTED_FOLDER_ID");
  const drive = google.drive({ version: "v3", auth: buildJwt() });
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: "application/pdf", body: Readable.from(pdf) },
    fields: "id, webViewLink",
  });
  if (!res.data.id) throw new Error("Drive upload returned no file id");
  return { fileId: res.data.id, url: res.data.webViewLink ?? `https://drive.google.com/file/d/${res.data.id}/view` };
}
