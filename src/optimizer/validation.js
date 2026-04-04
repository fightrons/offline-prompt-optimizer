/**
 * Anti-Pattern Leakage Validation System
 *
 * Core principle: every concept in the output MUST trace back to a phrase
 * in the input. The system must NEVER inject content that the user didn't
 * express — no default key points, no template placeholders, no hallucinated
 * requirements.
 *
 * This module acts as a compiler validation pass: before any concept is
 * emitted to the output, it must pass the input-presence gate.
 *
 * Design:
 *   - Deterministic (no randomness, same input → same output)
 *   - Pure JavaScript, no external libraries
 *   - Conservative: when in doubt, reject the concept
 */


// Stop words excluded from concept matching (too common to be meaningful)
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on', 'by', 'with',
  'and', 'or', 'is', 'are', 'it', 'its', 'this', 'that', 'be',
  'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would',
  'should', 'can', 'could', 'may', 'might', 'shall',
  'not', 'no', 'but', 'if', 'then', 'than', 'so', 'as',
  'at', 'from', 'into', 'up', 'out', 'about', 'all', 'any',
  'each', 'every', 'both', 'more', 'most', 'other', 'some',
  'such', 'only', 'also', 'just', 'very', 'really',
]);


/**
 * Extracts significant words from text (lowercased, stop words removed).
 *
 * @param {string} text
 * @returns {string[]}
 */
function sigWords(text) {
  return text
    .toLowerCase()
    .replace(/[().,;:!?"'`\-–—]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}


/**
 * Validates whether a concept/phrase is grounded in the input text.
 *
 * A concept passes validation if at least `threshold` fraction of its
 * significant words appear somewhere in the input text.
 *
 * @param {string} concept — the output item to validate
 * @param {string} inputText — the original raw input
 * @param {number} [threshold=0.4] — minimum fraction of concept words that must appear in input
 * @returns {boolean} — true if concept is grounded in input
 */
export function validateAgainstInput(concept, inputText, threshold = 0.4) {
  if (!concept || !inputText) return false;

  const conceptWords = sigWords(concept);
  if (conceptWords.length === 0) return true; // nothing to validate

  const inputWords = new Set(sigWords(inputText));

  const matchCount = conceptWords.filter(w => inputWords.has(w)).length;
  const ratio = matchCount / conceptWords.length;

  return ratio >= threshold;
}


/**
 * Traces which input phrase(s) support a given output concept.
 *
 * Returns the first input sentence that shares significant word overlap
 * with the concept, or null if no source is found.
 *
 * @param {string} concept — the output item to trace
 * @param {string} inputText — the original raw input
 * @returns {{ source: string, overlap: number } | null}
 */
export function traceSource(concept, inputText) {
  if (!concept || !inputText) return null;

  const conceptWords = sigWords(concept);
  if (conceptWords.length === 0) return null;

  // Split input into sentences/lines
  const segments = inputText
    .split(/(?<=[.!?])(?!\d)\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 3);

  let bestMatch = null;
  let bestOverlap = 0;

  for (const segment of segments) {
    const segWords = new Set(sigWords(segment));
    const matchCount = conceptWords.filter(w => segWords.has(w)).length;
    const overlap = matchCount / conceptWords.length;

    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = segment;
    }
  }

  if (bestOverlap >= 0.3) {
    return { source: bestMatch, overlap: bestOverlap };
  }

  return null;
}


/**
 * Filters an array of output items, keeping only those grounded in the input.
 *
 * @param {string[]} items — output items to validate
 * @param {string} inputText — the original raw input
 * @param {number} [threshold=0.4] — minimum word overlap ratio
 * @returns {string[]} — only items that trace back to input
 */
export function filterByInputPresence(items, inputText, threshold = 0.4) {
  if (!items || items.length === 0) return [];
  return items.filter(item => validateAgainstInput(item, inputText, threshold));
}


/**
 * Known hallucinated/template concepts that must NEVER appear in output
 * unless their exact phrasing exists in the input.
 *
 * These are hardcoded patterns that the system has historically leaked.
 * Each entry requires a strict input-presence check (threshold = 0.8).
 */
/**
 * Each entry has:
 *   pattern — regex that identifies the concept as a known template
 *   anchors — key words that MUST appear in input for this concept to be allowed
 *             (if ANY anchor word is present, the concept passes)
 */
const BLOCKED_CONCEPTS = [
  { pattern: /\bdefine\s+mvp\s+scope\b/i, anchors: ['mvp', 'minimum viable'] },
  { pattern: /\bvalidation\s+strategy\b/i, anchors: ['validate', 'validation'] },
  { pattern: /\bsaas\s+(?:mvp|planning)\b/i, anchors: ['saas', 'mvp'] },
  { pattern: /\bplan\s+and\s+outline\s+the\s+development\b/i, anchors: ['plan', 'outline', 'development', 'saas', 'mvp'] },
  { pattern: /\binclude\s+relevant\s+statistics\b/i, anchors: ['statistics', 'stats', 'data'] },
  { pattern: /\bprovide\s+a\s+clear\s+conclusion\b/i, anchors: ['conclusion', 'summary', 'wrap'] },
  { pattern: /\boutline\s+development\s+steps\b/i, anchors: ['outline', 'steps', 'plan'] },
  { pattern: /\bsuggest\s+suitable\s+tech\s+stack\b/i, anchors: ['tech stack', 'stack'] },
];


/**
 * Checks whether a concept is a known hallucinated template that should
 * be blocked unless its core words are present in the input.
 *
 * Uses 0.5 threshold: strict enough to catch true hallucinations (e.g.,
 * "Define MVP scope" when input never mentions MVP), but lenient enough
 * to allow legitimate extractions where the input genuinely discusses
 * the concept (e.g., input says "MVP", "validate an idea", "tech stack").
 *
 * @param {string} concept — output item to check
 * @param {string} inputText — original raw input
 * @returns {boolean} — true if concept should be BLOCKED (not emitted)
 */
export function isBlockedConcept(concept, inputText) {
  if (!concept || !inputText) return false;

  const inputLower = inputText.toLowerCase();

  for (const { pattern, anchors } of BLOCKED_CONCEPTS) {
    if (!pattern.test(concept)) continue;

    // This concept matches a known template. Check if ANY anchor word
    // from that template exists in the input — if so, the concept is
    // grounded and should NOT be blocked.
    const hasAnchor = anchors.some(anchor =>
      inputLower.includes(anchor.toLowerCase())
    );

    if (!hasAnchor) return true; // BLOCK: no anchor found in input
  }

  return false; // Not a known template, or anchors found — allow
}
