/**
 * Confidence Scoring & Anti-Pattern Leakage Tests
 *
 * Tests for:
 *   1. Weak signal penalty (hedging language reduces scores)
 *   2. Strong signal boost (explicit directives amplify intent)
 *   3. Gap-based confidence scoring
 *   4. Input validation gate (anti-leakage)
 *   5. End-to-end failure case regression
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  scoreIntent,
  scoreDomain,
  applyWeakSignalPenalty,
  computeConfidence,
} from '../optimizer/scoring.js';
import {
  validateAgainstInput,
  traceSource,
  filterByInputPresence,
  isBlockedConcept,
} from '../optimizer/validation.js';
import { optimizeLocal } from '../optimizer/index.js';
import { interpret } from '../optimizer/engine.js';


// ═══════════════════════════════════════════════════════════════════════════════
// 1. WEAK SIGNAL PENALTY
// ═══════════════════════════════════════════════════════════════════════════════

describe('applyWeakSignalPenalty', () => {
  it('returns 0 for confident text (no hedging)', () => {
    expect(applyWeakSignalPenalty('Analyze the data and prioritize actions')).toBe(0);
  });

  it('penalizes "maybe"', () => {
    expect(applyWeakSignalPenalty('maybe we should analyze this')).toBeGreaterThanOrEqual(1);
  });

  it('penalizes "I think"', () => {
    expect(applyWeakSignalPenalty('I think we need to analyze')).toBeGreaterThanOrEqual(1);
  });

  it('penalizes "not sure" more heavily', () => {
    const penalty = applyWeakSignalPenalty("I'm not sure what to do");
    expect(penalty).toBeGreaterThanOrEqual(2);
  });

  it('accumulates multiple hedging signals', () => {
    const text = "maybe I think we should kind of analyze, or something";
    expect(applyWeakSignalPenalty(text)).toBeGreaterThanOrEqual(3);
  });

  it('counts multiple occurrences of the same signal', () => {
    const text = "maybe this, maybe that, maybe something else";
    expect(applyWeakSignalPenalty(text)).toBeGreaterThanOrEqual(3);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 2. CONFIDENCE SCORING
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeConfidence', () => {
  it('returns high confidence when one intent dominates', () => {
    const result = computeConfidence({ analysis: 10, content: 0, workflow: 0 });
    expect(result.confidence).toBe(1);
    expect(result.level).toBe('high');
  });

  it('returns low confidence when two intents are close', () => {
    const result = computeConfidence({ analysis: 6, decision: 4, content: 0 });
    expect(result.confidence).toBe(0.2);
    expect(result.level).toBe('fallback');
  });

  it('returns fallback when scores are tied', () => {
    const result = computeConfidence({ analysis: 5, decision: 5, content: 0 });
    expect(result.confidence).toBe(0);
    expect(result.level).toBe('fallback');
  });

  it('handles all-zero scores', () => {
    const result = computeConfidence({ a: 0, b: 0 });
    expect(result.confidence).toBe(0);
    expect(result.level).toBe('fallback');
  });

  it('returns moderate gap for clear-but-not-dominant intent', () => {
    const result = computeConfidence({ analysis: 8, decision: 3, content: 1 });
    // gap = (8-3)/12 ≈ 0.42
    expect(result.level).toBe('low');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 3. SCOREINTENT WITH WEAK/STRONG SIGNALS
// ═══════════════════════════════════════════════════════════════════════════════

describe('scoreIntent with weak/strong signals', () => {
  it('weak signals reduce but do not zero out scores', () => {
    const confident = scoreIntent('Analyze the data and find patterns');
    const hedged = scoreIntent('Maybe I think we should kind of analyze the data and find patterns');
    // Both should detect analysis, but hedged should have lower score
    expect(confident.winner).toBe('analysis');
    expect(hedged.winner).toBe('analysis');
    expect(hedged.scores.analysis).toBeLessThan(confident.scores.analysis);
  });

  it('weak signals cannot reduce a score below zero', () => {
    const result = scoreIntent('Maybe I think kind of or something not sure');
    for (const score of Object.values(result.scores)) {
      expect(score).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns weakPenalty in result', () => {
    const result = scoreIntent('maybe we should analyze or something');
    expect(result.weakPenalty).toBeGreaterThanOrEqual(2);
  });

  it('returns gapConfidence in result', () => {
    const result = scoreIntent('Analyze the data and find patterns');
    expect(result.gapConfidence).toBeDefined();
    expect(result.gapConfidence).toHaveProperty('confidence');
    expect(result.gapConfidence).toHaveProperty('level');
  });

  it('strong signal boosts leading intent for explicit directives', () => {
    const withDirective = scoreIntent('What I want is: analyze the data and find patterns');
    const withoutDirective = scoreIntent('analyze the data and find patterns');
    expect(withDirective.scores.analysis).toBeGreaterThanOrEqual(withoutDirective.scores.analysis);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 4. NEW INTENT SIGNALS
// ═══════════════════════════════════════════════════════════════════════════════

describe('new intent signals', () => {
  it('detects "what to do next" as decision signal', () => {
    const result = scoreIntent('tell us what to do next');
    expect(result.scores.decision).toBeGreaterThanOrEqual(3);
  });

  it('detects "what\'s working" as analysis signal', () => {
    const result = scoreIntent("figure out what's working");
    expect(result.scores.analysis).toBeGreaterThanOrEqual(3);
  });

  it('detects "tell us what to do" as decision signal', () => {
    const result = scoreIntent('tell us what to do');
    expect(result.scores.decision).toBeGreaterThanOrEqual(3);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 5. NEW DOMAIN SIGNALS
// ═══════════════════════════════════════════════════════════════════════════════

describe('new domain signals', () => {
  it('detects "marketing" as marketing domain', () => {
    const result = scoreDomain('we have data from marketing and sales');
    expect(result.winner).toBe('marketing');
  });

  it('"marketing" scores weight 3', () => {
    const result = scoreDomain('marketing performance analysis');
    expect(result.scores.marketing).toBeGreaterThanOrEqual(3);
  });

  it('"sales" adds to marketing domain score', () => {
    const result = scoreDomain('sales and marketing data');
    expect(result.scores.marketing).toBeGreaterThanOrEqual(5);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 6. ANTI-PATTERN LEAKAGE — INPUT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateAgainstInput', () => {
  const input = 'We have data from marketing dashboards and need to analyze patterns';

  it('validates concepts present in input', () => {
    expect(validateAgainstInput('Analyze marketing patterns', input)).toBe(true);
  });

  it('rejects concepts not present in input', () => {
    expect(validateAgainstInput('Define MVP scope and core features', input)).toBe(false);
  });

  it('rejects SaaS template when input has no SaaS mentions', () => {
    expect(validateAgainstInput('Plan and outline the development of a small SaaS MVP', input)).toBe(false);
  });

  it('handles empty concept', () => {
    expect(validateAgainstInput('', input)).toBe(false);
  });

  it('handles empty input', () => {
    expect(validateAgainstInput('some concept', '')).toBe(false);
  });
});


describe('traceSource', () => {
  const input = `We have data from dashboards, spreadsheets and tools.
I want to analyze patterns and figure out what's working.
Tell us what to do next.`;

  it('traces analysis concept to input sentence', () => {
    const result = traceSource('Analyze data patterns', input);
    expect(result).not.toBeNull();
    expect(result.source).toContain('analyze patterns');
  });

  it('returns null for concepts not in input', () => {
    expect(traceSource('Define MVP scope', input)).toBeNull();
  });

  it('returns overlap score', () => {
    const result = traceSource('analyze patterns', input);
    expect(result).not.toBeNull();
    expect(result.overlap).toBeGreaterThan(0.3);
  });
});


describe('filterByInputPresence', () => {
  const input = 'Analyze marketing data and identify trends in sales performance';

  it('keeps items grounded in input', () => {
    const items = ['Analyze marketing data', 'Identify sales trends'];
    expect(filterByInputPresence(items, input)).toEqual(items);
  });

  it('removes items not grounded in input', () => {
    const items = ['Analyze marketing data', 'Define MVP scope'];
    const result = filterByInputPresence(items, input);
    expect(result).toContain('Analyze marketing data');
    expect(result).not.toContain('Define MVP scope');
  });

  it('returns empty array for empty input', () => {
    expect(filterByInputPresence(['something'], '')).toEqual([]);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 7. BLOCKED CONCEPT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('isBlockedConcept', () => {
  it('blocks "Define MVP scope" when input has no MVP mention', () => {
    const input = 'we have data from marketing and sales';
    expect(isBlockedConcept('Define MVP scope and core features', input)).toBe(true);
  });

  it('allows "Define MVP scope" when input mentions MVP', () => {
    const input = 'building an MVP to validate an idea';
    expect(isBlockedConcept('Define MVP scope and core features', input)).toBe(false);
  });

  it('blocks "Plan and outline the development of a small SaaS MVP" without SaaS/MVP', () => {
    const input = 'analyze marketing data and find patterns';
    expect(isBlockedConcept('Plan and outline the development of a small SaaS MVP', input)).toBe(true);
  });

  it('allows "Plan and outline" when input mentions SaaS', () => {
    const input = 'I want to build a SaaS product for task management';
    expect(isBlockedConcept('Plan and outline the development of a small SaaS MVP', input)).toBe(false);
  });

  it('blocks "Include relevant statistics" when input has no statistics mention', () => {
    const input = 'analyze patterns and figure out what is working';
    expect(isBlockedConcept('Include relevant statistics', input)).toBe(true);
  });

  it('allows "Include relevant statistics" when input mentions data', () => {
    const input = 'write a blog post and include statistics about remote work';
    expect(isBlockedConcept('Include relevant statistics', input)).toBe(false);
  });

  it('does not block non-template concepts', () => {
    const input = 'analyze marketing data';
    expect(isBlockedConcept('Analyze marketing performance', input)).toBe(false);
  });

  it('blocks "validation strategy" when input has no validate mention', () => {
    const input = 'we need to analyze the sales pipeline';
    expect(isBlockedConcept('Define validation strategy (user feedback, metrics)', input)).toBe(true);
  });

  it('allows "validation strategy" when input mentions validate', () => {
    const input = 'how to validate if people actually want this product';
    expect(isBlockedConcept('Define validation strategy (user feedback, metrics)', input)).toBe(false);
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 8. END-TO-END: FAILURE CASE REGRESSION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Failure Case: Marketing Analysis (Pattern Leakage Regression)', () => {
  const input = `Hey so I don't really know how to explain this properly but basically we've been doing a lot of stuff across marketing, product, sales and it feels like nothing is really working.

We have data from dashboards, spreadsheets and tools and it's confusing what's actually performing.

I was thinking maybe we should build something or maybe just analyze.

What I want is:

* analyze patterns
* figure out what's working
* tell us what to do next

Also don't make it too complicated.`;

  let result;
  beforeAll(async () => {
    await new Promise(r => setTimeout(r, 200));
    result = optimizeLocal(input);
  });

  // --- Intent & Domain ---
  it('detects analysis intent (not content or generic)', () => {
    expect(result.changes).toContain('Detected Intent: ANALYSIS');
  });

  it('detects marketing domain', () => {
    expect(result.changes).toContain('Detected Domain: MARKETING');
  });

  it('infers Marketing analyst role', () => {
    expect(result.optimizedPrompt).toContain('Role: Marketing analyst');
  });

  // --- Anti-Leakage: Must NOT contain ---
  it('does NOT inject "Define MVP scope"', () => {
    expect(result.optimizedPrompt).not.toContain('MVP');
  });

  it('does NOT inject "validation strategy"', () => {
    expect(result.optimizedPrompt).not.toContain('validation strategy');
  });

  it('does NOT inject "SaaS"', () => {
    expect(result.optimizedPrompt).not.toContain('SaaS');
  });

  it('does NOT inject "Include relevant statistics"', () => {
    expect(result.optimizedPrompt).not.toContain('Include relevant statistics');
  });

  it('does NOT inject "Plan and outline the development"', () => {
    expect(result.optimizedPrompt).not.toContain('Plan and outline the development');
  });

  it('does NOT inject "tech stack"', () => {
    expect(result.optimizedPrompt).not.toContain('tech stack');
  });

  // --- Correct extraction ---
  it('extracts "analyze patterns" from bullet list', () => {
    expect(result.optimizedPrompt.toLowerCase()).toContain('analyze patterns');
  });

  it('extracts "what\'s working" from bullet list', () => {
    expect(result.optimizedPrompt.toLowerCase()).toContain("what's working");
  });

  it('extracts "what to do next" from bullet list', () => {
    expect(result.optimizedPrompt.toLowerCase()).toContain('what to do next');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 9. ENGINE INTERPRET — CONFIDENCE AND VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('interpret() with confidence scoring', () => {
  it('returns gapConfidence in result', () => {
    const result = interpret('Analyze the marketing data and find patterns');
    expect(result.gapConfidence).toBeDefined();
    expect(result.gapConfidence).toHaveProperty('confidence');
    expect(result.gapConfidence).toHaveProperty('level');
  });

  it('blocks leaked task in engine output', () => {
    const input = 'we have data from marketing, product, sales. Maybe build something or analyze.';
    const result = interpret(input);
    expect(result.task).not.toMatch(/Plan and outline the development/i);
    expect(result.output).not.toContain('SaaS MVP');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// 10. WEAK SIGNAL vs STRONG SIGNAL PRIORITY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Weak vs Strong signal priority', () => {
  it('"maybe we should build" loses to explicit "analyze patterns"', () => {
    const result = scoreIntent(
      'maybe we should build something. What I want is: analyze patterns, tell us what to do next'
    );
    // "analyze" should beat vague "build" because build is hedged
    expect(result.winner).not.toBe('content');
    expect(['analysis', 'decision']).toContain(result.winner);
  });

  it('explicit imperatives override hedged alternatives', () => {
    const result = scoreIntent(
      'I was thinking maybe we should build something or maybe just analyze. ' +
      'What I want is: analyze patterns, figure out what is working'
    );
    expect(result.scores.analysis).toBeGreaterThan(0);
  });
});
