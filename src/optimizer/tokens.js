// ─── Token estimation (tiktoken — model-accurate, lazy-loaded) ───

let enc = null;

export async function getEncoder() {
  if (!enc) {
    const { encodingForModel } = await import('js-tiktoken');
    enc = encodingForModel('gpt-4o-mini');
  }
  return enc;
}

export function estimateTokens(text) {
  if (!text.trim()) return 0;
  if (enc) return enc.encode(text).length;
  // Fallback until encoder loads — heuristic
  return Math.ceil(text.trim().split(/\s+/).length * 1.3);
}

// GPT-4o-mini pricing: $0.15 per 1M input tokens, $0.60 per 1M output tokens
const COST_PER_INPUT_TOKEN = 0.15 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 0.60 / 1_000_000;

export function estimateCost(inputTokens, outputTokens) {
  return inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;
}
