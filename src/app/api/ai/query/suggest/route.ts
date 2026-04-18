import type Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAnthropic } from "@/features/reports/lib/claude-client";
import { buildSchemaPrompt } from "@/features/reports/lib/schema-prompt";
import { runQueryTool } from "@/features/reports/lib/run-query-tool";
import { validateParams } from "@/features/reports/lib/params-validator";
import type { QueryParams } from "@/features/reports/lib/types";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SuggestRequestBody {
  question: string;
  conversationId?: string;
}

interface SuggestResponse {
  params: QueryParams;
  explanation: string;
}

// Prompt is stable except for the current-date anchor — cache keyed by
// YYYY-MM-DD so a long-running process picks up date rollover at midnight UTC.
let cachedPrompt: { date: string; text: string } | null = null;
function schemaPrompt(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  if (!cachedPrompt || cachedPrompt.date !== date) {
    cachedPrompt = { date, text: buildSchemaPrompt(now) };
  }
  return cachedPrompt.text;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SuggestRequestBody;
  try {
    body = (await request.json()) as SuggestRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.question || typeof body.question !== "string") {
    return NextResponse.json(
      { error: "Missing 'question' string in request body" },
      { status: 400 },
    );
  }

  let anthropic: Anthropic;
  try {
    anthropic = getAnthropic();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Anthropic client unavailable" },
      { status: 500 },
    );
  }

  const startedAt = Date.now();
  let response: Anthropic.Message;
  try {
    // NOTE: forced `tool_choice` is incompatible with adaptive thinking on
    // Opus 4.7 (API: "Thinking may not be enabled when tool_choice forces
    // tool use"). Thinking is intentionally omitted — NL→structured params
    // is a deterministic mapping, so reasoning adds cost without benefit.
    response = await anthropic.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: schemaPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [runQueryTool],
      tool_choice: { type: "tool", name: "run_query" },
      messages: [{ role: "user", content: body.question }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Claude request failed", details: message },
      { status: 502 },
    );
  }

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "run_query",
  );
  if (!toolUse) {
    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    return NextResponse.json(
      {
        error: "Claude did not produce query params",
        explanation: textBlock?.text,
      },
      { status: 422 },
    );
  }

  const { explanation, ...rawParams } = toolUse.input as QueryParams & {
    explanation?: string;
  };
  const validation = validateParams(rawParams);
  if (!validation.valid) {
    return NextResponse.json(
      {
        error: "Claude produced invalid params",
        details: validation.errors,
        rawParams,
        explanation,
      },
      { status: 422 },
    );
  }

  const executionTimeMs = Date.now() - startedAt;

  void prisma.queryLog
    .create({
      data: {
        userId: user.id,
        conversationId: body.conversationId ?? undefined,
        question: body.question,
        params: validation.normalized as unknown as object,
        executionTimeMs,
      },
    })
    .catch(() => undefined);

  const result: SuggestResponse = {
    params: validation.normalized,
    explanation: explanation ?? "",
  };
  return NextResponse.json(result);
}
