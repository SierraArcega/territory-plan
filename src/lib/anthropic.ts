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
  /** Max retry attempts on 429 / 5xx. Default 5. Non-retriable status codes throw immediately. */
  maxRetries?: number;
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

  const maxRetries = opts.maxRetries ?? 5;
  let lastError: AnthropicError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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

    if (res.ok) {
      const response = (await res.json()) as ClaudeApiResponse;
      return response.content;
    }

    const errorBody = await res.text().catch(() => "");
    lastError = new AnthropicError(
      `Anthropic API error: ${res.status} ${res.statusText}`,
      res.status,
      errorBody
    );

    // Retry on 429 (rate limit) or 5xx (server-side). Other 4xx are terminal.
    const retriable = res.status === 429 || (res.status >= 500 && res.status < 600);
    if (!retriable || attempt === maxRetries) break;

    // Prefer Retry-After header when present; else exponential backoff with jitter.
    const retryAfterHeader = res.headers.get("retry-after");
    let delayMs: number;
    if (retryAfterHeader) {
      const asInt = parseInt(retryAfterHeader, 10);
      delayMs = Number.isFinite(asInt) ? asInt * 1000 : 1000;
    } else {
      // Base 500ms * 2^attempt, capped at 30s, + up to 500ms jitter
      delayMs = Math.min(500 * Math.pow(2, attempt), 30_000) + Math.floor(Math.random() * 500);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }

  throw lastError ?? new AnthropicError("Unknown Anthropic error", 0, "");
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
