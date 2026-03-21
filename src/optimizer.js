// Hybrid prompt optimizer
// Layer 1: Hard cleanup (remove fluff)
// Layer 2: Extract intent, constraints, requirements from conversational mess
// Layer 3: Rebuild as structured prompt
// Optional: AI deep optimize

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

// ─── Layer 1: Hard cleanup ───

const SOFT_LANGUAGE = [
  /\b(please|kindly|if you could|if you would|would you mind)\b/gi,
  /\b(i would like you to|i want you to|i need you to|i'd like you to)\b/gi,
  /\b(maybe|perhaps|possibly|I think|I believe|I feel like|it seems like)\b/gi,
  /\b(sort of|kind of|just|really|very|actually|basically|essentially|literally|honestly|frankly)\b/gi,
  /\b(as an ai|as a language model|you are an ai|you are a language model)\b/gi,
  /^(can you|could you|will you|would you)\s+/gim,
  /\bI would appreciate it if you could\b/gi,
  /\bdo not hesitate to\b/gi,
  /\b(hello|hi|hey|dear)\b,?\s*/gi,
  /\bthank you( so much| very much)?\s*[.!]?\s*/gi,
  /\bthanks\s*[.!]?\s*/gi,
];

const VERBOSE_TO_CONCISE = [
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bfor the purpose of\b/gi, 'to'],
  [/\bin the event that\b/gi, 'if'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bat the present time\b/gi, 'now'],
  [/\bprior to\b/gi, 'before'],
  [/\bsubsequent to\b/gi, 'after'],
  [/\bin spite of the fact that\b/gi, 'although'],
  [/\bwith regard to\b/gi, 'about'],
  [/\bwith respect to\b/gi, 'about'],
  [/\bin regard to\b/gi, 'about'],
  [/\bpertaining to\b/gi, 'about'],
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
  [/\bis able to\b/gi, 'can'],
  [/\bhas the ability to\b/gi, 'can'],
  [/\bmake sure that\b/gi, 'ensure'],
  [/\btake into consideration\b/gi, 'consider'],
  [/\btake into account\b/gi, 'consider'],
  [/\bgive an explanation of\b/gi, 'explain'],
  [/\bprovide a description of\b/gi, 'describe'],
  [/\bprovide an explanation of\b/gi, 'explain'],
  [/\bprovide a summary of\b/gi, 'summarize'],
  [/\bprovide a list of\b/gi, 'list'],
  [/\bprovide me with\b/gi, 'give me'],
];

const REDUNDANT_PATTERNS = [
  /\b(make sure|ensure) (that )?you (are |do )?/gi,
  /\bplease note that\b/gi,
  /\bkeep in mind that\b/gi,
  /\bremember that\b/gi,
  /\bdon't forget to\b/gi,
  /\bI want the (output|result|response|answer) to be\b/gi,
  /\balso,?\s*/gi,
];

function hardCleanup(text) {
  let result = text;
  for (const [pattern, replacement] of VERBOSE_TO_CONCISE) {
    result = result.replace(pattern, replacement);
  }
  for (const pattern of SOFT_LANGUAGE) {
    result = result.replace(pattern, '');
  }
  for (const pattern of REDUNDANT_PATTERNS) {
    result = result.replace(pattern, '');
  }
  // Collapse whitespace
  result = result
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^ +/gm, '')
    .replace(/ +$/gm, '')
    .replace(/\.\s*\./g, '.')
    .trim();
  return result;
}

// ─── Layer 2: Extract structured components ───

function extractRole(text) {
  const rolePatterns = [
    /(?:you are|act as|role:?\s*)\s*(?:a |an )?([\w\s]+(?:writer|engineer|developer|designer|analyst|expert|teacher|educator|consultant|advisor|strategist|planner|scientist|researcher|translator|editor|reviewer|manager|architect|specialist))(?:\.|,|$)/im,
    /(?:imagine you(?:'re| are))\s+(?:a |an )?([\w\s]+(?:writer|engineer|developer|designer|analyst|expert|teacher|educator|consultant|advisor|strategist))(?:\.|,|$)/im,
  ];
  for (const pattern of rolePatterns) {
    const match = text.match(pattern);
    if (match && match[1].trim().length > 3 && match[1].trim().length < 80) {
      return match[1].trim().replace(/^\w/, c => c.toUpperCase());
    }
  }
  return null;
}

function inferRole(task) {
  if (!task) return null;
  const lower = task.toLowerCase();

  if (/\b(blog|article|post|essay|content|copywriting|write)\b/.test(lower)) return 'Professional content writer';
  if (/\b(code|debug|refactor|function|api|bug|implement|deploy)\b/.test(lower)) return 'Senior software engineer';
  if (/\b(explain|teach|tutorial|lesson|course|learn)\b/.test(lower)) return 'Technical educator';
  if (/\b(analyze|data|report|metrics|dashboard|insight)\b/.test(lower)) return 'Data analyst';
  if (/\b(design|ui|ux|wireframe|mockup|prototype|layout)\b/.test(lower)) return 'UX/UI designer';
  if (/\b(market|brand|campaign|seo|social media|ads)\b/.test(lower)) return 'Marketing strategist';
  if (/\b(email|letter|message|memo|announcement)\b/.test(lower)) return 'Professional communicator';
  if (/\b(review|feedback|evaluate|assess|audit)\b/.test(lower)) return 'Domain expert';
  if (/\b(plan|strategy|roadmap|proposal|pitch)\b/.test(lower)) return 'Strategic planner';
  if (/\b(translate|localize|language)\b/.test(lower)) return 'Professional translator';
  if (/\b(summarize|summary|brief|digest|overview)\b/.test(lower)) return 'Research analyst';

  return 'Domain expert';
}

function extractTask(text) {
  const cleaned = text
    .replace(/\b(you are|act as|role:?|imagine you).+?[.,]/gi, '')
    .trim();

  const taskPatterns = [
    /(?:help me |help us )?(write|create|build|generate|design|develop|draft|compose|produce|prepare)\s+(.+?)(?:[.?!]|$)/im,
    /(?:help me |help us )?(explain|describe|summarize|analyze|review|compare|evaluate|list|outline)\s+(.+?)(?:[.?!]|$)/im,
    /(?:help me |help us )?(translate|convert|transform|rewrite|edit|fix|debug|refactor|optimize)\s+(.+?)(?:[.?!]|$)/im,
  ];

  // Find the earliest matching task verb in the text
  let bestMatch = null;
  let bestIndex = Infinity;
  for (const pattern of taskPatterns) {
    const match = cleaned.match(pattern);
    if (match && match.index < bestIndex) {
      bestMatch = match;
      bestIndex = match.index;
    }
  }

  if (bestMatch) {
    const match = bestMatch;
    {
      const verb = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      let obj = match[2].trim();
      obj = obj.replace(/\s+(that|which|where|with|and|but)\s*$/, '').trim();
      if (obj.length > 5) {
        let task = `${verb} ${obj}`;

        // Look anywhere in text for "about/on/regarding" clause to enrich the task
        const topicMatch = cleaned.match(/\b(?:about|on|regarding|concerning)\s+(?:the\s+)?(.+?)(?:\.|,|$)/im);
        if (topicMatch && topicMatch[1].trim().length > 3) {
          task += ` on ${topicMatch[1].trim().replace(/^\w/, c => c.toLowerCase())}`;
        }

        return task;
      }
    }
  }

  const sentences = cleaned.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  if (sentences.length > 0) {
    let task = sentences[0].replace(/^\w/, c => c.toUpperCase());
    if (task.length > 120) task = task.slice(0, 120).trim();
    return task;
  }
  return null;
}

function extractConstraints(text) {
  const constraints = [];
  const lower = text.toLowerCase();

  // Tone
  const toneMatch = lower.match(/\b(professional|casual|formal|friendly|technical|simple|academic|conversational|humorous|serious|persuasive|informative)\s*(?:tone|style|voice|manner|writing)/i)
    || lower.match(/\b(?:tone|style|voice|manner|writing)\s*(?::|should be|is|=)\s*(professional|casual|formal|friendly|technical|simple|academic|conversational|humorous|serious|persuasive|informative)/i)
    || lower.match(/\b(?:in a |write it |make it )(professional|casual|formal|friendly|technical|simple|academic|conversational|humorous|serious|persuasive|informative)\b/i);
  if (toneMatch) {
    constraints.push(`Tone: ${toneMatch[1].charAt(0).toUpperCase() + toneMatch[1].slice(1)}`);
  }

  // Length
  const lengthMatch = lower.match(/\b(?:around|about|approximately|roughly|~)?\s*(\d+)\s*(?:words|word)\b/i)
    || lower.match(/\b(?:under|at most|maximum|max|no more than|limit to)\s*(\d+)\s*(?:words|word)\b/i);
  if (lengthMatch) {
    constraints.push(`Length: ~${lengthMatch[1]} words`);
  }

  // Language
  const langMatch = lower.match(/\b(?:in |write in |respond in |use )(english|spanish|french|german|chinese|japanese|korean|portuguese|italian|russian|arabic|hindi)\b/i);
  if (langMatch) {
    constraints.push(`Language: ${langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1)}`);
  }

  // Audience
  const audienceMatch = lower.match(/\b(?:for|target|audience|aimed at|written for)\s*(?:a |an )?(beginners?|experts?|developers?|students?|children|kids|professionals?|managers?|executives?|non-technical|technical)\b/i);
  if (audienceMatch) {
    constraints.push(`Audience: ${audienceMatch[1].charAt(0).toUpperCase() + audienceMatch[1].slice(1)}`);
  }

  return constraints;
}

// Clarity compression: "because it provides flexibility" → "Flexibility as a key driver"
const CLARITY_COMPRESSIONS = [
  [/\bbecause (?:it |they |this )(?:provides?|offers?|gives?|enables?|allows?) (.+)/gi, (_, thing) => `${thing.replace(/^\w/, c => c.toUpperCase())} as a key driver`],
  [/\b(?:it |they |this )(?:provides?|offers?|gives?) (.+?) (?:for|to) (.+)/gi, (_, what, whom) => `${what.replace(/^\w/, c => c.toUpperCase())} for ${whom}`],
  [/\bthe (?:main |primary |key )?(?:reason|benefit|advantage) (?:is |being )(?:that )?(.+)/gi, (_, reason) => reason.replace(/^\w/, c => c.toUpperCase())],
];

function compressClarity(text) {
  let result = text;
  for (const [pattern, replacement] of CLARITY_COMPRESSIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function extractKeyPoints(text) {
  const points = [];
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);

  const contentPatterns = [
    /\b(?:about|cover|mention|discuss|address|talk about|focus on)\s+(?:the )?(.+)/i,
    /\b(?:benefits? of|advantages? of|reasons? for|importance of)\s+(.+)/i,
  ];

  for (const sentence of sentences) {
    for (const pattern of contentPatterns) {
      const match = sentence.match(pattern);
      if (match) {
        let point = match[1].trim();
        point = point.replace(/\s+(that|which|because|since|as|so|and|but)\s.*$/, '');
        // Apply clarity compression
        point = compressClarity(point);
        point = point.replace(/^\w/, c => c.toUpperCase());
        // Skip very short/generic points
        const words = point.split(/\s+/).filter(w => w.length > 2);
        if (point.length > 5 && point.length < 150 && words.length >= 2 && !points.includes(point)) {
          points.push(point);
        }
      }
    }
  }

  return points;
}

// Deduplicate key points against task — don't repeat what the task already says
function deduplicateAgainstTask(points, task) {
  if (!task) return points;
  const taskWords = new Set(task.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  return points.filter(point => {
    const pointWords = point.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const overlap = pointWords.filter(w => taskWords.has(w)).length;
    // If more than 60% of the point's words are already in the task, skip it
    return pointWords.length === 0 || (overlap / pointWords.length) < 0.6;
  });
}

// Deduplicate output requirements against key points
function deduplicateRequirements(requirements, keyPoints) {
  if (keyPoints.length === 0) return requirements;
  const pointsLower = keyPoints.map(p => p.toLowerCase());
  return requirements.filter(req => {
    const reqLower = req.toLowerCase();
    // If a requirement's core content is already covered in key points, drop it
    return !pointsLower.some(p => {
      const reqWords = reqLower.split(/\s+/).filter(w => w.length > 3);
      const pWords = p.split(/\s+/).filter(w => w.length > 3);
      const overlap = reqWords.filter(w => pWords.includes(w)).length;
      return reqWords.length > 0 && (overlap / reqWords.length) >= 0.5;
    });
  });
}

function extractOutputRequirements(text) {
  const requirements = [];
  const lower = text.toLowerCase();

  // Format requirements
  const formatPatterns = [
    [/\b(?:in |as |use )?(?:bullet|bulleted)\s*(?:points?|list|format)?\b/i, 'Use bullet points'],
    [/\b(?:in |as |use )?(?:numbered|ordered)\s*(?:list|format)?\b/i, 'Use numbered list'],
    [/\b(?:in |as |return |output )?json\b/i, 'Return JSON'],
    [/\b(?:in |as |use )?markdown\b/i, 'Use Markdown'],
    [/\b(?:in |as |use )?table\s*(?:format)?\b/i, 'Use table format'],
    [/\bcode\s*(?:block|snippet|example)s?\b/i, 'Include code examples'],
  ];

  for (const [pattern, label] of formatPatterns) {
    if (pattern.test(lower)) {
      requirements.push(label);
    }
  }

  // Content requirements (include X, add X)
  const includePatterns = [
    /\b(?:include|add)\s+(?:some\s+)?(?:relevant\s+)?(statistics|stats|data|numbers|examples?|references?|sources?|links?|citations?|images?|diagrams?|charts?|graphs?)\b/gi,
  ];

  for (const pattern of includePatterns) {
    let match;
    while ((match = pattern.exec(lower)) !== null) {
      const item = match[1].toLowerCase();
      const req = `Include ${item}`;
      if (!requirements.includes(req)) {
        requirements.push(req);
      }
    }
  }

  // Specific output instructions like "list of tips"
  const listMatch = text.match(/\b(?:list|include|give|provide)\s+(?:a list of |some )?(tips|steps|strategies|recommendations|suggestions|ideas|ways|methods|techniques|approaches)\s+(?:for|to|on)\s+(.+?)(?:\.|,|$)/i);
  if (listMatch) {
    const req = `Include ${listMatch[1].toLowerCase()} for ${listMatch[2].trim()}`;
    if (!requirements.includes(req)) {
      requirements.push(req);
    }
  }

  // Structured article detection
  if (/\b(?:structured|well-structured|organized)\s*(?:article|post|essay|document|response)\b/i.test(lower)) {
    requirements.push('Structured format with sections');
  }

  return requirements;
}

// ─── Layer 3: Build structured prompt ───

function buildStructuredPrompt(role, task, constraints, keyPoints, outputRequirements, cleanedText) {
  const sections = [];

  // Role
  if (role) {
    sections.push(`Role: ${role}`);
  }

  // Task
  if (task) {
    sections.push(`Task: ${task}`);
  }

  // Constraints
  if (constraints.length > 0) {
    sections.push(`Constraints:\n${constraints.map(c => `- ${c}`).join('\n')}`);
  }

  // Key Points
  if (keyPoints.length > 0) {
    sections.push(`Key points:\n${keyPoints.map(p => `- ${p}`).join('\n')}`);
  }

  // Output Requirements
  if (outputRequirements.length > 0) {
    sections.push(`Output requirements:\n${outputRequirements.map(r => `- ${r}`).join('\n')}`);
  }

  // If we couldn't extract much structure, fall back to cleaned text
  if (!task && sections.length <= 1) {
    return cleanedText;
  }

  return sections.join('\n\n');
}

// ─── Main local optimize ───

export function optimizeLocal(input) {
  if (!input.trim()) {
    return { optimizedPrompt: '', changes: [], beforeTokens: 0, afterTokens: 0, reduction: 0 };
  }

  const changes = [];

  // Layer 1: Hard cleanup
  const cleaned = hardCleanup(input);
  if (cleaned !== input.trim()) {
    changes.push('Reduced verbosity and removed soft language');
  }

  // Layer 2: Extract structure
  const explicitRole = extractRole(input);
  const task = extractTask(cleaned);
  const role = explicitRole || inferRole(task);
  const constraints = extractConstraints(input);
  let keyPoints = extractKeyPoints(cleaned);
  let outputRequirements = extractOutputRequirements(cleaned);

  // Deduplicate: key points vs task, requirements vs key points
  keyPoints = deduplicateAgainstTask(keyPoints, task);
  outputRequirements = deduplicateRequirements(outputRequirements, keyPoints);

  // Quality check: only structure if we have enough signal
  const structureScore =
    (task ? 1 : 0) +
    (constraints.length > 0 ? 1 : 0) +
    (keyPoints.length > 0 ? 1 : 0) +
    (outputRequirements.length > 0 ? 1 : 0);

  let optimized;
  if (structureScore >= 2) {
    optimized = buildStructuredPrompt(role, task, constraints, keyPoints, outputRequirements, cleaned);
    changes.push('Converted unstructured input into structured prompt format');
    if (!explicitRole && role) changes.push(`Inferred role: "${role}"`);
    if (explicitRole) changes.push(`Extracted role: "${explicitRole}"`);
    if (constraints.length > 0) changes.push(`Extracted ${constraints.length} constraint(s)`);
    if (keyPoints.length > 0) changes.push(`Identified ${keyPoints.length} key point(s)`);
    if (outputRequirements.length > 0) changes.push(`Identified ${outputRequirements.length} output requirement(s)`);
  } else if (task) {
    // Partial structure: at least format as task
    optimized = role ? `Role: ${role}\n\nTask: ${task}` : `Task: ${task}`;
    if (cleaned !== optimized) {
      changes.push('Extracted core task from conversational text');
      if (!explicitRole && role) changes.push(`Inferred role: "${role}"`);
    } else {
      optimized = cleaned;
    }
  } else {
    optimized = cleaned;
  }

  const beforeTokens = estimateTokens(input);
  let afterTokens = estimateTokens(optimized);

  // Guard: if structured output is longer than input, fall back to cleaned text
  if (afterTokens > beforeTokens) {
    optimized = cleaned;
    afterTokens = estimateTokens(optimized);
    // If even cleaned is longer (very short input), return original
    if (afterTokens >= beforeTokens) {
      return {
        optimizedPrompt: input.trim(),
        changes: ['Prompt is already concise — no optimizations needed'],
        beforeTokens,
        afterTokens: beforeTokens,
        reduction: 0,
      };
    }
  }

  if (changes.length === 0) {
    changes.push('Prompt is already well-structured — no optimizations needed');
  }

  const reduction = beforeTokens > 0
    ? Math.round(((beforeTokens - afterTokens) / beforeTokens) * 100)
    : 0;

  if (reduction > 0 && changes.length > 1) {
    changes.push(`Reduced tokens by ${reduction}% while improving clarity`);
  }

  return { optimizedPrompt: optimized, changes, beforeTokens, afterTokens, reduction };
}

// ─── AI Deep Optimize (optional, costs tokens) ───

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
