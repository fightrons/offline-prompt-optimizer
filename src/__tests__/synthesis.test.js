import { describe, it, expect } from 'vitest';
import {
  cleanInstructionText,
  extractActionSentences,
  normalizeSteps,
  dedupeSteps,
  synthesizeObjective,
  synthesizeConstraints,
  synthesizeOutput,
} from '../optimizer/synthesis.js';

// ─── cleanInstructionText ────────────────────────────────────────────────────

describe('cleanInstructionText', () => {
  it('strips numbered prefixes (dot format)', () => {
    const result = cleanInstructionText('1. Open the page\n2. Review the data\n3. Submit');
    expect(result).not.toMatch(/^\d+\./m);
    expect(result).toContain('Open the page');
    expect(result).toContain('Review the data');
  });

  it('strips numbered prefixes (paren format)', () => {
    const result = cleanInstructionText('1) Filter data\n2) Sort results');
    expect(result).not.toMatch(/^\d+\)/m);
    expect(result).toContain('Filter data');
  });

  it('strips "Step N:" prefixes', () => {
    const result = cleanInstructionText('Step 1: Collect data. Step 2: Analyze.');
    expect(result).not.toMatch(/step\s+\d+\s*:/i);
    expect(result).toContain('Collect data');
  });

  it('strips bullet markers', () => {
    const result = cleanInstructionText('- Keep it short\n- Avoid jargon');
    expect(result).not.toMatch(/^-/m);
    expect(result).toContain('Keep it short');
  });

  it('strips sub-numbered items (2.1 format)', () => {
    const result = cleanInstructionText('2.1 Do thing A\n2.2 Do thing B');
    expect(result).not.toMatch(/^\d+\.\d+/m);
  });

  it('returns empty string for null/empty input', () => {
    expect(cleanInstructionText('')).toBe('');
    expect(cleanInstructionText(null)).toBe('');
  });
});

// ─── extractActionSentences ──────────────────────────────────────────────────

describe('extractActionSentences', () => {
  it('extracts sentences with action verbs', () => {
    const text = 'Open the page. The weather is nice. Review the requirements. Submit the form.';
    const result = extractActionSentences(text);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.some(s => /open/i.test(s))).toBe(true);
    expect(result.some(s => /review/i.test(s))).toBe(true);
    expect(result.some(s => /submit/i.test(s))).toBe(true);
  });

  it('rejects context/narrative sentences', () => {
    const text = 'For example, see the 2020 case study. Filter the relevant items.';
    const result = extractActionSentences(text);
    expect(result.some(s => /case study/i.test(s))).toBe(false);
    expect(result.some(s => /filter/i.test(s))).toBe(true);
  });

  it('rejects sentences without action verbs', () => {
    const text = 'The company is growing fast. Revenue increased by 40%.';
    const result = extractActionSentences(text);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(extractActionSentences('')).toEqual([]);
    expect(extractActionSentences(null)).toEqual([]);
  });
});

// ─── normalizeSteps ──────────────────────────────────────────────────────────

describe('normalizeSteps', () => {
  it('normalizes "open the page" to platform access', () => {
    const result = normalizeSteps(['Open this page https://linkedin.com/service-marketplace']);
    expect(result[0]).toBe('Access the target platform');
  });

  it('normalizes "write a cover letter" to draft proposal', () => {
    const result = normalizeSteps(['Write the cover letter for the client']);
    expect(result[0]).toBe('Draft a targeted proposal');
  });

  it('normalizes "share for approval" correctly', () => {
    const result = normalizeSteps(['Share it with me for approval along with details']);
    expect(result[0]).toBe('Share for approval');
  });

  it('normalizes "submit it" to submit final output', () => {
    const result = normalizeSteps(['Submit it once approved']);
    expect(result[0]).toBe('Submit final output');
  });

  it('normalizes "filter relevant services" correctly', () => {
    const result = normalizeSteps(['Filter requests to find relevant services only']);
    expect(result[0]).toBe('Filter for relevant items');
  });

  it('normalizes analysis steps', () => {
    const result = normalizeSteps(['Analyze the financial data for trends']);
    expect(result[0]).toBe('Analyze data for patterns and insights');
  });

  it('normalizes decision steps', () => {
    const result = normalizeSteps(['Prioritize features by impact and effort']);
    expect(result[0]).toBe('Prioritize by impact and feasibility');
  });

  it('keeps unrecognized sentences cleaned up', () => {
    const result = normalizeSteps(['and then do the special thing nobody expected']);
    // Should strip "and then", capitalize
    expect(result[0]).toMatch(/^Do/i);
    expect(result[0]).not.toMatch(/^and\s+then/i);
  });

  it('returns empty for empty input', () => {
    expect(normalizeSteps([])).toEqual([]);
    expect(normalizeSteps(null)).toEqual([]);
  });
});

// ─── dedupeSteps ─────────────────────────────────────────────────────────────

describe('dedupeSteps', () => {
  it('removes exact duplicates', () => {
    const result = dedupeSteps([
      'Filter for relevant items',
      'Filter for relevant items',
      'Submit final output',
    ]);
    expect(result).toHaveLength(2);
  });

  it('removes semantic duplicates (high word overlap)', () => {
    const result = dedupeSteps([
      'Filter for relevant items',
      'Filter relevant items from the list',
      'Submit final output',
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('Filter for relevant items'); // first occurrence kept
  });

  it('keeps semantically different steps', () => {
    const result = dedupeSteps([
      'Access the target platform',
      'Filter for relevant items',
      'Draft a targeted proposal',
      'Share for approval',
      'Submit final output',
    ]);
    expect(result).toHaveLength(5);
  });

  it('returns empty for empty input', () => {
    expect(dedupeSteps([])).toEqual([]);
  });
});

// ─── synthesizeObjective ─────────────────────────────────────────────────────

describe('synthesizeObjective', () => {
  it('generates proposal objective for execution + proposal/linkedin signals', () => {
    const text = 'Send proposals to relevant LinkedIn service requests';
    const result = synthesizeObjective(text, 'execution');
    expect(result).toBe('Identify relevant opportunities and create targeted proposals');
  });

  it('generates application objective for execution + apply signals', () => {
    const result = synthesizeObjective('Apply to the open position', 'execution');
    expect(result).toBe('Prepare and submit a targeted application');
  });

  it('generates delivery objective for execution + deliver signals', () => {
    const result = synthesizeObjective('Deliver the final report to the client', 'execution');
    expect(result).toBe('Prepare and deliver output to target recipients');
  });

  it('generates fallback execution objective', () => {
    const result = synthesizeObjective('Do the thing now', 'execution');
    expect(result).toBe('Execute the specified actions to completion');
  });

  it('generates financial analysis objective', () => {
    const result = synthesizeObjective('Analyze the revenue data', 'analysis');
    expect(result).toBe('Analyze financial data to extract actionable insights and patterns');
  });

  it('generates generic analysis objective', () => {
    const result = synthesizeObjective('Analyze the dataset', 'analysis');
    expect(result).toBe('Analyze data to extract actionable insights and patterns');
  });

  it('generates market analysis objective', () => {
    const result = synthesizeObjective('Analyze competitor trends in the market', 'analysis');
    expect(result).toBe('Analyze market data to identify trends and opportunities');
  });

  it('generates roadmap decision objective', () => {
    const result = synthesizeObjective('Decide what to build on the roadmap', 'decision');
    expect(result).toBe('Evaluate inputs and prioritize initiatives based on impact and feasibility');
  });

  it('generates generic decision objective', () => {
    const result = synthesizeObjective('Decide which approach to take', 'decision');
    expect(result).toBe('Evaluate inputs and prioritize actions based on impact and feasibility');
  });

  it('generates RSS workflow objective', () => {
    const result = synthesizeObjective('Scrape RSS feeds and organize results', 'workflow');
    expect(result).toBe('Execute a structured workflow to collect and organize information');
  });

  it('generates recurring workflow objective', () => {
    const result = synthesizeObjective('Automate the daily data entry process', 'workflow');
    expect(result).toBe('Execute a recurring workflow to process and update records');
  });

  it('returns null for content intent (uses extracted task)', () => {
    const result = synthesizeObjective('Write a blog post about AI', 'content');
    expect(result).toBeNull();
  });

  it('falls back to extractedTask when no template matches', () => {
    const result = synthesizeObjective('Write a blog post', 'content', 'Write a blog post about AI');
    expect(result).toBe('Write a blog post about AI');
  });

  it('still generates objective for empty instructions when intent has a template', () => {
    // Execution intent always produces an objective (fallback template fires)
    expect(synthesizeObjective('', 'execution', null)).toBe('Execute the specified actions to completion');
    expect(synthesizeObjective(null, 'execution', null)).toBe('Execute the specified actions to completion');
  });

  it('returns null for empty input with content intent and no fallback', () => {
    expect(synthesizeObjective('', 'content', null)).toBeNull();
    expect(synthesizeObjective(null, 'content', null)).toBeNull();
  });
});

// ─── synthesizeConstraints ───────────────────────────────────────────────────

describe('synthesizeConstraints', () => {
  it('extracts and cleans "do not" constraints', () => {
    const text = 'Do not create a long cover letter. Keep it under 300 words.';
    const result = synthesizeConstraints(text);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some(c => /do not/i.test(c))).toBe(true);
    expect(result.some(c => /keep/i.test(c))).toBe(true);
  });

  it('strips leading numbering artifacts', () => {
    const text = '3 Do not use generic templates. 5 Avoid technical jargon.';
    const result = synthesizeConstraints(text);
    // Should NOT start with "3 Do not" — number stripped
    for (const c of result) {
      expect(c).not.toMatch(/^\d+\s/);
    }
    expect(result.some(c => /^Do not/i.test(c))).toBe(true);
    expect(result.some(c => /^Avoid/i.test(c))).toBe(true);
  });

  it('deduplicates similar constraints', () => {
    const text = 'Do not use long sentences. Do not create long sentences. Keep it short.';
    const result = synthesizeConstraints(text);
    // The two "long sentences" constraints should collapse
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('handles "don\'t" contractions', () => {
    const text = "Don't use hyphen signs. Don't talk about designations.";
    const result = synthesizeConstraints(text);
    expect(result).toHaveLength(2);
  });

  it('extracts "must" and "should" constraints', () => {
    const text = 'Must include metrics. Should be professional.';
    const result = synthesizeConstraints(text);
    expect(result.some(c => /must/i.test(c))).toBe(true);
    expect(result.some(c => /should/i.test(c))).toBe(true);
  });

  it('extracts "avoid" and "never" constraints', () => {
    const text = 'Avoid generic language. Never mention competitors.';
    const result = synthesizeConstraints(text);
    expect(result.some(c => /avoid/i.test(c))).toBe(true);
    expect(result.some(c => /never/i.test(c))).toBe(true);
  });

  it('returns empty for no constraints', () => {
    expect(synthesizeConstraints('Open the page and submit.')).toEqual([]);
  });

  it('returns empty for empty/null input', () => {
    expect(synthesizeConstraints('')).toEqual([]);
    expect(synthesizeConstraints(null)).toEqual([]);
  });
});

// ─── synthesizeOutput (full pipeline) ────────────────────────────────────────

describe('synthesizeOutput', () => {
  const LINKEDIN_PROMPT = `
Now I want you to send proposals to relevant LinkedIn service requests.
1. Open this page https://www.linkedin.com/service-marketplace/provider/requests/
2. Understand the services which we provide and only send proposals to relevant services
3. Once you write the cover letter, share it with me for approval along with the client requirement details and the cover letter you wrote
4. Once I approve, submit it
Do not create a long cover letter, keep it a 1 min read.
5 If we don't have a relevant case study, keep the context of the case study generic and add metrics about what we have achieved.
6 Don't use hyphen sign.
9 Do not talk about the person's designation and company-related things.
Keep it to the point.
  `.trim();

  it('synthesizes correct objective for execution + linkedin proposal', () => {
    const result = synthesizeOutput(LINKEDIN_PROMPT, 'execution');
    expect(result.objective).toBe('Identify relevant opportunities and create targeted proposals');
  });

  it('produces deduplicated steps', () => {
    const result = synthesizeOutput(LINKEDIN_PROMPT, 'execution');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    // No two steps should be identical
    const unique = new Set(result.steps);
    expect(unique.size).toBe(result.steps.length);
  });

  it('extracts constraints with numbering stripped', () => {
    const result = synthesizeOutput(LINKEDIN_PROMPT, 'execution');
    expect(result.constraints.length).toBeGreaterThanOrEqual(3);
    // No constraint should start with a bare number
    for (const c of result.constraints) {
      expect(c).not.toMatch(/^\d+\s/);
    }
  });

  it('handles analysis intent correctly', () => {
    const instructions = 'Analyze the quarterly revenue data. Identify trends. Compare Q3 vs Q4. Avoid speculation. Must use actual numbers.';
    const result = synthesizeOutput(instructions, 'analysis');
    expect(result.objective).toContain('financial');
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.constraints.length).toBeGreaterThanOrEqual(2);
  });

  it('handles decision intent correctly', () => {
    const instructions = 'Evaluate what to build on the roadmap. Prioritize by impact and effort. Recommend next steps.';
    const result = synthesizeOutput(instructions, 'decision');
    expect(result.objective).toContain('prioritize');
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
  });

  it('handles workflow intent correctly', () => {
    const instructions = 'Scrape RSS feeds daily. Update the Google Sheet with new entries. Filter duplicates.';
    const result = synthesizeOutput(instructions, 'workflow');
    expect(result.objective).toContain('workflow');
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
  });

  it('falls back to extracted task for content intent', () => {
    const result = synthesizeOutput('Write a blog post about remote work.', 'content', 'Write a blog post about remote work');
    expect(result.objective).toBe('Write a blog post about remote work');
  });

  it('handles empty input gracefully', () => {
    const result = synthesizeOutput('', 'execution');
    expect(result.objective).toBe('Execute the specified actions to completion');
    expect(result.steps).toEqual([]);
    expect(result.constraints).toEqual([]);
  });

  it('handles null input gracefully', () => {
    const result = synthesizeOutput(null, 'content');
    expect(result.objective).toBeNull();
    expect(result.steps).toEqual([]);
    expect(result.constraints).toEqual([]);
  });
});
