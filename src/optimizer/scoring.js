/**
 * Signal-Based Scoring Engine
 *
 * Core principle: detect intent, domain, and instruction presence using
 * weighted signal scoring instead of rigid if/else rule chains.
 *
 * Each category has an array of signals: { pattern: RegExp, weight: number }.
 * Text is scored against ALL signals in ALL categories simultaneously.
 * The highest-scoring category wins, with tiebreaking by priority order.
 *
 * Weight scale (1–4):
 *   1 = weak / ambiguous (common words that appear in many contexts)
 *   2 = moderate (relevant but could cross categories)
 *   3 = strong (clear indicator of the category)
 *   4 = definitive (multi-word phrases unique to the category)
 */

// ─── Intent Signal Definitions ───────────────────────────────────────────────
// Each intent maps to signals that indicate the user's primary goal.

export const INTENT_SIGNALS = {
  content: [
    { pattern: /\b(?:write|draft|compose)\b/i, weight: 3 },
    { pattern: /\b(?:blog|article|essay)\b/i, weight: 3 },
    { pattern: /\b(?:create)\b/i, weight: 1 }, // low: "create" appears in non-content contexts too
    { pattern: /\b(?:guide|tutorial|how[- ]?to\s+guide)\b/i, weight: 2 },
    { pattern: /\b(?:generate|produce)\b/i, weight: 2 },
    { pattern: /\b(?:summarize|explain|describe)\b/i, weight: 1 },
    { pattern: /\b(?:post|copy|headline|tagline)\b/i, weight: 2 },
  ],

  workflow: [
    { pattern: /\bstep\s+\d/i, weight: 2 },
    { pattern: /\bcolumn\s+[a-z]/i, weight: 3 },
    { pattern: /\b(?:spreadsheet|excel\s+sheet|google\s+sheet)\b/i, weight: 3 },
    { pattern: /\b(?:scrape|fetch|crawl|update\s+rows|data\s+entry)\b/i, weight: 2 },
    { pattern: /\b(?:rss|xml\s+feed)\b/i, weight: 3 },
    { pattern: /\b(?:daily\s+basis|weekly\s+task|recurring|automate)\b/i, weight: 2 },
    { pattern: /\b(?:pipeline)\b/i, weight: 1 }, // low: ambiguous (CI/CD vs data pipeline)
  ],

  analysis: [
    { pattern: /\b(?:analy[zs]e|analyzing)\b/i, weight: 3 },
    { pattern: /\b(?:trends?)\b/i, weight: 2 },
    { pattern: /\b(?:insights?)\b/i, weight: 3 },
    { pattern: /\b(?:patterns?)\b/i, weight: 1 },
    { pattern: /\b(?:correlation|regression|findings)\b/i, weight: 2 },
    { pattern: /\b(?:data\s+analysis|statistical)\b/i, weight: 3 },
  ],

  decision: [
    { pattern: /\b(?:prioriti[zs]e|prioriti[zs]ation)\b/i, weight: 3 },
    { pattern: /\bimpact.{0,15}effort\b/i, weight: 4 },
    { pattern: /\b(?:roadmap)\b/i, weight: 3 },
    { pattern: /\b(?:evaluate\s+options)\b/i, weight: 4 },
    { pattern: /\b(?:trade[- ]?offs?|tradeoffs?)\b/i, weight: 3 },
    { pattern: /\b(?:strategic\s+plan)\b/i, weight: 4 },
    { pattern: /\bwhat\s+to\s+build\s+next\b/i, weight: 4 },
  ],

  execution: [
    { pattern: /\b(?:send|dispatch)\b/i, weight: 3 },
    { pattern: /\b(?:submit)\b/i, weight: 3 },
    { pattern: /\b(?:apply|applying)\b/i, weight: 2 },
    { pattern: /\b(?:proposals?)\b/i, weight: 3 },
    { pattern: /\b(?:outreach)\b/i, weight: 3 },
    { pattern: /\b(?:deliver|distribute)\b/i, weight: 2 },
    { pattern: /\b(?:forward|escalate)\b/i, weight: 2 },
  ],
};

// Tiebreaker: more specific intents win ties over broader ones
const INTENT_PRIORITY = {
  decision: 5,
  workflow: 4,
  analysis: 3,
  execution: 2,
  content: 1,
};

// ─── Domain Signal Definitions ───────────────────────────────────────────────
// Each domain maps to keywords that indicate the subject area.

export const DOMAIN_SIGNALS = {
  product: [
    { pattern: /\b(?:product\s*manager|pm\s+role)\b/i, weight: 4 },
    { pattern: /\b(?:feature\s*request|backlog|user\s*stories?)\b/i, weight: 3 },
    { pattern: /\b(?:sprint|agile)\b/i, weight: 2 },
    { pattern: /\b(?:roadmap)\b/i, weight: 2 },
    { pattern: /\b(?:stakeholder|requirements?\s+gathering)\b/i, weight: 3 },
    { pattern: /\b(?:mvp|minimum\s+viable)\b/i, weight: 3 },
    { pattern: /\b(?:saas|startup)\b/i, weight: 2 },
    { pattern: /\b(?:user\s+feedback|customer\s+research)\b/i, weight: 2 },
  ],

  frontend: [
    { pattern: /\b(?:react|vue|angular|svelte)\b/i, weight: 3 },
    { pattern: /\b(?:css|html|tailwind)\b/i, weight: 3 },
    { pattern: /\b(?:frontend|front[- ]end)\b/i, weight: 3 },
    { pattern: /\b(?:ui\s*component|responsive)\b/i, weight: 2 },
  ],

  backend: [
    { pattern: /\b(?:node|express|django|flask|fastapi)\b/i, weight: 3 },
    { pattern: /\b(?:graphql|rest\s*api)\b/i, weight: 3 },
    { pattern: /\b(?:backend|back[- ]end)\b/i, weight: 3 },
    { pattern: /\b(?:server|endpoint|microservice)\b/i, weight: 2 },
  ],

  devops: [
    { pattern: /\b(?:docker|kubernetes|k8s)\b/i, weight: 3 },
    { pattern: /\b(?:ci\/?cd|jenkins|github\s*actions|gitlab)\b/i, weight: 3 },
    { pattern: /\b(?:terraform|aws|gcp|azure)\b/i, weight: 2 },
    { pattern: /\b(?:devops)\b/i, weight: 3 },
    { pattern: /\b(?:deploy|pipeline)\b/i, weight: 1 },
  ],

  finance: [
    { pattern: /\b(?:revenue|profit|margin)\b/i, weight: 3 },
    { pattern: /\b(?:pricing|cost|budget)\b/i, weight: 2 },
    { pattern: /\b(?:financial|fiscal|quarterly)\b/i, weight: 3 },
    { pattern: /\b(?:roi|p&l|balance\s+sheet)\b/i, weight: 3 },
    { pattern: /\b(?:investment|portfolio|stock)\b/i, weight: 2 },
  ],

  qa: [
    { pattern: /\b(?:bug|test(?:ing)?)\b/i, weight: 2 },
    { pattern: /\b(?:qa|quality\s*assurance)\b/i, weight: 3 },
    { pattern: /\b(?:unit\s*test|integration\s*test|e2e)\b/i, weight: 3 },
    { pattern: /\b(?:coverage|regression)\b/i, weight: 2 },
  ],

  software: [
    { pattern: /\b(?:code|debug|algorithm|architecture)\b/i, weight: 2 },
    { pattern: /\b(?:system\s*design|refactor)\b/i, weight: 3 },
    { pattern: /\b(?:technical\s*debt|performance|scaling)\b/i, weight: 2 },
    { pattern: /\b(?:database|sql)\b/i, weight: 2 },
    { pattern: /\b(?:api)\b/i, weight: 1 },
  ],

  design: [
    { pattern: /\b(?:figma|sketch|wireframe|prototype)\b/i, weight: 3 },
    { pattern: /\b(?:user\s*experience|ux)\b/i, weight: 3 },
    { pattern: /\b(?:visual\s*design|typography|color\s*palette|layout)\b/i, weight: 2 },
  ],

  education: [
    { pattern: /\b(?:learn|teach|course)\b/i, weight: 2 },
    { pattern: /\b(?:student|curriculum|education)\b/i, weight: 3 },
    { pattern: /\b(?:training|workshop|lesson)\b/i, weight: 2 },
  ],

  marketing: [
    { pattern: /\b(?:seo|sem)\b/i, weight: 3 },
    { pattern: /\b(?:ads?|advertising|campaign)\b/i, weight: 2 },
    { pattern: /\b(?:funnel|leads?|conversion)\b/i, weight: 3 },
    { pattern: /\b(?:brand|branding|content\s*strategy)\b/i, weight: 2 },
    { pattern: /\b(?:social\s*media)\b/i, weight: 2 },
    { pattern: /\b(?:analytics)\b/i, weight: 1 },
  ],

  healthcare: [
    { pattern: /\b(?:patient|diagnosis|treatment)\b/i, weight: 3 },
    { pattern: /\b(?:healthcare|medical|clinical)\b/i, weight: 3 },
    { pattern: /\b(?:hospital|doctor|nurse|physician)\b/i, weight: 2 },
    { pattern: /\b(?:drug|pharmaceutical|therapy)\b/i, weight: 2 },
    { pattern: /\b(?:health|wellness)\b/i, weight: 1 },
  ],

  hr: [
    { pattern: /\b(?:hiring|recruit|talent)\b/i, weight: 3 },
    { pattern: /\b(?:onboarding|employee|workforce)\b/i, weight: 3 },
    { pattern: /\b(?:performance\s+review|compensation|benefits)\b/i, weight: 3 },
    { pattern: /\b(?:hr|human\s+resources)\b/i, weight: 4 },
    { pattern: /\b(?:interview|candidate|resume)\b/i, weight: 2 },
  ],
};

// ─── Instruction Confidence Signals ──────────────────────────────────────────
// Signals that indicate the prompt contains explicit instructions.
// Higher total score = more instruction-like.

export const INSTRUCTION_SIGNALS = [
  // Instruction anchors — strong signals
  { pattern: /\bnow\s+(?:i\s+)?(?:want|need)\s+you\s+to\b/i, weight: 5 },
  { pattern: /\byour\s+task\s+is\b/i, weight: 5 },
  { pattern: /\bfollow\s+these\s+steps\b/i, weight: 5 },
  { pattern: /\bdo\s+the\s+following\b/i, weight: 5 },
  { pattern: /\binstructions?\s*:/i, weight: 5 },
  { pattern: /\byou\s+(?:need|have)\s+to\b/i, weight: 4 },
  { pattern: /\bi\s+(?:need|want)\s+you\s+to\b/i, weight: 4 },
  { pattern: /\btask\s*:/i, weight: 4 },
  { pattern: /\brequirements?\s*:/i, weight: 4 },
  // Numbered steps — moderate signals
  { pattern: /^\s*\d+[.)]\s+/m, weight: 3 },
  { pattern: /\bstep\s+\d+\s*:/i, weight: 3 },
  // Constraint phrases — moderate signals
  { pattern: /\bdo\s+not\b/i, weight: 2 },
  { pattern: /\bmust\b/i, weight: 2 },
  { pattern: /\bavoid\b/i, weight: 1 },
  { pattern: /\bshould\b/i, weight: 1 },
  { pattern: /\bkeep\b/i, weight: 1 },
  // Imperative verbs at sentence/line start — weak signals
  { pattern: /(?:^|\n)\s*(?:send|submit|create|write|analyze|review|generate|filter|identify)\b/im, weight: 2 },
];

// Confidence threshold: if normalized score >= this, treat as instruction-heavy.
// Set at 0.12 because the max possible (sum of all signal weights) is high (~56)
// and a real prompt will never trigger all signals simultaneously.
const INSTRUCTION_THRESHOLD = 0.12;


// ─── Generic Scoring Functions ───────────────────────────────────────────────

/**
 * Scores text against all categories in a signal map.
 *
 * For each category, tests every signal pattern against the text and sums
 * the weights of matching signals. Returns raw scores keyed by category.
 *
 * @param {string} text — the text to score
 * @param {Object<string, Array<{pattern: RegExp, weight: number}>>} signalMap
 * @returns {Object<string, number>} — raw scores per category
 */
export function computeScores(text, signalMap) {
  const scores = {};
  for (const [category, signals] of Object.entries(signalMap)) {
    let total = 0;
    for (const { pattern, weight } of signals) {
      if (pattern.test(text)) {
        total += weight;
      }
    }
    scores[category] = total;
  }
  return scores;
}

/**
 * Picks the winning category from a scores object.
 *
 * When two categories have the same score, the one with higher priority wins.
 * If all scores are 0, returns the fallback category.
 *
 * @param {Object<string, number>} scores — raw scores per category
 * @param {string} fallback — default when all scores are 0
 * @param {Object<string, number>} [priority={}] — tiebreaker priority (higher wins)
 * @returns {{ winner: string, score: number, confidence: number }}
 */
export function pickWinner(scores, fallback = 'generic', priority = {}) {
  const total = Object.values(scores).reduce((sum, s) => sum + s, 0);

  let bestCategory = fallback;
  let bestScore = 0;
  let bestPriority = -1;

  for (const [category, score] of Object.entries(scores)) {
    const p = priority[category] || 0;
    if (score > bestScore || (score === bestScore && score > 0 && p > bestPriority)) {
      bestScore = score;
      bestCategory = category;
      bestPriority = p;
    }
  }

  return {
    winner: bestCategory,
    score: bestScore,
    // Confidence: what fraction of total signal mass belongs to the winner
    confidence: total > 0 ? bestScore / total : 0,
  };
}


// ─── Specific Scoring Functions ──────────────────────────────────────────────

/**
 * Scores text for intent detection.
 * Returns the winning intent, all scores, and confidence.
 *
 * @param {string} text
 * @returns {{ winner: string, scores: Object<string,number>, score: number, confidence: number }}
 */
export function scoreIntent(text) {
  const scores = computeScores(text, INTENT_SIGNALS);
  const result = pickWinner(scores, 'generic', INTENT_PRIORITY);
  return { ...result, scores };
}

/**
 * Scores text for domain detection.
 * Strips URLs before scoring to avoid false positives from link text.
 *
 * @param {string} text
 * @returns {{ winner: string, scores: Object<string,number>, score: number, confidence: number }}
 */
export function scoreDomain(text) {
  const cleaned = text.replace(/https?:\/\/\S+/g, '');
  const scores = computeScores(cleaned, DOMAIN_SIGNALS);
  const result = pickWinner(scores, 'general');
  return { ...result, scores };
}

/**
 * Scores text for instruction confidence.
 *
 * Sums matched signal weights and normalizes against the maximum possible.
 * Returns a confidence value [0, 1] and whether it exceeds the threshold.
 *
 * @param {string} text
 * @returns {{ confidence: number, hasInstructions: boolean, rawScore: number }}
 */
export function scoreInstructionConfidence(text) {
  let rawScore = 0;
  let maxPossible = 0;

  for (const { pattern, weight } of INSTRUCTION_SIGNALS) {
    maxPossible += weight;
    if (pattern.test(text)) {
      rawScore += weight;
    }
  }

  const confidence = maxPossible > 0 ? rawScore / maxPossible : 0;

  return {
    confidence,
    hasInstructions: confidence >= INSTRUCTION_THRESHOLD,
    rawScore,
  };
}
