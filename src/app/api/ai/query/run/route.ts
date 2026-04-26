import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { executeQuery } from "@/features/reports/lib/execute-query";
import type { QueryParams } from "@/features/reports/lib/types";

export const dynamic = "force-dynamic";

interface RunRequestBody {
  params: QueryParams;
  conversationId?: string;
  /** Optional label persisted to query_log for context. */
  question?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RunRequestBody;
  try {
    body = (await request.json()) as RunRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.params || typeof body.params !== "object") {
    return NextResponse.json(
      { error: "Missing 'params' object in request body" },
      { status: 400 },
    );
  }

  const outcome = await executeQuery({
    params: body.params,
    userId: user.id,
    question: body.question,
    conversationId: body.conversationId,
  });

  switch (outcome.kind) {
    case "ok":
      return NextResponse.json(outcome.result);
    case "invalid_params":
      return NextResponse.json(
        { error: "Invalid params", details: outcome.errors },
        { status: 400 },
      );
    case "error":
      return NextResponse.json(
        { error: outcome.message, details: outcome.details },
        { status: outcome.status },
      );
  }
}
