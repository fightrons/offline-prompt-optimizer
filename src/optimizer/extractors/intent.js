import { scoreIntent } from '../scoring.js';

/**
 * Detects the primary intent of a prompt using signal scoring.
 *
 * Delegates to the scoring engine which evaluates weighted signals across
 * 5 intent categories (content, workflow, analysis, decision, execution)
 * and returns the highest-scoring one.
 *
 * @param {string} text — prompt text (cleaned or raw)
 * @returns {string} — one of: content, workflow, analysis, decision, execution, generic
 */
export function detectIntent(text) {
  return scoreIntent(text).winner;
}
