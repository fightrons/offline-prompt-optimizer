import { scoreDomain } from '../scoring.js';

/**
 * Detects the domain/subject area of a prompt using signal scoring.
 *
 * Delegates to the scoring engine which evaluates weighted signals across
 * 13 domain categories (product, frontend, backend, devops, finance, qa,
 * software, design, education, marketing, healthcare, hr, general)
 * and returns the highest-scoring one.
 *
 * @param {string} text — prompt text (cleaned or raw)
 * @returns {string} — the detected domain
 */
export function detectDomain(text) {
  return scoreDomain(text).winner;
}
