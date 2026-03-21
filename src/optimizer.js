// Hybrid prompt optimizer
// Layer 1: Hard cleanup (remove fluff)
// Layer 2: Extract intent, constraints, requirements from conversational mess
// Layer 3: Rebuild as structured prompt
// Optional: AI deep optimize

// ─── Token estimation (tiktoken — model-accurate, lazy-loaded) ───

let enc = null;

async function getEncoder() {
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

// Pre-load encoder on import so it's ready by the time user clicks optimize
getEncoder();

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

// Task normalization: vague content descriptions → clear format
const TASK_NORMALIZATIONS = [
  [/\b(?:create|write|produce)\s+(?:some\s+)?(?:sort of\s+)?(?:content|something),?\s*(?:like\s+)?(?:maybe\s+)?(?:a\s+)?(?:blog|article)\s*(?:or\s+(?:article|blog|something))?\s*(?:or\s+something\s+(?:along\s+those\s+lines|like\s+that))?\b/gi, 'write a blog post'],
  [/\b(?:some\s+)?(?:sort\s+of\s+)?(?:content|piece),?\s*(?:like\s+)?(?:maybe\s+)?(?:a\s+)?blog\b/gi, 'a blog post'],
  [/\bif that makes sense\b/gi, ''],
  [/\byeah,?\s*/gi, ''],
  [/\bI guess\b/gi, ''],
  [/\bor something(?:\s+like that)?\b/gi, ''],
  [/\balong those lines\b/gi, ''],
  [/\bpretty much\b/gi, ''],
  [/\bnot too (\w+)\s+(?:where|because|but)\s+.+?(?:\.|,|$)/gim, ''],
  [/\bI'm not super strict about .+?(?:\.|,|$)/gim, ''],
  [/\bit's okay if not\b/gi, ''],
  [/\bbut it's okay\b/gi, ''],
  [/\bif possible\b/gi, ''],
  [/\bif you can\b/gi, ''],
  [/\bjust to wrap things up nicely\b/gi, ''],
  [/\bjust something that looks clean\b/gi, ''],
];

function hardCleanup(text) {
  let result = text;
  // Task normalization first (before soft language removal)
  for (const [pattern, replacement] of TASK_NORMALIZATIONS) {
    result = result.replace(pattern, replacement);
  }
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
    .replace(/,\s*,/g, ',')
    .replace(/\s+([.,!?])/g, '$1')
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

  // Specific tech roles first (order matters — most specific wins)
  if (/\b(react|vue|angular|svelte|frontend|front-end|component|hook|css|html|dom|tailwind|application|app)\b/.test(lower)) return 'Frontend developer';
  if (/\b(api|backend|back-end|server|endpoint|database|sql|node|express|django|flask)\b/.test(lower)) return 'Backend engineer';
  if (/\b(devops|docker|kubernetes|ci\/cd|pipeline|deploy|terraform|aws|azure|gcp)\b/.test(lower)) return 'DevOps engineer';
  if (/\b(code|debug|refactor|function|bug|implement|script|algorithm|class|module)\b/.test(lower)) return 'Senior software engineer';

  // Content & communication
  if (/\b(blog|article|post|essay|content|copywriting|write)\b/.test(lower)) return 'Professional content writer';
  if (/\b(email|letter|message|memo|announcement)\b/.test(lower)) return 'Professional communicator';

  // Analytical & research
  if (/\b(explain|teach|tutorial|lesson|course|learn)\b/.test(lower)) return 'Technical educator';
  if (/\b(analyze|data|report|metrics|insight)\b/.test(lower)) return 'Data analyst';
  if (/\b(summarize|summary|brief|digest|overview)\b/.test(lower)) return 'Research analyst';

  // Design & strategy
  if (/\b(design|wireframe|mockup|prototype|layout)\b/.test(lower)) return 'UX/UI designer';
  if (/\b(market|brand|campaign|seo|social media|ads)\b/.test(lower)) return 'Marketing strategist';
  if (/\b(plan|strategy|roadmap|proposal|pitch)\b/.test(lower)) return 'Strategic planner';

  // Other
  if (/\b(review|feedback|evaluate|assess|audit)\b/.test(lower)) return 'Domain expert';
  if (/\b(translate|localize|language)\b/.test(lower)) return 'Professional translator';

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
      // Aggressively trim trailing noise from the object
      obj = obj
        .replace(/\s*,\s*(?:about|but|and|or|not|if|because|since|like|it|i)\b.*$/i, '')
        .replace(/\s+(that|which|where|with|and|but)\s*$/, '')
        .trim();
      if (obj.length > 3) {
        let task = `${verb} ${obj}`;

        // Look anywhere in text for "about/on/regarding" clause to enrich the task
        const topicMatch = cleaned.match(/\b(?:about|on|regarding|concerning)\s+(?:the\s+)?(.+?)(?:\.|,|$)/im);
        if (topicMatch && topicMatch[1].trim().length > 3) {
          const topic = topicMatch[1].trim().toLowerCase();
          // Only append if not already in the task
          if (!task.toLowerCase().includes(topic.split(/\s+/)[0])) {
            task += ` on ${topic}`;
          }
        }

        // Final task sanitizer — remove leaked conversational noise
        task = task
          .replace(/\b(help me|help us|figure it out|something|stuff|things|some sort of|or something)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();

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

  // Tone — detect compound tones like "professional but not too boring"
  const toneWords = ['professional', 'casual', 'formal', 'friendly', 'simple', 'academic', 'conversational', 'humorous', 'serious', 'persuasive', 'informative'];
  const detectedTones = [];
  for (const tone of toneWords) {
    // Skip if preceded by "not" or "not too" — negated tones
    if (new RegExp(`\\bnot\\s+(?:too\\s+)?${tone}\\b`, 'i').test(lower)) continue;
    if (new RegExp(`\\b${tone}\\b`, 'i').test(lower)) {
      detectedTones.push(tone.charAt(0).toUpperCase() + tone.slice(1));
    }
  }
  // "technical" is special — only add as tone if not negated
  if (/\btechnical\b/i.test(lower) && !/\bnot\s+(?:too\s+)?technical\b/i.test(lower) && !/\bnon-technical\b/i.test(lower)) {
    detectedTones.push('Technical');
  }
  // Detect accessibility signals
  const accessibilitySignals = [
    /\bnot too (?:technical|complicated|complex|boring)\b/i,
    /\bdon't.+?understand.+?complicated\b/i,
    /\bnon-technical\b/i,
    /\beasy to (?:understand|read|follow)\b/i,
    /\bsimple (?:language|terms|words)\b/i,
    /\baccessible\b/i,
  ];
  const isAccessible = accessibilitySignals.some(p => p.test(lower));
  if (detectedTones.length > 0 || isAccessible) {
    let tone = detectedTones.join(' and ');
    if (isAccessible && !detectedTones.includes('Simple')) {
      tone = tone ? `${tone} and accessible (non-technical audience)` : 'Accessible (non-technical audience)';
    }
    if (tone) constraints.push(`Tone: ${tone}`);
  }

  // Length — detect ranges like "800 to 1000 words"
  const rangeMatch = lower.match(/\b(\d+)\s*(?:to|-|–)\s*(\d+)\s*(?:words|word)\b/i);
  if (rangeMatch) {
    constraints.push(`Length: ${rangeMatch[1]}–${rangeMatch[2]} words`);
  } else {
    const lengthMatch = lower.match(/\b(?:around|about|approximately|roughly|~)?\s*(\d+)\s*(?:words|word)\b/i)
      || lower.match(/\b(?:under|at most|maximum|max|no more than|limit to)\s*(\d+)\s*(?:words|word)\b/i);
    if (lengthMatch) {
      constraints.push(`Length: ~${lengthMatch[1]} words`);
    }
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

  // Tech stack detection — frameworks always match, general languages need "in/with/use" context
  const frameworkPatterns = [
    [/\b(react(?:\.?js)?|reactjs)\b/i, 'React.js'],
    [/\b(next\.?js|nextjs)\b/i, 'Next.js'],
    [/\b(node\.?js|nodejs)\b/i, 'Node.js'],
    [/\b(vue\.?js|vuejs)\b/i, 'Vue.js'],
    [/\b(angular)\b/i, 'Angular'],
    [/\b(svelte)\b/i, 'Svelte'],
    [/\b(django|flask|fastapi|express)\b/i, null],
    [/\b(tailwind(?:\s*css)?)\b/i, 'Tailwind CSS'],
  ];
  for (const [pattern, label] of frameworkPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const tech = label || match[1].charAt(0).toUpperCase() + match[1].slice(1);
      constraints.push(`Use ${tech}`);
    }
  }
  // General languages only when explicitly chosen as tech stack ("in python", "use typescript", "with python")
  const langTechPatterns = [
    [/\b(?:in|with|use|using)\s+(python)\b/i, 'Python'],
    [/\b(?:in|with|use|using)\s+(typescript|ts)\b/i, 'TypeScript'],
    [/\b(?:in|with|use|using)\s+(javascript|js)\b/i, 'JavaScript'],
    [/\b(?:in|with|use|using)\s+(rust)\b/i, 'Rust'],
    [/\b(?:in|with|use|using)\s+(go(?:lang)?)\b/i, 'Go'],
  ];
  for (const [pattern, label] of langTechPatterns) {
    if (pattern.test(lower)) {
      constraints.push(`Use ${label}`);
    }
  }

  // No-database constraint
  if (/\bno\s+database\b/i.test(lower) || /\bwithout\s+(?:a\s+)?database\b/i.test(lower) || /\bignore\s+(?:any\s+)?database\b/i.test(lower) || /\bdon'?t\s+(?:need|want|use)\s+(?:a\s+)?database\b/i.test(lower)) {
    constraints.push('No database required');
  }

  // Responsive / mobile-friendly UI
  if (/\bresponsive\b/i.test(lower) || /\bmobile[- ]?friendly\b/i.test(lower) || /\bmobile\s+users?\b/i.test(lower)) {
    constraints.push('Responsive UI (mobile-friendly)');
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
  const lower = text.toLowerCase();
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);

  // Pattern-based extraction from sentences
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
        point = compressClarity(point);
        point = point.replace(/^\w/, c => c.toUpperCase());
        const words = point.split(/\s+/).filter(w => w.length > 2);
        if (point.length > 5 && point.length < 150 && words.length >= 2 && !points.includes(point)) {
          points.push(point);
        }
      }
    }
  }

  // Semantic signal detection — things the user wants covered
  const semanticSignals = [
    [/\b(?:challenges?|risks?|downsides?|drawbacks?|limitations?|concerns?|problems?)\b/i, null],
    [/\b(?:real[- ]?world|practical)\s*(?:examples?|cases?|use cases?|applications?)\b/i, 'Real-world examples and applications'],
    [/\b(?:how\s+(?:\w+\s+)?(?:are|is)\s+(?:using|leveraging|implementing|adopting))\b/i, 'Real-world examples and applications'],
    [/\b(?:statistics?|stats|data|numbers|figures|research)\b/i, 'Include relevant statistics'],
    [/\b(?:conclusion|summary|wrap\s*up|closing|final\s+(?:thoughts?|remarks?))\b/i, 'Provide a clear conclusion'],
    [/\b(?:compare|comparison|difference between|vs\.?|versus)\b/i, 'Compare approaches and highlight differences'],
    [/\b(?:pros?\s+(?:and|&)\s+cons?|trade-?offs?|advantages?\s+(?:and|&)\s+disadvantages?)\b/i, 'Evaluate pros and cons'],
  ];

  for (const [pattern, label] of semanticSignals) {
    if (pattern.test(lower)) {
      if (!label) {
        // For challenges/risks, extract concrete examples like "data privacy"
        // Try multiple patterns — example may be in same sentence or nearby
        let example = '';
        const examplePatterns = [
          /\b(?:challenges?|risks?)\b[^.]*?(?:like|such as|e\.?g\.?|for example)\s+([\w\s]+?)(?:\.|,|\band\b|$)/i,
          /\b(?:challenges?|risks?)\b[^.]*\.[^.]*?(?:like|such as|e\.?g\.?|for example)\s+([\w\s]+?)(?:\.|,|\band\b|$)/i,
          /\b(?:data privacy|bias|security|accuracy|fairness|transparency|regulation|compliance|ethical|consent)\b/i,
        ];
        for (const ep of examplePatterns) {
          const em = lower.match(ep);
          if (em) {
            const candidate = (em[1] ? em[1].trim() : em[0].trim());
            // Filter out noise
            if (candidate && !/\b(perfect|anything|something|good|bad|sound|want)\b/i.test(candidate) && candidate.length >= 3 && candidate.length <= 40) {
              example = candidate;
              break;
            }
          }
        }
        const point = example
          ? `Challenges and risks (e.g., ${example.toLowerCase()})`
          : 'Challenges and risks';
        if (!points.includes(point)) points.push(point);
      } else {
        if (!points.includes(label)) points.push(label);
      }
    }
  }

  // Feature flag detection — offline/local, AI, etc.
  if (/\b(?:offline|locally|local\s+(?:system|mode|processing)|without\s+internet)\b/i.test(lower)) {
    const offlinePoint = 'Optimize prompts locally (offline)';
    if (!points.includes(offlinePoint)) points.push(offlinePoint);
  }
  if (/\b(?:optimi\w+\s+with\s+ai|ai[- ]?(?:based|powered)\s+optimi\w+|facility\s+where\s+optimi\w+\s+with\s+ai|optional\s+ai)\b/i.test(lower)) {
    const aiPoint = 'Provide optional AI-based optimization';
    if (!points.includes(aiPoint)) points.push(aiPoint);
  }

  // Mark semantic entries so we can distinguish them from content-pattern entries
  const semanticEntries = new Set();
  for (const [pattern, label] of semanticSignals) {
    if (pattern.test(lower)) {
      // Find the entry we added for this signal
      const added = points.find(p =>
        (label && p === label) ||
        (!label && p.startsWith('Challenges and risks'))
      );
      if (added) semanticEntries.add(added);
    }
  }

  // Remove content-pattern entries that overlap with semantic entries
  return points.filter(p => {
    if (semanticEntries.has(p)) return true; // always keep semantic
    // Check if this content-pattern entry overlaps with any semantic entry
    const pLower = p.toLowerCase().replace(/[,.]$/,'');
    for (const s of semanticEntries) {
      const sLower = s.toLowerCase();
      const pWords = pLower.split(/\s+/).filter(w => w.length > 3);
      const sWords = sLower.split(/\s+/).filter(w => w.length > 3);
      const overlap = pWords.filter(w => sWords.includes(w)).length;
      if (pWords.length > 0 && (overlap / pWords.length) >= 0.4) return false;
    }
    return true;
  });
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

// Deduplicate output requirements against key points + within themselves
function deduplicateRequirements(requirements, keyPoints) {
  // First: deduplicate within requirements (e.g., "Include statistics" vs "Include relevant statistics")
  const unique = [];
  for (const req of requirements) {
    const reqLower = req.toLowerCase();
    const reqWords = reqLower.split(/\s+/).filter(w => w.length > 3);
    const isDupe = unique.some(existing => {
      const exWords = existing.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const overlap = reqWords.filter(w => exWords.includes(w)).length;
      return reqWords.length > 0 && exWords.length > 0 && (overlap / Math.min(reqWords.length, exWords.length)) >= 0.5;
    });
    if (!isDupe) unique.push(req);
  }

  if (keyPoints.length === 0) return unique;
  const pointsLower = keyPoints.map(p => p.toLowerCase());
  return unique.filter(req => {
    const reqLower = req.toLowerCase();
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

  // Structured article / headings detection
  if (/\b(?:structured|well-structured|organized)\s*(?:article|post|essay|document|response)\b/i.test(lower)
    || /\b(?:headings?|sections?|subheadings?)\b/i.test(lower)
    || /\beasy to read\b/i.test(lower)) {
    requirements.push('Structured article with headings and sections');
  }

  // Clean / usable UI requirement
  if (/\b(?:clean|usable|good|nice)\s+(?:ui|interface|design)\b/i.test(lower)
    || /\bresponsive\s+(?:in\s+)?ui\b/i.test(lower)
    || /\bui\b/i.test(lower)) {
    requirements.push('Clean and usable UI');
  }

  return requirements;
}

// Fix common acronym/proper noun casing
function fixCasing(text) {
  return text
    .replace(/\bai\b/g, 'AI')
    .replace(/\bapi\b/gi, 'API')
    .replace(/\bapis\b/gi, 'APIs')
    .replace(/\bml\b/gi, 'ML')
    .replace(/\bui\b/gi, 'UI')
    .replace(/\bux\b/gi, 'UX')
    .replace(/\bsql\b/gi, 'SQL')
    .replace(/\bcss\b/gi, 'CSS')
    .replace(/\bhtml\b/gi, 'HTML')
    .replace(/\bjson\b/gi, 'JSON');
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

  if (!task && sections.length <= 1) {
    return fixCasing(cleanedText);
  }

  return fixCasing(sections.join('\n\n'));
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

  // Split: "Include/Add X" in key points → move to requirements (but not "Provide optional..." feature descriptions)
  const promoted = [];
  keyPoints = keyPoints.filter(p => {
    if (/^(Include|Add)\b/i.test(p) || /^Provide\s+(?:a\s+)?(?:clear|relevant|detailed)\b/i.test(p)) {
      if (!outputRequirements.includes(p)) promoted.push(p);
      return false;
    }
    return true;
  });
  outputRequirements = [...outputRequirements, ...promoted];

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
