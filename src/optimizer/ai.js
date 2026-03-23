import { estimateTokens, estimateCost } from './tokens.js';

const SYSTEM_PROMPT = `You are an expert prompt engineer. Rewrite the user's prompt to be maximally effective and token-efficient.

Rules:
1. Output must use this structure (omit empty sections):
   Role: ...
   Task: ...
   Constraints:
   - ...
   Key points:
   - ...
   Output requirements:
   - ...
2. Make every instruction direct and imperative
3. Remove ALL conversational language
4. Every token must earn its place
5. Preserve original intent completely
6. Infer the Role from the topic domain, not just the verb. "Write a guide about CI/CD" needs a DevOps engineer, not a content writer. Match the role to the subject matter expertise required.

Return ONLY the optimized prompt. No explanations.`;

export async function optimizeWithAI(prompt, apiKey) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `API error: ${res.status}`);
  }

  const data = await res.json();
  const optimized = data.choices[0].message.content.trim();

  const inputTokens = data.usage?.prompt_tokens || estimateTokens(SYSTEM_PROMPT + prompt);
  const outputTokens = data.usage?.completion_tokens || estimateTokens(optimized);
  const optimizationCost = estimateCost(inputTokens, outputTokens);

  return { optimized, optimizationCost, inputTokens, outputTokens };
}
