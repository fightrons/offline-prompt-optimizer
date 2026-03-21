// Hybrid prompt optimizer
// Step 1: Local analysis (FREE) — rule-based cleanup + structural suggestions
// Step 2: Optional AI deep optimize (LLM) — real semantic transformation

// ─── Token estimation ───

export function estimateTokens(text) {
  if (!text.trim()) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

// GPT-4o-mini pricing: $0.15 per 1M input tokens, $0.60 per 1M output tokens
const COST_PER_INPUT_TOKEN = 0.15 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 0.60 / 1_000_000;

export function estimateCost(inputTokens, outputTokens) {
  return inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;
}

// ─── Filler & verbose phrase rules ───

const FILLER_PHRASES = [
  /\b(please|kindly|if you could|if you would|would you mind|i would like you to|i want you to|i need you to|i'd like you to)\b/gi,
  /\b(maybe|perhaps|possibly|I think|I believe|I feel like|it seems like|sort of|kind of|just|really|very|actually|basically|essentially|literally|honestly|frankly)\b/gi,
  /\b(as an ai|as a language model|you are an ai|you are a language model)\b/gi,
  /^(can you|could you|will you|would you)\s+/gim,
];

const PHRASE_REPLACEMENTS = [
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bfor the purpose of\b/gi, 'to'],
  [/\bin the event that\b/gi, 'if'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bat the present time\b/gi, 'now'],
  [/\bin the near future\b/gi, 'soon'],
  [/\bprior to\b/gi, 'before'],
  [/\bsubsequent to\b/gi, 'after'],
  [/\bin spite of the fact that\b/gi, 'although'],
  [/\bwith regard to\b/gi, 'about'],
  [/\bwith respect to\b/gi, 'about'],
  [/\bin regard to\b/gi, 'about'],
  [/\bin relation to\b/gi, 'about'],
  [/\bpertaining to\b/gi, 'about'],
  [/\bon the other hand\b/gi, 'however'],
  [/\bin addition to\b/gi, 'besides'],
  [/\bas a result of\b/gi, 'because of'],
  [/\bby means of\b/gi, 'by'],
  [/\bin the process of\b/gi, 'while'],
  [/\bit is important to note that\b/gi, ''],
  [/\bit should be noted that\b/gi, ''],
  [/\bit is worth mentioning that\b/gi, ''],
  [/\bneedless to say\b/gi, ''],
  [/\bas a matter of fact\b/gi, ''],
  [/\bthe fact that\b/gi, 'that'],
  [/\bin light of\b/gi, 'given'],
  [/\ba large number of\b/gi, 'many'],
  [/\ba significant number of\b/gi, 'many'],
  [/\bthe majority of\b/gi, 'most'],
  [/\bin the case of\b/gi, 'for'],
  [/\bis able to\b/gi, 'can'],
  [/\bhas the ability to\b/gi, 'can'],
  [/\bmake sure that\b/gi, 'ensure'],
  [/\bmake sure to\b/gi, 'ensure you'],
  [/\btake into consideration\b/gi, 'consider'],
  [/\btake into account\b/gi, 'consider'],
  [/\bgive an explanation of\b/gi, 'explain'],
  [/\bprovide a description of\b/gi, 'describe'],
  [/\bprovide an explanation of\b/gi, 'explain'],
  [/\bprovide a summary of\b/gi, 'summarize'],
  [/\bprovide a list of\b/gi, 'list'],
  [/\bprovide me with\b/gi, 'give me'],
  [/\bI would appreciate it if you could\b/gi, ''],
  [/\bdo not hesitate to\b/gi, ''],
];

const REDUNDANT_PATTERNS = [
  /\b(make sure|ensure) (that )?you (are |do )?/gi,
  /\bplease note that\b/gi,
  /\bkeep in mind that\b/gi,
  /\bremember that\b/gi,
  /\bdon't forget to\b/gi,
  /\bI want the (output|result|response|answer) to be\b/gi,
];

// ─── Structural analysis ───

const ROLE_KEYWORDS = /\b(you are|act as|role|persona|pretend|imagine you)\b/i;
const CONSTRAINT_KEYWORDS = /\b(under \d+|at most|maximum|limit|no more than|keep it|brief|concise|short)\b/i;
const FORMAT_KEYWORDS = /\b(format|json|markdown|bullet|numbered|list|table|csv|xml|yaml)\b/i;
const EXAMPLE_KEYWORDS = /\b(example|for instance|e\.g\.|such as|like this|sample)\b/i;

export function analyzeStructure(text) {
  const suggestions = [];
  const lower = text.toLowerCase();

  if (!ROLE_KEYWORDS.test(lower)) {
    suggestions.push({
      type: 'missing_role',
      label: 'No role defined',
      tip: 'Add a role (e.g., "You are a senior backend engineer") to get more targeted responses.',
    });
  }

  if (!CONSTRAINT_KEYWORDS.test(lower)) {
    suggestions.push({
      type: 'missing_constraints',
      label: 'No constraints set',
      tip: 'Add length/scope constraints (e.g., "Keep under 200 words") to reduce output tokens.',
    });
  }

  if (!FORMAT_KEYWORDS.test(lower)) {
    suggestions.push({
      type: 'missing_format',
      label: 'No output format specified',
      tip: 'Specify format (e.g., "Respond in bullet points" or "Return JSON") for structured output.',
    });
  }

  if (!EXAMPLE_KEYWORDS.test(lower)) {
    suggestions.push({
      type: 'missing_example',
      label: 'No examples provided',
      tip: 'Adding an example helps the LLM understand exactly what you expect.',
    });
  }

  // Detect overly long prompts (likely rambling)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const longSentences = sentences.filter(s => s.trim().split(/\s+/).length > 30);
  if (longSentences.length > 0) {
    suggestions.push({
      type: 'long_sentences',
      label: `${longSentences.length} overly long sentence(s)`,
      tip: 'Break long sentences into shorter, direct instructions for clarity.',
    });
  }

  // Detect repetition
  const normalizedSentences = sentences.map(s => s.trim().toLowerCase());
  const seen = new Set();
  let dupes = 0;
  for (const s of normalizedSentences) {
    if (s && seen.has(s)) dupes++;
    seen.add(s);
  }
  if (dupes > 0) {
    suggestions.push({
      type: 'repetition',
      label: `${dupes} repeated sentence(s)`,
      tip: 'Remove duplicate instructions — they waste tokens without adding clarity.',
    });
  }

  return suggestions;
}

// ─── Local optimization (FREE) ───

function removeFiller(text) {
  let result = text;
  for (const pattern of FILLER_PHRASES) {
    result = result.replace(pattern, '');
  }
  return result;
}

function applyReplacements(text) {
  let result = text;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function removeRedundant(text) {
  let result = text;
  for (const pattern of REDUNDANT_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result;
}

function collapseWhitespace(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^ +/gm, '')
    .replace(/ +$/gm, '')
    .trim();
}

function removeDuplicateSentences(text) {
  const lines = text.split('\n');
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    if (normalized === '' || !seen.has(normalized)) {
      seen.add(normalized);
      result.push(line);
    }
  }
  return result.join('\n');
}

function capitalizeFirstLetter(text) {
  if (!text) return text;
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, letter) =>
    prefix + letter.toUpperCase()
  );
}

export function optimizeLocal(input) {
  if (!input.trim()) {
    return { optimizedPrompt: '', changes: [], suggestions: [], beforeTokens: 0, afterTokens: 0, reduction: 0 };
  }

  const changes = [];
  let text = input;

  const before = text;
  text = applyReplacements(text);
  if (text !== before) changes.push('Replaced verbose phrases with concise alternatives');

  const beforeFiller = text;
  text = removeFiller(text);
  if (text !== beforeFiller) changes.push('Removed filler words and unnecessary hedging');

  const beforeRedundant = text;
  text = removeRedundant(text);
  if (text !== beforeRedundant) changes.push('Removed redundant instruction phrases');

  const beforeDupes = text;
  text = removeDuplicateSentences(text);
  if (text !== beforeDupes) changes.push('Removed duplicate lines');

  text = collapseWhitespace(text);
  text = capitalizeFirstLetter(text);

  const suggestions = analyzeStructure(text);

  const beforeTokens = estimateTokens(input);
  const afterTokens = estimateTokens(text);
  const reduction = beforeTokens > 0
    ? Math.round(((beforeTokens - afterTokens) / beforeTokens) * 100)
    : 0;

  if (changes.length === 0) {
    changes.push('Prompt is already concise — no major text optimizations found');
  }

  return { optimizedPrompt: text, changes, suggestions, beforeTokens, afterTokens, reduction };
}

// ─── AI Deep Optimize (LLM — optional, costs tokens) ───

const SYSTEM_PROMPT = `You are an expert prompt engineer. Your job is to rewrite the user's prompt to be maximally effective and token-efficient.

Rules:
1. Add a clear role if missing
2. Make instructions direct and imperative
3. Add constraints (length, format, scope) if missing
4. Structure with clear sections if the prompt is complex
5. Remove all fluff — every token must earn its place
6. Preserve the original intent completely

Return ONLY the optimized prompt, nothing else. No explanations, no preamble.`;

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
