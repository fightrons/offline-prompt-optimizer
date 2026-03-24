/**
 * Instruction Extraction Layer
 *
 * Solves a critical problem: real-world prompts often contain large amounts of
 * context (background, examples, case studies) with only a small portion of
 * actual instructions. This module separates context from instructions and
 * ensures all extraction prioritizes the instruction block.
 *
 * Priority Rule: when an instruction block exists, task/steps/constraints
 * are extracted ONLY from that block. Context is used solely for domain
 * detection and supporting metadata.
 */

// ─── Instruction Anchor Patterns ─────────────────────────────────────────────
// Each pattern marks where instructions begin inside a prompt.
// Order matters: more specific anchors first to avoid false positives.
const INSTRUCTION_ANCHORS = [
  /\bnow\s+(?:i\s+)?(?:want|need)\s+you\s+to\b/i,
  /\bwhat\s+i\s+(?:want|need)\s+you\s+to\s+do\b/i,
  /\byour\s+task\s+is\b/i,
  /\byou\s+(?:need|have)\s+to\b/i,
  /\bfollow\s+these\s+steps\b/i,
  /\bdo\s+the\s+following\b/i,
  /\bhere(?:'s| is)\s+what\s+(?:i\s+)?(?:want|need)\b/i,
  /\bplease\s+(?:do|perform|complete|execute)\b/i,
  /\bi\s+(?:need|want)\s+you\s+to\b/i,
  /\byour\s+(?:job|goal|objective)\s+is\b/i,
  /\bthe\s+task\s+is\b/i,
  /\binstructions?\s*:/i,
  /\btask\s*:/i,
  /\brequirements?\s*:/i,
];

// ─── Action Verbs ────────────────────────────────────────────────────────────
// Used to identify instruction sentences within the instruction block.
const ACTION_VERB_RE = /\b(write|create|send|generate|submit|review|identify|filter|analyze|build|design|develop|draft|compose|produce|prepare|outline|summarize|explain|describe|translate|convert|transform|rewrite|edit|fix|debug|refactor|optimize|update|evaluate|compare|assess|implement|deploy|configure|test|validate|prioritize|plan|investigate|compile|extract|categorize|sort|calculate|list|recommend|propose|formulate|report|monitor|track|schedule|organize|process|respond|reply|forward|escalate|assign|approve|reject|notify|alert|log)\b/i;

// ─── Constraint Patterns ─────────────────────────────────────────────────────
// Detect constraint phrases within the instruction block.
const CONSTRAINT_PATTERNS = [
  /\bdo\s+not\b.+/i,
  /\bdon['']t\b.+/i,
  /\bavoid\b.+/i,
  /\bkeep\b.+/i,
  /\bmust\b.+/i,
  /\bshould\b.+/i,
  /\bnever\b.+/i,
  /\bensure\b.+/i,
  /\bonly\b.+/i,
  /\bno\s+more\s+than\b.+/i,
  /\blimit\b.+/i,
  /\bexclude\b.+/i,
  /\bdo\s+not\s+include\b.+/i,
  /\bstick\s+to\b.+/i,
  /\bwithin\b.+/i,
];

// ─── Execution Intent Keywords ───────────────────────────────────────────────
const EXECUTION_KEYWORDS = /\b(proposal|send|submit|apply|outreach|deliver|execute|dispatch|forward|distribute)\b/i;


// ─── 1. splitPrompt ─────────────────────────────────────────────────────────
/**
 * Splits a prompt into context and instruction blocks.
 *
 * Scans for the *first* instruction anchor. Everything before it is context;
 * everything from the anchor onward is the instruction block.
 *
 * @param {string} text — raw prompt text
 * @returns {{ context: string, instructions: string, hasInstructions: boolean }}
 */
export function splitPrompt(text) {
  if (!text || !text.trim()) {
    return { context: '', instructions: '', hasInstructions: false };
  }

  let earliestIndex = Infinity;
  let matchLength = 0;

  // Find the earliest instruction anchor in the text
  for (const pattern of INSTRUCTION_ANCHORS) {
    const match = text.match(pattern);
    if (match && match.index < earliestIndex) {
      earliestIndex = match.index;
      matchLength = match[0].length;
    }
  }

  if (earliestIndex === Infinity) {
    // No instruction anchor found — everything is context
    return { context: text.trim(), instructions: '', hasInstructions: false };
  }

  // Split at the anchor. Context = everything before; instructions = anchor + rest.
  const context = text.slice(0, earliestIndex).trim();
  const instructions = text.slice(earliestIndex).trim();

  return {
    context,
    instructions,
    hasInstructions: true,
  };
}


// ─── 2. extractTask ─────────────────────────────────────────────────────────
/**
 * Extracts the core task from the instruction block.
 *
 * Priority rule: if instructions exist, extract ONLY from them.
 * Context is completely ignored for task detection.
 * Falls back to full text only when no instruction block was found.
 *
 * @param {string} instructions — the instruction block (from splitPrompt)
 * @param {string} fallbackText — full prompt text, used only if instructions is empty
 * @returns {string|null} — the extracted task sentence, or null
 */
export function extractTask(instructions, fallbackText) {
  const source = instructions || fallbackText || '';
  if (!source.trim()) return null;

  const sentences = source
    .split(/(?<=[.!?])(?!\d)\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  // Score each sentence: sentences with action verbs rank higher
  let bestSentence = null;
  let bestScore = -1;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    let score = 0;

    // Action verb presence is the primary signal
    if (ACTION_VERB_RE.test(sentence)) {
      score += 10;
    }

    // Imperative form (starts with verb) gets a bonus
    if (/^[A-Z]?[a-z]+\b/.test(sentence) && ACTION_VERB_RE.test(sentence.split(/\s+/)[0])) {
      score += 5;
    }

    // Instruction anchor prefix gets a HIGH bonus — the anchor sentence is almost
    // always the core task, with subsequent sentences being steps or constraints
    for (const anchor of INSTRUCTION_ANCHORS) {
      if (anchor.test(sentence)) {
        score += 20;
        break;
      }
    }

    // Earlier sentences in the instruction block get a positional bonus.
    // The first sentence after an anchor typically IS the task; later ones are steps.
    score += Math.max(0, 5 - i);

    // Penalize numbered items — they are steps, not the main task
    if (/^\d+[.)]\s+/.test(sentence)) score -= 15;

    // Penalize very short or very long sentences
    const wordCount = sentence.split(/\s+/).length;
    if (wordCount < 3) score -= 5;
    if (wordCount > 50) score -= 2;

    // Penalize sentences that look like context (past tense narrative, "for example")
    if (/\bfor\s+example\b/i.test(sentence)) score -= 8;
    if (/\bcase\s+study\b/i.test(sentence)) score -= 8;
    if (/\b(?:last\s+year|in\s+\d{4}|historically|background)\b/i.test(sentence)) score -= 5;

    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  if (!bestSentence) return null;

  // Clean the task: strip leading anchor phrases to get the core instruction
  let task = bestSentence
    .replace(/^(?:now\s+)?(?:i\s+)?(?:want|need)\s+you\s+to\s*/i, '')
    .replace(/^what\s+i\s+(?:want|need)\s+you\s+to\s+do\s+is\s*/i, '')
    .replace(/^your\s+task\s+is\s+(?:to\s+)?/i, '')
    .replace(/^you\s+(?:need|have)\s+to\s*/i, '')
    .replace(/^(?:please\s+)?(?:do|perform|complete|execute)\s*/i, '')
    .replace(/^i\s+(?:need|want)\s+you\s+to\s*/i, '')
    .replace(/^the\s+task\s+is\s+(?:to\s+)?/i, '')
    .replace(/^here(?:'s| is)\s+what\s+(?:i\s+)?(?:want|need)\s*:?\s*/i, '')
    .replace(/^do\s+the\s+following\s*:?\s*/i, '')
    .replace(/^follow\s+these\s+steps\s*:?\s*/i, '')
    .replace(/^instructions?\s*:\s*/i, '')
    .replace(/^task\s*:\s*/i, '')
    .replace(/^requirements?\s*:\s*/i, '')
    .trim();

  // Capitalize first letter
  if (task.length > 0) {
    task = task.charAt(0).toUpperCase() + task.slice(1);
  }

  return task || null;
}


// ─── 3. extractSteps ────────────────────────────────────────────────────────
/**
 * Extracts numbered steps from text.
 * Looks for patterns like "1. ...", "1) ...", "Step 1: ..." etc.
 *
 * @param {string} text — the instruction block to extract steps from
 * @returns {string[]} — array of step descriptions
 */
export function extractSteps(text) {
  if (!text || !text.trim()) return [];

  const steps = [];

  // Pattern 1: "1. ...", "2. ...", "1) ...", "2) ..."
  // Supports both newline-separated and inline (sentence-separated) numbered items
  const numberedPattern = /(?:^|\n|(?<=\.\s))\s*(\d+)[.)]\s+(.+?)(?=\s*\d+[.)]\s|\s*$)/gm;
  let match;
  while ((match = numberedPattern.exec(text)) !== null) {
    const step = match[2].replace(/\.\s*$/, '').trim();
    if (step.length > 3) {
      steps.push(step);
    }
  }

  // Pattern 2: "Step 1: ...", "Step 2: ..." — capture up to next "Step N" or end
  if (steps.length === 0) {
    const stepPattern = /\bstep\s+\d+\s*[:—-]\s*(.+?)(?=\s*\.?\s*step\s+\d|\s*$)/gi;
    while ((match = stepPattern.exec(text)) !== null) {
      const step = match[1].replace(/\.\s*$/, '').trim();
      if (step.length > 3) {
        steps.push(step);
      }
    }
  }

  // Pattern 3: "First, ...", "Second, ...", "Third, ...", "Finally, ..."
  if (steps.length === 0) {
    const ordinalPattern = /\b(first|second|third|fourth|fifth|finally|lastly|then|next|after\s+that)\s*,?\s+(.+?)(?:\.|$)/gim;
    while ((match = ordinalPattern.exec(text)) !== null) {
      const step = match[2].trim();
      if (step.length > 3) {
        steps.push(step);
      }
    }
  }

  return steps;
}


// ─── 4. extractConstraints ──────────────────────────────────────────────────
/**
 * Extracts constraints/restrictions from the instruction block ONLY.
 *
 * Context constraints are intentionally ignored — only constraints
 * stated within the instruction block are authoritative.
 *
 * @param {string} instructions — the instruction block text
 * @returns {string[]} — array of constraint strings
 */
export function extractConstraints(instructions) {
  if (!instructions || !instructions.trim()) return [];

  const constraints = [];
  const sentences = instructions
    .split(/(?<=[.!?])(?!\d)\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  for (const sentence of sentences) {
    for (const pattern of CONSTRAINT_PATTERNS) {
      if (pattern.test(sentence)) {
        // Extract the constraint phrase (the full sentence is the constraint)
        let constraint = sentence.trim();

        // Normalize to start with capital letter
        constraint = constraint.charAt(0).toUpperCase() + constraint.slice(1);

        // Avoid duplicates
        if (!constraints.includes(constraint)) {
          constraints.push(constraint);
        }
        break; // One match per sentence is enough
      }
    }
  }

  return constraints;
}


// ─── 5. detectExecutionIntent ────────────────────────────────────────────────
/**
 * Lightweight intent detection: checks if the prompt implies an execution task
 * (sending, submitting, applying, etc.) vs. analysis or content creation.
 *
 * @param {string} text — full prompt text
 * @returns {'execution'|'other'}
 */
export function detectExecutionIntent(text) {
  if (!text) return 'other';
  return EXECUTION_KEYWORDS.test(text) ? 'execution' : 'other';
}


// ─── 6. extractInstructions (Main Entry Point) ──────────────────────────────
/**
 * Full instruction extraction pipeline.
 *
 * 1. Splits prompt into context vs instructions
 * 2. Extracts task from instructions (or fallback to full text)
 * 3. Extracts steps from instructions only
 * 4. Extracts constraints from instructions only
 * 5. Detects execution intent
 *
 * @param {string} text — raw prompt text
 * @returns {{
 *   task: string|null,
 *   steps: string[],
 *   constraints: string[],
 *   context: string,
 *   instructions: string,
 *   hasInstructions: boolean,
 *   contextUsed: boolean,
 *   intent: 'execution'|'other'
 * }}
 */
export function extractInstructions(text) {
  const { context, instructions, hasInstructions } = splitPrompt(text);

  // Priority rule: extract from instructions when available, fall back to full text
  const task = extractTask(instructions, hasInstructions ? null : text);
  const steps = extractSteps(hasInstructions ? instructions : text);
  const constraints = extractConstraints(hasInstructions ? instructions : text);
  const intent = detectExecutionIntent(text);

  return {
    task,
    steps,
    constraints,
    context,
    instructions,
    hasInstructions,
    contextUsed: !hasInstructions, // true only when no instruction block was found
    intent,
  };
}
