/**
 * Synthesis Layer
 *
 * Sits between extraction (Layer 5) and output building (Layer 7).
 * Unlike extraction which pulls raw text, synthesis INTERPRETS intent,
 * groups actions, removes noise, and generates clean structured output.
 *
 * Pipeline:
 *   Raw instructions → cleanInstructionText()
 *                    → synthesizeObjective(instructions, intent)
 *                    → extractActionSentences() → normalizeSteps() → dedupeSteps()
 *                    → synthesizeConstraints(instructions)
 *                    → { objective, steps, constraints }
 *
 * Design:
 *   - Deterministic (no randomness, same input → same output)
 *   - Pure JavaScript, no external libraries
 *   - Intent-aware: different intents produce different objective phrasings
 *   - Grouping-aware: similar actions collapse into canonical steps
 */


// ─── Action Verb Families ────────────────────────────────────────────────────
// Verbs grouped by semantic role. Used for sentence detection AND normalization.
const ACTION_VERBS = [
  'open', 'review', 'identify', 'filter', 'write', 'create', 'send',
  'submit', 'share', 'analyze', 'evaluate', 'check', 'update', 'generate',
  'prepare', 'draft', 'compile', 'extract', 'categorize', 'sort',
  'prioritize', 'compare', 'validate', 'approve', 'reject', 'forward',
  'escalate', 'notify', 'monitor', 'track', 'organize', 'process',
  'respond', 'configure', 'deploy', 'test', 'investigate', 'report',
  'schedule', 'assign', 'recommend', 'propose', 'outline', 'summarize',
  'build', 'design', 'implement', 'fix', 'debug', 'refactor', 'optimize',
];

// Regex matching any action verb at word boundary
const ACTION_VERB_RE = new RegExp(
  `\\b(${ACTION_VERBS.join('|')})\\b`, 'i',
);

// ─── Step Normalization Map ──────────────────────────────────────────────────
// Maps raw action patterns to clean, canonical step phrasings.
// Entries are tested in order; first match wins per sentence.
const STEP_NORMALIZATIONS = [
  // Review / input assessment
  { pattern: /\b(?:open|visit|go\s+to|navigate\s+to|access)\b.*(?:page|site|url|link|portal|platform|dashboard)/i, canonical: 'Access the target platform' },
  { pattern: /\b(?:review|read|understand|check|look\s+at|examine)\b.*(?:input|requirement|request|detail|description|brief|spec)/i, canonical: 'Review input requirements' },
  { pattern: /\b(?:review|read|understand|check)\b.*(?:service|offering|capability|portfolio)/i, canonical: 'Review available services' },

  // Filtering / selection
  { pattern: /\b(?:filter|select|pick|choose|narrow\s+down|screen|shortlist)\b.*(?:relevant|matching|appropriate|suitable)/i, canonical: 'Filter for relevant items' },
  { pattern: /\b(?:identify|find|locate|discover|spot)\b.*(?:relevant|matching|opportunity|suitable|appropriate)/i, canonical: 'Identify relevant opportunities' },
  { pattern: /\b(?:understand|assess|determine|evaluate)\b.*(?:service|offering|provide|capability)/i, canonical: 'Assess service relevance' },

  // Creation / drafting
  { pattern: /\b(?:write|draft|compose|create|prepare)\b.*(?:cover\s+letter|proposal|pitch|response|reply|application)/i, canonical: 'Draft a targeted proposal' },
  { pattern: /\b(?:write|draft|compose|create|prepare)\b.*(?:report|summary|document|brief|analysis)/i, canonical: 'Create the output document' },
  { pattern: /\b(?:write|draft|compose|create|generate)\b/i, canonical: 'Create output' },

  // Sharing / approval
  { pattern: /\b(?:share|present|show|send)\b.*(?:approval|review|feedback|sign[- ]?off)/i, canonical: 'Share for approval' },
  { pattern: /\b(?:wait|hold|pause)\b.*(?:approv|confirm|sign[- ]?off|feedback)/i, canonical: 'Await approval' },

  // Submission / delivery
  { pattern: /\b(?:submit|send|deliver|dispatch|forward|post)\b.*(?:final|approved|completed|it\b)/i, canonical: 'Submit final output' },
  { pattern: /\b(?:submit|send|deliver|dispatch|forward|post)\b/i, canonical: 'Submit final output' },

  // Analysis
  { pattern: /\b(?:analyze|analyse)\b.*(?:data|trend|pattern|metric|result|performance)/i, canonical: 'Analyze data for patterns and insights' },
  { pattern: /\b(?:compare|benchmark|contrast)\b/i, canonical: 'Compare against benchmarks' },
  { pattern: /\b(?:extract|pull|gather|collect)\b.*(?:insight|finding|takeaway|conclusion)/i, canonical: 'Extract key insights' },

  // Decision / prioritization
  { pattern: /\b(?:prioriti[zs]e|rank|order|sort)\b.*(?:impact|effort|value|importance)/i, canonical: 'Prioritize by impact and feasibility' },
  { pattern: /\b(?:evaluate|assess|weigh)\b.*(?:option|alternative|approach|trade[- ]?off)/i, canonical: 'Evaluate options and trade-offs' },
  { pattern: /\b(?:recommend|suggest|propose)\b.*(?:action|next\s+step|approach|strategy)/i, canonical: 'Recommend actionable next steps' },
];


// ─── Constraint Patterns ─────────────────────────────────────────────────────
// Regex patterns that signal a constraint sentence.
const CONSTRAINT_SIGNAL_RE = /\b(?:do\s+not|don['']t|avoid|keep\s+it|must\b|should\b|never\b|ensure\b|only\b|limit\b|exclude\b|stick\s+to|within\b|no\s+more\s+than|do\s+not\s+include|do\s+not\s+use)\b/i;


// ─── Objective Templates ─────────────────────────────────────────────────────
// Intent-specific objective generators. Each receives the instruction text
// and returns a synthesized objective string.

const OBJECTIVE_TEMPLATES = {
  execution: (text) => {
    // Proposal / outreach flow
    if (/\b(?:proposals?|outreach|pitch|cover\s+letter)\b/i.test(text) &&
        /\b(?:send|submit|linkedin|service|client|request)\b/i.test(text)) {
      return 'Identify relevant opportunities and create targeted proposals';
    }
    // Application / submission flow
    if (/\b(?:apply|application|submit)\b/i.test(text)) {
      return 'Prepare and submit a targeted application';
    }
    // Delivery / distribution flow
    if (/\b(?:deliver|distribute|forward|dispatch)\b/i.test(text)) {
      return 'Prepare and deliver output to target recipients';
    }
    return 'Execute the specified actions to completion';
  },

  analysis: (text) => {
    if (/\b(?:financial|revenue|cost|budget|pricing)\b/i.test(text)) {
      return 'Analyze financial data to extract actionable insights and patterns';
    }
    if (/\b(?:market|competitor|industry)\b/i.test(text)) {
      return 'Analyze market data to identify trends and opportunities';
    }
    if (/\b(?:performance|metric|kpi)\b/i.test(text)) {
      return 'Analyze performance metrics to surface key findings';
    }
    return 'Analyze data to extract actionable insights and patterns';
  },

  decision: (text) => {
    if (/\b(?:roadmap|what\s+to\s+build)\b/i.test(text)) {
      return 'Evaluate inputs and prioritize initiatives based on impact and feasibility';
    }
    if (/\b(?:hire|candidate|recruit)\b/i.test(text)) {
      return 'Evaluate candidates and prioritize based on fit and impact';
    }
    return 'Evaluate inputs and prioritize actions based on impact and feasibility';
  },

  workflow: (text) => {
    if (/\b(?:rss|feed|scrape|crawl)\b/i.test(text)) {
      return 'Execute a structured workflow to collect and organize information';
    }
    if (/\b(?:automate|recurring|daily|weekly)\b/i.test(text)) {
      return 'Execute a recurring workflow to process and update records';
    }
    return 'Execute a structured workflow to process and organize information';
  },

  content: (text) => {
    if (/\b(?:blog|article|post)\b/i.test(text)) {
      return null; // content intent uses extracted task as-is — no synthesis needed
    }
    return null;
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════════════


// ─── 1. cleanInstructionText ─────────────────────────────────────────────────
/**
 * Strips numbering artifacts, bullet markers, and noise from raw instruction text.
 * This prepares text for sentence-level analysis without losing meaning.
 *
 * @param {string} text — raw instruction text
 * @returns {string} — cleaned text with numbering removed
 */
export function cleanInstructionText(text) {
  if (!text || !text.trim()) return '';

  return text
    // Strip numbered prefixes: "1.", "2.1", "1)", "a)", "- "
    .replace(/^\s*(?:\d+(?:\.\d+)*[.)]\s*|[a-z][.)]\s*|[-–—•]\s*)/gm, '')
    // Strip "Step N:" prefixes
    .replace(/\bstep\s+\d+\s*[:—-]\s*/gi, '')
    // Collapse multiple spaces/newlines
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}


// ─── 2. extractActionSentences ───────────────────────────────────────────────
/**
 * Extracts sentences that contain action verbs from cleaned instruction text.
 * Filters out pure context/narrative sentences that don't carry actions.
 *
 * @param {string} text — cleaned instruction text
 * @returns {string[]} — sentences containing action verbs
 */
export function extractActionSentences(text) {
  if (!text || !text.trim()) return [];

  // Split on sentence boundaries and newlines
  const sentences = text
    .split(/(?<=[.!?])(?!\d)\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  return sentences.filter(sentence => {
    // Must contain an action verb
    if (!ACTION_VERB_RE.test(sentence)) return false;

    // Reject context-like sentences (past tense narrative, examples)
    if (/\b(?:for\s+example|e\.g\.|such\s+as|case\s+study|in\s+\d{4}|historically|background)\b/i.test(sentence)) {
      return false;
    }

    return true;
  });
}


// ─── 3. normalizeSteps ───────────────────────────────────────────────────────
/**
 * Maps action sentences to canonical step phrasings.
 *
 * For each sentence, tests against STEP_NORMALIZATIONS in order.
 * If a pattern matches, the canonical phrasing replaces the raw text.
 * If no pattern matches, the sentence is lightly cleaned and kept as-is.
 *
 * @param {string[]} actionSentences — sentences with action verbs
 * @returns {string[]} — normalized step list
 */
export function normalizeSteps(actionSentences) {
  if (!actionSentences || actionSentences.length === 0) return [];

  return actionSentences.map(sentence => {
    // Try each normalization pattern
    for (const { pattern, canonical } of STEP_NORMALIZATIONS) {
      if (pattern.test(sentence)) {
        return canonical;
      }
    }

    // No pattern matched — clean the sentence minimally:
    // strip leading conjunctions, capitalize, remove trailing noise
    let cleaned = sentence
      .replace(/^(?:and\s+then\s+|and\s+|then\s+|also\s+|next\s+|after\s+that\s*,?\s*)/i, '')
      .replace(/\s*[,;]\s*$/, '')
      .trim();

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned;
  });
}


// ─── 4. dedupeSteps ──────────────────────────────────────────────────────────
/**
 * Removes duplicate steps using exact match + semantic similarity.
 *
 * Two steps are considered duplicates if:
 *   a) They are identical strings (case-insensitive), OR
 *   b) They share >= 60% of their significant words
 *
 * When duplicates are found, the FIRST occurrence is kept (preserves
 * logical ordering from the original prompt).
 *
 * @param {string[]} steps — normalized step list
 * @returns {string[]} — deduplicated steps
 */
export function dedupeSteps(steps) {
  if (!steps || steps.length === 0) return [];

  const seen = [];
  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'by', 'with',
    'and', 'or', 'is', 'are', 'it', 'its', 'this', 'that',
  ]);

  /**
   * Extracts significant words from a step (lowercased, stop words removed).
   */
  function sigWords(text) {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  }

  /**
   * Word overlap ratio between two word sets.
   * Returns the fraction of words in `a` that appear in `b`.
   */
  function overlapRatio(a, b) {
    if (a.length === 0) return 0;
    const setB = new Set(b);
    const shared = a.filter(w => setB.has(w)).length;
    return shared / a.length;
  }

  for (const step of steps) {
    const words = sigWords(step);

    // Check against all already-accepted steps
    const isDuplicate = seen.some(accepted => {
      // Exact match (case-insensitive)
      if (accepted.text.toLowerCase() === step.toLowerCase()) return true;

      // Semantic overlap: if 60%+ of words overlap in either direction, it's a duplicate
      const fwd = overlapRatio(words, accepted.words);
      const bwd = overlapRatio(accepted.words, words);
      return fwd >= 0.6 || bwd >= 0.6;
    });

    if (!isDuplicate) {
      seen.push({ text: step, words });
    }
  }

  return seen.map(s => s.text);
}


// ─── 5. synthesizeObjective ──────────────────────────────────────────────────
/**
 * Generates an intent-appropriate objective from instruction text.
 *
 * Instead of extracting a raw sentence, this function INTERPRETS the intent
 * and generates a clean, purpose-driven objective.
 *
 * For content intent, returns null (the extracted task is sufficient).
 * For all other intents, produces a synthesized objective that captures
 * the high-level goal without raw prompt noise.
 *
 * @param {string} instructions — the instruction block text
 * @param {string} intent — detected intent (content|workflow|analysis|decision|execution)
 * @param {string|null} [extractedTask=null] — fallback task from extraction layer
 * @returns {string|null} — synthesized objective, or null if extraction should be used
 */
export function synthesizeObjective(instructions, intent, extractedTask = null) {
  const text = instructions || '';
  const template = OBJECTIVE_TEMPLATES[intent];

  if (template) {
    const synthesized = template(text);
    if (synthesized) return synthesized;
  }

  // No template match or content intent — fall back to extracted task
  return extractedTask || null;
}


// ─── 6. synthesizeConstraints ────────────────────────────────────────────────
/**
 * Extracts and cleans constraint sentences from instruction text.
 *
 * Goes beyond raw extraction by:
 *   - Stripping numbering artifacts (e.g., "3 Do not..." → "Do not...")
 *   - Normalizing constraint phrasing
 *   - Deduplicating by semantic overlap
 *
 * @param {string} instructions — the instruction block text
 * @returns {string[]} — cleaned, unique constraint list
 */
export function synthesizeConstraints(instructions) {
  if (!instructions || !instructions.trim()) return [];

  const lines = instructions
    .split(/(?<=[.!?])(?!\d)\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  const constraints = [];

  for (const line of lines) {
    if (!CONSTRAINT_SIGNAL_RE.test(line)) continue;

    let cleaned = line
      // Strip leading numbering artifacts: "3 Do not..." → "Do not..."
      .replace(/^\d+(?:\.\d+)*\s+/, '')
      // Strip leading bullet/dash
      .replace(/^[-–—•]\s*/, '')
      .trim();

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // Skip if too short after cleaning
    if (cleaned.length <= 5) continue;

    // Deduplicate: skip if an existing constraint is substantially similar
    const isDuplicate = constraints.some(existing => {
      if (existing.toLowerCase() === cleaned.toLowerCase()) return true;

      // Word-level overlap check
      const eWords = existing.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const cWords = cleaned.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      if (eWords.length === 0 || cWords.length === 0) return false;

      const setE = new Set(eWords);
      const shared = cWords.filter(w => setE.has(w)).length;
      return shared / Math.max(eWords.length, cWords.length) >= 0.6;
    });

    if (!isDuplicate) {
      constraints.push(cleaned);
    }
  }

  return constraints;
}


// ─── 7. synthesizeOutput (Main Entry Point) ──────────────────────────────────
/**
 * Full synthesis pipeline: converts raw instruction text into clean,
 * intent-aware structured components.
 *
 * This is NOT parsing. This is controlled synthesis:
 *   1. Clean the instruction text (strip numbering, noise)
 *   2. Synthesize an intent-appropriate objective
 *   3. Extract action sentences → normalize → deduplicate → steps
 *   4. Synthesize clean, unique constraints
 *
 * @param {string} instructions — the raw instruction block
 * @param {string} intent — detected intent (content|workflow|analysis|decision|execution)
 * @param {string|null} [extractedTask=null] — fallback task from the extraction layer
 * @returns {{ objective: string|null, steps: string[], constraints: string[] }}
 */
export function synthesizeOutput(instructions, intent, extractedTask = null) {
  // Step 1: Clean instruction text
  const cleaned = cleanInstructionText(instructions || '');

  // Step 2: Synthesize objective
  const objective = synthesizeObjective(instructions, intent, extractedTask);

  // Step 3: Extract action sentences → normalize → deduplicate
  const actionSentences = extractActionSentences(cleaned);
  const normalized = normalizeSteps(actionSentences);
  const steps = dedupeSteps(normalized);

  // Step 4: Synthesize constraints
  const constraints = synthesizeConstraints(instructions || '');

  return { objective, steps, constraints };
}
