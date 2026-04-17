import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { fetchLeaderboardData, NoActiveInitiativeError } from "@/features/leaderboard/lib/fetch-leaderboard";
import { LeaderboardImageLayout } from "@/features/leaderboard/lib/image-layout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FONTS_DIR = join(process.cwd(), "src/features/leaderboard/lib/fonts");

// Cache fonts as module-level promises so they're loaded once per warm instance.
const fontRegular = readFile(join(FONTS_DIR, "PlusJakartaSans-Regular.ttf"));
const fontSemiBold = readFile(join(FONTS_DIR, "PlusJakartaSans-SemiBold.ttf"));

function checkBearer(request: NextRequest): { ok: true } | { ok: false; status: number; body: string } {
  const expected = process.env.LEADERBOARD_IMAGE_SECRET;
  if (!expected) return { ok: false, status: 500, body: "LEADERBOARD_IMAGE_SECRET not configured" };

  const header = request.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m) return { ok: false, status: 401, body: "Unauthorized" };

  const provided = Buffer.from(m[1]);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length) return { ok: false, status: 401, body: "Unauthorized" };
  if (!timingSafeEqual(provided, expectedBuf)) return { ok: false, status: 401, body: "Unauthorized" };
  return { ok: true };
}

export async function GET(request: NextRequest) {
  const auth = checkBearer(request);
  if (!auth.ok) {
    return new Response(auth.body, { status: auth.status, headers: { "Content-Type": "text/plain" } });
  }

  const [regular, semiBold] = await Promise.all([fontRegular, fontSemiBold]);

  try {
    const raw = await fetchLeaderboardData();
    const payload = { ...raw, entries: raw.entries.filter((e) => e.revenueCurrentFY > 0) };
    // next/og defaults height to 630 when omitted, clipping the table.
    // Compute height: header band ~150 + column headers 46 + rows × 44 + footer 50 + buffer.
    const height = 150 + 46 + payload.entries.length * 44 + 50 + 20;
    return new ImageResponse(<LeaderboardImageLayout payload={payload} />, {
      width: 1200,
      height,
      headers: { "Cache-Control": "no-store" },
      fonts: [
        { name: "Plus Jakarta Sans", data: regular,  weight: 400, style: "normal" },
        { name: "Plus Jakarta Sans", data: semiBold, weight: 600, style: "normal" },
      ],
    });
  } catch (error) {
    console.error("leaderboard-image: render failed", error);
    const reason = error instanceof NoActiveInitiativeError
      ? "No active initiative"
      : "Leaderboard unavailable — check logs";
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200, height: 200, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            backgroundColor: "#FFFCFA", color: "#403770",
            fontSize: 24, fontFamily: "Plus Jakarta Sans",
          }}
        >
          <div>Fullmind Sales Leaderboard</div>
          <div style={{ marginTop: 12, fontSize: 18, color: "#6E6390" }}>{reason}</div>
        </div>
      ),
      {
        width: 1200,
        headers: { "Cache-Control": "no-store" },
        fonts: [{ name: "Plus Jakarta Sans", data: regular, weight: 400, style: "normal" }],
      },
    );
  }
}
