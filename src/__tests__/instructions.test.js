import { describe, it, expect } from 'vitest';
import {
  splitPrompt,
  extractTask,
  extractSteps,
  extractConstraints,
  detectExecutionIntent,
  extractInstructions,
} from '../optimizer/extractors/instructions.js';

// ─── splitPrompt ─────────────────────────────────────────────────────────────

describe('splitPrompt', () => {
  it('splits on "Now I want you to"', () => {
    const text = 'Here is some background about LinkedIn.\n\nNow I want you to send proposals to relevant service requests.';
    const result = splitPrompt(text);
    expect(result.hasInstructions).toBe(true);
    expect(result.context).toContain('background about LinkedIn');
    expect(result.instructions).toContain('send proposals');
  });

  it('splits on "Your task is"', () => {
    const text = 'Company X has been growing rapidly. Your task is to analyze their financial data and create a report.';
    const result = splitPrompt(text);
    expect(result.hasInstructions).toBe(true);
    expect(result.context).toContain('Company X');
    expect(result.instructions).toContain('analyze their financial data');
  });

  it('splits on "Follow these steps"', () => {
    const text = 'We have a database of users. Follow these steps: 1. Export the data. 2. Clean duplicates.';
    const result = splitPrompt(text);
    expect(result.hasInstructions).toBe(true);
    expect(result.instructions).toContain('1. Export the data');
  });

  it('splits on "Do the following"', () => {
    const text = 'Background info here. Do the following: review each entry and flag errors.';
    const result = splitPrompt(text);
    expect(result.hasInstructions).toBe(true);
    expect(result.instructions).toContain('review each entry');
  });

  it('returns entire text as context when no anchor is found', () => {
    const text = 'The weather in Paris is lovely this time of year and the food is excellent.';
    const result = splitPrompt(text);
    expect(result.hasInstructions).toBe(false);
    expect(result.context).toBe(text.trim());
    expect(result.instructions).toBe('');
  });

  it('handles empty input', () => {
    const result = splitPrompt('');
    expect(result.hasInstructions).toBe(false);
    expect(result.context).toBe('');
  });

  it('uses the earliest anchor when multiple exist', () => {
    const text = 'Context here. You need to do A. Your task is to do B.';
    const result = splitPrompt(text);
    expect(result.hasInstructions).toBe(true);
    // "You need to" appears before "Your task is"
    expect(result.instructions).toContain('You need to do A');
  });
});

// ─── extractTask ─────────────────────────────────────────────────────────────

describe('extractTask', () => {
  it('extracts task from instruction block with action verb', () => {
    const instructions = 'Now I want you to send proposals to relevant LinkedIn service requests. Do not include pricing.';
    const task = extractTask(instructions, '');
    expect(task).toBeTruthy();
    expect(task.toLowerCase()).toContain('send proposals');
  });

  it('extracts task from instructions and ignores fallback', () => {
    const instructions = 'Your task is to write a summary of the findings.';
    const fallback = 'This is a long case study about market trends and data points from 2020.';
    const task = extractTask(instructions, fallback);
    expect(task.toLowerCase()).toContain('summary');
    expect(task.toLowerCase()).not.toContain('case study');
  });

  it('falls back to full text when instructions are empty', () => {
    const task = extractTask('', 'Create a dashboard for sales metrics.');
    expect(task).toBeTruthy();
    expect(task.toLowerCase()).toContain('dashboard');
  });

  it('returns null for empty input', () => {
    expect(extractTask('', '')).toBeNull();
  });

  it('strips instruction anchor prefixes from the task', () => {
    const task = extractTask('Your task is to generate a weekly report.', '');
    expect(task).not.toMatch(/^your task is/i);
    expect(task.toLowerCase()).toContain('generate a weekly report');
  });

  it('penalizes context-like sentences', () => {
    const instructions = 'For example, see the 2020 case study. Generate the final output as a CSV file.';
    const task = extractTask(instructions, '');
    expect(task.toLowerCase()).toContain('generate');
    expect(task.toLowerCase()).not.toContain('case study');
  });
});

// ─── extractSteps ────────────────────────────────────────────────────────────

describe('extractSteps', () => {
  it('extracts numbered steps with dot format', () => {
    const text = '1. Open the file\n2. Read the contents\n3. Process each line';
    const steps = extractSteps(text);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain('Open the file');
    expect(steps[2]).toContain('Process each line');
  });

  it('extracts numbered steps with paren format', () => {
    const text = '1) Filter the data\n2) Sort by date\n3) Export results';
    const steps = extractSteps(text);
    expect(steps).toHaveLength(3);
  });

  it('extracts "Step N:" format', () => {
    const text = 'Step 1: Collect data. Step 2: Analyze trends. Step 3: Write report.';
    const steps = extractSteps(text);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain('Collect data');
  });

  it('extracts ordinal steps (first, second, ...)', () => {
    const text = 'First, review the document. Second, highlight errors. Finally, submit corrections.';
    const steps = extractSteps(text);
    expect(steps.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array when no steps found', () => {
    const steps = extractSteps('Just do the thing.');
    expect(steps).toEqual([]);
  });

  it('handles empty input', () => {
    expect(extractSteps('')).toEqual([]);
  });
});

// ─── extractConstraints ──────────────────────────────────────────────────────

describe('extractConstraints', () => {
  it('extracts "do not" constraints', () => {
    const text = 'Send the email. Do not include any attachments. Keep it under 200 words.';
    const constraints = extractConstraints(text);
    expect(constraints.length).toBeGreaterThanOrEqual(2);
    expect(constraints.some(c => /do not include/i.test(c))).toBe(true);
    expect(constraints.some(c => /keep/i.test(c))).toBe(true);
  });

  it('extracts "avoid" constraints', () => {
    const text = 'Write the article. Avoid technical jargon.';
    const constraints = extractConstraints(text);
    expect(constraints.some(c => /avoid/i.test(c))).toBe(true);
  });

  it('extracts "must" constraints', () => {
    const text = 'The response must be in JSON format.';
    const constraints = extractConstraints(text);
    expect(constraints.some(c => /must/i.test(c))).toBe(true);
  });

  it('returns empty array when no constraints found', () => {
    expect(extractConstraints('Send the report.')).toEqual([]);
  });

  it('handles empty input', () => {
    expect(extractConstraints('')).toEqual([]);
  });
});

// ─── detectExecutionIntent ───────────────────────────────────────────────────

describe('detectExecutionIntent', () => {
  it('detects execution intent from "send"', () => {
    expect(detectExecutionIntent('Send proposals to clients')).toBe('execution');
  });

  it('detects execution intent from "submit"', () => {
    expect(detectExecutionIntent('Submit the application')).toBe('execution');
  });

  it('detects execution intent from "proposal"', () => {
    expect(detectExecutionIntent('Write a proposal for the project')).toBe('execution');
  });

  it('returns "other" for non-execution text', () => {
    expect(detectExecutionIntent('Write a blog post about cats')).toBe('other');
  });

  it('handles null/empty input', () => {
    expect(detectExecutionIntent('')).toBe('other');
    expect(detectExecutionIntent(null)).toBe('other');
  });
});

// ─── extractInstructions (full pipeline) ─────────────────────────────────────

describe('extractInstructions', () => {
  it('full pipeline: long context + instructions at the end', () => {
    const prompt = `
LinkedIn is a professional networking platform where businesses post service requests.
Many companies use it for B2B outreach. Here are some examples of successful outreach campaigns:
- Campaign A: 50% response rate
- Campaign B: 30% conversion

There are several case studies showing the effectiveness of personalized messaging.
In 2023, the average response rate for cold outreach was 12%.

Now I want you to send proposals to relevant LinkedIn service requests.
1. Filter requests by industry (tech, finance, healthcare)
2. Personalize each proposal with the company name
3. Submit within 24 hours of the original post
Do not use generic templates. Keep proposals under 300 words.
    `.trim();

    const result = extractInstructions(prompt);

    // Must detect instruction block
    expect(result.hasInstructions).toBe(true);
    expect(result.contextUsed).toBe(false);

    // Task must come from instructions, not context
    expect(result.task).toBeTruthy();
    expect(result.task.toLowerCase()).toContain('send proposals');
    expect(result.task.toLowerCase()).not.toContain('case stud');
    expect(result.task.toLowerCase()).not.toContain('networking platform');

    // Steps from instruction block
    expect(result.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.steps[0].toLowerCase()).toContain('filter');

    // Constraints from instruction block only
    expect(result.constraints.length).toBeGreaterThanOrEqual(1);
    expect(result.constraints.some(c => /generic templates/i.test(c))).toBe(true);

    // Execution intent
    expect(result.intent).toBe('execution');
  });

  it('no instruction block: extracts from full text as fallback', () => {
    const prompt = 'Write a blog post about the benefits of remote work.';
    const result = extractInstructions(prompt);

    expect(result.hasInstructions).toBe(false);
    expect(result.contextUsed).toBe(true);
    expect(result.task).toBeTruthy();
    expect(result.task.toLowerCase()).toContain('blog post');
  });

  it('context does not pollute task when instruction block exists', () => {
    const prompt = `
The healthcare industry has been rapidly adopting AI. Machine learning models are used
for diagnosis, treatment planning, and drug discovery. For example, DeepMind's AlphaFold
solved protein folding. Another case study involves IBM Watson in oncology.

Your task is to review the quarterly sales data and identify trends.
    `.trim();

    const result = extractInstructions(prompt);
    expect(result.hasInstructions).toBe(true);
    expect(result.task.toLowerCase()).toContain('review');
    // Must NOT extract healthcare/AI topics from context
    expect(result.task.toLowerCase()).not.toContain('healthcare');
    expect(result.task.toLowerCase()).not.toContain('deepmind');
    expect(result.task.toLowerCase()).not.toContain('alphafold');
  });

  it('handles very long prompts with instructions at the end', () => {
    // Simulate a long prompt (repeated context paragraphs)
    const contextParagraph = 'This is background information about the project. It contains many details about the history and evolution of the system. Various stakeholders have contributed feedback over the years. ';
    const longContext = contextParagraph.repeat(20);
    const instructions = 'You need to create a summary report of the key findings. 1. List the top 5 issues. 2. Rank by severity. Avoid speculation.';
    const prompt = longContext + '\n\n' + instructions;

    const result = extractInstructions(prompt);
    expect(result.hasInstructions).toBe(true);
    expect(result.task.toLowerCase()).toContain('summary report');
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.constraints.some(c => /avoid/i.test(c))).toBe(true);
  });

  it('handles mixed content with inline instructions', () => {
    const prompt = 'Here is the data from last quarter. Do the following: analyze the revenue trends, compare Q3 vs Q4, and generate a visual chart. Must use actual numbers only.';
    const result = extractInstructions(prompt);
    expect(result.hasInstructions).toBe(true);
    expect(result.task.toLowerCase()).toContain('analyze');
  });
});
