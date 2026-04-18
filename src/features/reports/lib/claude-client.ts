import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

/** Lazy-init the Anthropic client so imports don't throw during build/test. */
export function getAnthropic(): Anthropic {
  if (!cached) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Add it to .env.local (and Vercel env for prod).",
      );
    }
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return cached;
}
