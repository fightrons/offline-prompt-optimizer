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

// ─── Anthropic token counting (real API — free, no message charged) ───

export async function countAnthropicTokens(text, apiKey) {
  if (!text.trim() || !apiKey) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages/count_tokens', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        messages: [{ role: 'user', content: text }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.input_tokens ?? null;
  } catch {
    return null;
  }
}

// GPT-4o-mini pricing: $0.15 per 1M input tokens, $0.60 per 1M output tokens
const COST_PER_INPUT_TOKEN = 0.15 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 0.60 / 1_000_000;

export function estimateCost(inputTokens, outputTokens) {
  return inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;
}
