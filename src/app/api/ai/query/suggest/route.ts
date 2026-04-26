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

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface SuggestRequestBody {
  question: string;
  currentParams?: QueryParams;
  chatHistory?: ChatTurn[];
  conversationId?: string;
}

type SuggestResponse =
  | { kind: "params"; params: QueryParams; explanation: string }
  | { kind: "clarify"; question: string };

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

  const finalUserContent = body.currentParams
    ? `${body.question}\n\n<CURRENT_BUILDER>\n${JSON.stringify(body.currentParams, null, 2)}\n</CURRENT_BUILDER>`
    : body.question;

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...(body.chatHistory ?? []),
    { role: "user", content: finalUserContent },
  ];

  const startedAt = Date.now();
  let response: Anthropic.Message;
  try {
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
      tool_choice: { type: "auto" },
      messages,
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
  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text",
  );

  const executionTimeMs = Date.now() - startedAt;

  if (!toolUse) {
    const clarify = textBlock?.text?.trim() ||
      "I'm not sure what to build — could you rephrase?";
    void prisma.queryLog
      .create({
        data: {
          userId: user.id,
          conversationId: body.conversationId ?? undefined,
          question: `[clarify] ${body.question}`,
          executionTimeMs,
        },
      })
      .catch(() => undefined);
    const payload: SuggestResponse = { kind: "clarify", question: clarify };
    return NextResponse.json(payload);
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

  const payload: SuggestResponse = {
    kind: "params",
    params: validation.normalized,
    explanation: explanation ?? "",
  };
  return NextResponse.json(payload);
}
