import { describe, it, expect, beforeAll } from 'vitest';
import { computeScores, pickWinner, scoreIntent, scoreDomain, scoreInstructionConfidence, INTENT_SIGNALS, DOMAIN_SIGNALS } from '../optimizer/scoring.js';
import { buildModeOutput } from '../optimizer/builder.js';
import { interpret } from '../optimizer/engine.js';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SCORING ENGINE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeScores', () => {
  it('scores text against all categories in a signal map', () => {
    const signals = {
      a: [{ pattern: /hello/i, weight: 3 }],
      b: [{ pattern: /world/i, weight: 2 }],
    };
    const scores = computeScores('hello world', signals);
    expect(scores.a).toBe(3);
    expect(scores.b).toBe(2);
  });

  it('returns 0 for categories with no matches', () => {
    const signals = {
      a: [{ pattern: /xyz/i, weight: 5 }],
    };
    expect(computeScores('hello', signals).a).toBe(0);
  });

  it('sums multiple matching signals within a category', () => {
    const signals = {
      a: [
        { pattern: /hello/i, weight: 2 },
        { pattern: /world/i, weight: 3 },
      ],
    };
    expect(computeScores('hello world', signals).a).toBe(5);
  });
});

describe('pickWinner', () => {
  it('picks the highest scoring category', () => {
    const result = pickWinner({ a: 5, b: 3, c: 1 });
    expect(result.winner).toBe('a');
    expect(result.score).toBe(5);
  });

  it('uses priority for tiebreaking', () => {
    const result = pickWinner({ a: 5, b: 5 }, 'default', { a: 1, b: 2 });
    expect(result.winner).toBe('b'); // b has higher priority
  });

  it('returns fallback when all scores are 0', () => {
    const result = pickWinner({ a: 0, b: 0 }, 'fallback');
    expect(result.winner).toBe('fallback');
  });

  it('calculates confidence as winner/total', () => {
    const result = pickWinner({ a: 6, b: 2, c: 2 });
    expect(result.confidence).toBe(0.6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. INTENT SCORING TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('scoreIntent', () => {
  it('detects content intent for blog/article prompts', () => {
    expect(scoreIntent('Write a blog post about remote work').winner).toBe('content');
  });

  it('detects workflow intent for multi-step process prompts', () => {
    expect(scoreIntent('Step 1: scrape RSS feeds. Step 2: update Google Sheet column A.').winner).toBe('workflow');
  });

  it('detects analysis intent for data analysis prompts', () => {
    expect(scoreIntent('Analyze the Q3 revenue trends and identify key insights').winner).toBe('analysis');
  });

  it('detects decision intent for prioritization prompts', () => {
    expect(scoreIntent('Prioritize these features based on impact vs effort for our roadmap').winner).toBe('decision');
  });

  it('detects execution intent for send/submit prompts', () => {
    expect(scoreIntent('Send proposals to relevant LinkedIn outreach targets').winner).toBe('execution');
  });

  it('returns generic when no signals match', () => {
    expect(scoreIntent('Hello, how are you today?').winner).toBe('generic');
  });

  it('handles competing intents: content wins over weak analysis', () => {
    // "write an article analyzing" → content (write+article=6) > analysis (analyzing=3)
    const result = scoreIntent('Write an article analyzing the market');
    expect(result.winner).toBe('content');
    expect(result.scores.content).toBeGreaterThan(result.scores.analysis);
  });

  it('handles competing intents: analysis wins tiebreak over content', () => {
    // When scores are equal, analysis (priority 3) beats content (priority 1)
    const result = scoreIntent('Describe the trends');
    // describe=1 (content), trends=2 (analysis) → analysis wins
    expect(result.winner).toBe('analysis');
  });

  it('decision signals are high weight and dominate', () => {
    const result = scoreIntent('We need to evaluate options and create a strategic plan for the roadmap');
    expect(result.winner).toBe('decision');
    expect(result.scores.decision).toBeGreaterThanOrEqual(8);
  });

  it('returns all scores for transparency', () => {
    const result = scoreIntent('Write a blog post');
    expect(result.scores).toHaveProperty('content');
    expect(result.scores).toHaveProperty('workflow');
    expect(result.scores).toHaveProperty('analysis');
    expect(result.scores).toHaveProperty('decision');
    expect(result.scores).toHaveProperty('execution');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DOMAIN SCORING TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('scoreDomain', () => {
  it('detects marketing domain', () => {
    expect(scoreDomain('Improve SEO and lead generation for our funnel').winner).toBe('marketing');
  });

  it('detects finance domain', () => {
    expect(scoreDomain('Analyze Q3 revenue and profit margins').winner).toBe('finance');
  });

  it('detects healthcare domain', () => {
    expect(scoreDomain('Patient diagnosis and treatment planning in hospitals').winner).toBe('healthcare');
  });

  it('detects engineering/software domain', () => {
    expect(scoreDomain('Refactor the codebase architecture and fix the database queries').winner).toBe('software');
  });

  it('detects devops domain', () => {
    expect(scoreDomain('Set up CI/CD with Docker and Kubernetes on AWS').winner).toBe('devops');
  });

  it('detects hr domain', () => {
    expect(scoreDomain('Improve our hiring and onboarding process for new employees').winner).toBe('hr');
  });

  it('detects product domain', () => {
    expect(scoreDomain('Product manager needs to prioritize the backlog for the sprint').winner).toBe('product');
  });

  it('detects frontend domain', () => {
    expect(scoreDomain('Build a responsive React component with Tailwind CSS').winner).toBe('frontend');
  });

  it('returns general when no domain matches', () => {
    expect(scoreDomain('Tell me a joke about penguins').winner).toBe('general');
  });

  it('strips URLs before scoring to avoid false positives', () => {
    // URLs contain domain-like keywords that shouldn't influence scoring
    const result = scoreDomain('Check https://hospital-healthcare.example.com for the document');
    expect(result.scores.healthcare).toBe(0);
  });

  it('handles ambiguous domain with multiple signals', () => {
    // Product + finance signals: product manager + revenue
    const result = scoreDomain('The product manager needs to analyze revenue trends');
    // product: product manager (4) + roadmap-like = high
    expect(result.scores.product).toBeGreaterThan(0);
    expect(result.scores.finance).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. INSTRUCTION CONFIDENCE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('scoreInstructionConfidence', () => {
  it('returns high confidence for instruction-heavy text', () => {
    const text = 'Your task is to: 1. Filter the data. 2. Sort by date. Do not include duplicates. You must validate all entries.';
    const result = scoreInstructionConfidence(text);
    expect(result.hasInstructions).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.15); // above the threshold
  });

  it('returns low confidence for pure context/narrative', () => {
    const text = 'The company was founded in 2010. It has grown rapidly in the healthcare sector.';
    const result = scoreInstructionConfidence(text);
    expect(result.hasInstructions).toBe(false);
    expect(result.confidence).toBeLessThan(0.15);
  });

  it('detects instruction anchors as strong signals', () => {
    const text = 'Now I want you to generate a report.';
    const result = scoreInstructionConfidence(text);
    expect(result.hasInstructions).toBe(true);
    expect(result.rawScore).toBeGreaterThanOrEqual(5);
  });

  it('numbered steps alone have low confidence (no anchor)', () => {
    const text = '1. First step. 2. Second step. 3. Third step.';
    const result = scoreInstructionConfidence(text);
    // Steps are moderate signals but alone don't cross the threshold
    expect(result.rawScore).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThan(0.12);
  });

  it('anchor + constraints cross the threshold', () => {
    const text = 'Follow these steps:\n1. First step\n2. Second step\nDo not skip any. You must validate.';
    const result = scoreInstructionConfidence(text);
    expect(result.hasInstructions).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. MODE-BASED BUILDER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildModeOutput', () => {
  const components = {
    role: 'Test Role',
    task: 'Do the thing',
    steps: ['Step one', 'Step two'],
    constraints: ['Must be fast', 'Avoid errors'],
  };

  it('content mode produces Role + Task + Constraints', () => {
    const output = buildModeOutput('content', components);
    expect(output).toContain('Role: Test Role');
    expect(output).toContain('Task: Do the thing');
    expect(output).toContain('Constraints:');
    expect(output).not.toContain('Objective:');
  });

  it('workflow mode produces Role + Objective + Steps + Guidelines', () => {
    const output = buildModeOutput('workflow', components);
    expect(output).toContain('Role: Test Role');
    expect(output).toContain('Objective: Do the thing');
    expect(output).toContain('Steps:');
    expect(output).toContain('1. Step one');
    expect(output).toContain('Guidelines:');
  });

  it('analysis mode produces Role + Objective + Focus areas', () => {
    const output = buildModeOutput('analysis', components);
    expect(output).toContain('Role: Test Role');
    expect(output).toContain('Objective: Do the thing');
    expect(output).toContain('Focus areas:');
    expect(output).toContain('- Step one');
  });

  it('decision mode produces Role + Objective + Evaluation criteria', () => {
    const comps = {
      role: 'PM',
      task: 'Decide what to build',
      steps: ['Rank by impact', 'Ship top items'],
      constraints: ['Must score by effort'],
    };
    const output = buildModeOutput('decision', comps);
    expect(output).toContain('Objective: Decide what to build');
    expect(output).toContain('Evaluation criteria:');
    // "Rank by impact" contains "impact" → criteria
    expect(output).toMatch(/Evaluation criteria:.*Rank by impact/s);
  });

  it('execution mode produces Role + Objective + Steps + Constraints', () => {
    const output = buildModeOutput('execution', components);
    expect(output).toContain('Objective: Do the thing');
    expect(output).toContain('Steps:');
    expect(output).toContain('1. Step one');
    expect(output).toContain('Constraints:');
    expect(output).toContain('- Must be fast');
  });

  it('falls back to content mode for unknown modes', () => {
    const output = buildModeOutput('unknown', components);
    expect(output).toContain('Task:');
  });

  it('handles empty components gracefully', () => {
    const output = buildModeOutput('content', { role: null, task: null, steps: [], constraints: [] });
    expect(output).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. FULL ENGINE PIPELINE TESTS — 5 INTENT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Engine: interpret()', () => {

  // ─── Content Prompt ──────────────────────────────────────────────────
  it('content: blog writing prompt', () => {
    const result = interpret('Write a detailed blog post about the benefits of remote work for modern companies.');

    expect(result.intent).toBe('content');
    expect(result.task).toBeTruthy();
    expect(result.task.toLowerCase()).toContain('blog post');
    expect(result.output).toContain('Task:');
    expect(result.output).toContain('Role:');
  });

  // ─── Workflow Prompt ─────────────────────────────────────────────────
  it('workflow: RSS-to-spreadsheet pipeline', () => {
    const result = interpret(
      'Set up a daily data pipeline. Step 1: scrape RSS feeds from tech blogs. ' +
      'Step 2: update Google Sheet column A with titles, column B with URLs. ' +
      'Automate this to run on a recurring basis.'
    );

    expect(result.intent).toBe('workflow');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.output).toContain('Objective:');
    expect(result.output).toContain('Steps:');
  });

  // ─── Analysis Prompt ─────────────────────────────────────────────────
  it('analysis: financial trend analysis', () => {
    const result = interpret(
      'Analyze the Q3 revenue trends across all product lines and identify key insights about declining margins.'
    );

    expect(result.intent).toBe('analysis');
    expect(result.task).toBeTruthy();
    expect(result.task.toLowerCase()).toMatch(/analy[zs]e/);
    expect(result.domain).toBe('finance');
    expect(result.output).toContain('Objective:');
  });

  // ─── Decision Prompt ─────────────────────────────────────────────────
  it('decision: product prioritization', () => {
    const result = interpret(
      'Prioritize these 5 product features based on impact vs effort for our Q4 roadmap. ' +
      'We need to evaluate options and present a strategic plan to stakeholders.'
    );

    expect(result.intent).toBe('decision');
    expect(result.domain).toBe('product');
    expect(result.task).toBeTruthy();
    expect(result.output).toContain('Objective:');
  });

  // ─── Execution Prompt (critical) ─────────────────────────────────────
  it('execution: LinkedIn outreach with context separation', () => {
    const prompt = `
LinkedIn is a professional networking platform used for B2B outreach.
Many companies post service requests. Here are some case studies:
- Company A achieved 50% response rate with personalized messages.
- Company B saw 30% conversion through targeted proposals.

Now I want you to send proposals to relevant LinkedIn service requests.
1. Filter requests by industry (tech, finance, healthcare)
2. Personalize each proposal with the company name
3. Submit within 24 hours of the original post
Do not use generic templates. Keep proposals under 300 words.
    `.trim();

    const result = interpret(prompt);

    // Intent must be execution (send + proposals + outreach context)
    expect(result.intent).toBe('execution');

    // Task MUST come from instructions, NOT context
    expect(result.task).toBeTruthy();
    expect(result.task.toLowerCase()).toContain('send proposals');
    expect(result.task.toLowerCase()).not.toContain('case stud');
    expect(result.task.toLowerCase()).not.toContain('networking platform');

    // Instructions detected
    expect(result.hasInstructions).toBe(true);
    expect(result.contextUsed).toBe(false);

    // Steps from instruction block
    expect(result.steps.length).toBeGreaterThanOrEqual(3);

    // Constraints from instruction block
    expect(result.constraints.length).toBeGreaterThanOrEqual(1);
    expect(result.constraints.some(c => /generic templates/i.test(c))).toBe(true);

    // Output format
    expect(result.output).toContain('Objective:');
    expect(result.output).toContain('Steps:');
    expect(result.output).toContain('Constraints:');

    // Scores are transparent
    expect(result.scores.intent).toBeDefined();
    expect(result.scores.domain).toBeDefined();
    expect(result.scores.instructionConfidence).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. EDGE CASE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Engine: edge cases', () => {
  it('empty input returns blank result', () => {
    const result = interpret('');
    expect(result.output).toBe('');
    expect(result.intent).toBe('generic');
    expect(result.domain).toBe('general');
    expect(result.task).toBeNull();
  });

  it('no clear intent defaults to generic', () => {
    const result = interpret('Hello, how are you today?');
    expect(result.intent).toBe('generic');
  });

  it('no instruction anchors → contextUsed is true', () => {
    const result = interpret('Draft an article about cloud computing trends.');
    expect(result.hasInstructions).toBe(false);
    expect(result.contextUsed).toBe(true);
    // Should still extract a task from the full text
    expect(result.task).toBeTruthy();
  });

  it('ambiguous domain returns highest scorer', () => {
    // "patient data in our database" → healthcare (patient) + software (database)
    const result = interpret('Analyze patient data stored in our database');
    expect(result.scores.domain.healthcare).toBeGreaterThan(0);
    expect(result.scores.domain.software).toBeGreaterThan(0);
    // One of them wins
    expect(result.domain).not.toBe('general');
  });

  it('multiple competing intents: highest score wins', () => {
    // Heavy workflow signals + some content signals
    const result = interpret(
      'Scrape RSS feeds daily, update the Google Sheet column A, automate the pipeline. ' +
      'Write a summary at the end.'
    );
    // Workflow should dominate despite "write" being present
    expect(result.scores.intent.workflow).toBeGreaterThan(result.scores.intent.content);
    expect(result.intent).toBe('workflow');
  });

  it('very long prompt with instructions at the end', () => {
    const context = 'Background information about the project. '.repeat(50);
    const instructions = 'Your task is to generate a summary report. 1. List key findings. 2. Rank by importance. Avoid speculation.';
    const result = interpret(context + '\n\n' + instructions);

    expect(result.hasInstructions).toBe(true);
    expect(result.task.toLowerCase()).toContain('summary report');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
  });

  it('context does not pollute task extraction', () => {
    const prompt = `
The healthcare industry uses AI for diagnosis. DeepMind solved protein folding.
IBM Watson is used in oncology. These are fascinating developments.

You need to review the quarterly sales data and identify underperforming regions.
    `.trim();

    const result = interpret(prompt);
    expect(result.hasInstructions).toBe(true);
    // Task must be about sales, NOT healthcare/AI
    expect(result.task.toLowerCase()).toContain('review');
    expect(result.task.toLowerCase()).not.toContain('healthcare');
    expect(result.task.toLowerCase()).not.toContain('deepmind');
  });

  it('instruction confidence scores are normalized 0-1', () => {
    const result = interpret('Your task is to: 1. Do A. 2. Do B. You must validate. Do not skip.');
    expect(result.scores.instructionConfidence).toBeGreaterThanOrEqual(0);
    expect(result.scores.instructionConfidence).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. INTEGRATION: optimizeLocal EXECUTION PATH
// ═══════════════════════════════════════════════════════════════════════════════

describe('optimizeLocal: execution mode integration', () => {
  // This import tests that the execution path in index.js works end-to-end
  let optimizeLocal;
  beforeAll(async () => {
    const mod = await import('../optimizer/index.js');
    optimizeLocal = mod.optimizeLocal;
    // Wait for tiktoken
    await new Promise(r => setTimeout(r, 300));
  });

  it('detects execution intent and produces structured output', () => {
    const input = `
We have been working with LinkedIn clients for years. Our outreach program
has been very successful in the B2B space with a 40% response rate.

Now I want you to send proposals to the top 10 service requests.
1. Filter by tech industry
2. Personalize with company name
3. Submit by end of day
Do not use generic templates.
    `.trim();

    const result = optimizeLocal(input);

    expect(result.changes.some(c => /EXECUTION/i.test(c))).toBe(true);
    expect(result.optimizedPrompt).toContain('Objective:');
    expect(result.optimizedPrompt).toContain('Steps:');
    expect(result.changes.some(c => /execution/i.test(c))).toBe(true);
  });
});
