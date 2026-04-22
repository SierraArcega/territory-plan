const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const HAIKU_MODEL = "claude-haiku-4-5-20251001";
export const SONNET_MODEL = "claude-sonnet-4-6";

export interface ClaudeTextBlock {
  type: "text";
  text: string;
}

export interface ClaudeToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ClaudeContentBlock = ClaudeTextBlock | ClaudeToolUseBlock;

export interface ClaudeToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ClaudeToolChoice =
  | { type: "auto" }
  | { type: "any" }
  | { type: "tool"; name: string };

export interface CallClaudeOptions {
  model: string;
  systemPrompt?: string;
  userMessage: string;
  tools?: ClaudeToolDef[];
  toolChoice?: ClaudeToolChoice;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface ClaudeApiResponse {
  content: ClaudeContentBlock[];
  stop_reason: string;
}

export class AnthropicError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = "AnthropicError";
  }
}

export async function callClaude(
  opts: CallClaudeOptions
): Promise<ClaudeContentBlock[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for callClaude()"
    );
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    messages: [{ role: "user", content: opts.userMessage }],
  };
  if (opts.systemPrompt) body.system = opts.systemPrompt;
  if (opts.tools && opts.tools.length > 0) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new AnthropicError(
      `Anthropic API error: ${res.status} ${res.statusText}`,
      res.status,
      errorBody
    );
  }

  const response = (await res.json()) as ClaudeApiResponse;
  return response.content;
}

export function findToolUse(
  content: ClaudeContentBlock[],
  toolName: string
): ClaudeToolUseBlock | undefined {
  return content.find(
    (block): block is ClaudeToolUseBlock =>
      block.type === "tool_use" && block.name === toolName
  );
}
