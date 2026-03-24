import { describe, it, expect } from 'vitest';
import { detectSections, extractSectionContent } from '../optimizer/extractors/sections.js';
import { classifyPromptType } from '../optimizer/classifier.js';
import { buildSpecification } from '../optimizer/specBuilder.js';
import { interpret } from '../optimizer/engine.js';

// ─── Test Prompts ────────────────────────────────────────────────────────────

const SPEC_PROMPT = `
You are a senior JavaScript engineer.

I am building a deterministic prompt interpretation system (no AI APIs, pure JS).

## Objective

Convert extracted instruction text into:
* a clean objective
* normalized step list
* deduplicated constraints

## Requirements

### 1. Objective Synthesis

Implement synthesizeObjective(instructions, intent)

### 2. Step Synthesis

Implement:
* cleanInstructionText()
* extractActionSentences()
* normalizeSteps()
* dedupeSteps()

### 3. Constraint Synthesis

Implement synthesizeConstraints(instructions)

## Deliverables

1. Full implementation
2. Clear function separation
3. Inline comments
4. Example input → output

## Constraints

* Pure JavaScript (ES6+)
* No external libraries
* Deterministic
* Clean, modular code

## Important

Do NOT treat all prompts as tasks.
`.trim();

const WORKFLOW_PROMPT = `
Set up a daily pipeline that scrapes RSS feeds from TechCrunch and Hacker News.
Update a Google Sheet with the latest articles.
Step 1: Fetch RSS feeds
Step 2: Parse article titles and URLs
Step 3: Append new rows to the spreadsheet
Filter out duplicates before inserting.
`.trim();

const ANALYSIS_PROMPT = `
Analyze the quarterly revenue data for Q3 and Q4.
Identify trends in customer acquisition cost.
Compare conversion rates across marketing channels.
Avoid speculation — use actual numbers only.
Must include year-over-year comparison.
`.trim();

const EXECUTION_PROMPT = `
Now I want you to send proposals to relevant LinkedIn service requests.
1. Open this page https://www.linkedin.com/service-marketplace/
2. Understand the services we provide and only send to relevant ones
3. Write the cover letter and share it with me for approval
4. Once I approve, submit it
Do not create a long cover letter.
Keep it to the point.
`.trim();

const PARTIAL_SPEC_PROMPT = `
## Objective

Build a login page with OAuth support.

## Requirements

- Must support Google and GitHub OAuth
- Session timeout of 30 minutes
- CSRF protection

No deliverables section here — just requirements.
`.trim();

const SPEC_BOLD_FORMAT = `
**Objective**: Create a REST API for user management.

**Requirements**:
- CRUD operations for users
- JWT authentication
- Rate limiting

**Deliverables**:
1. API implementation
2. Postman collection
3. README with setup instructions
`.trim();


// ─── detectSections ──────────────────────────────────────────────────────────

describe('detectSections', () => {
  it('detects all sections in a full specification prompt', () => {
    const result = detectSections(SPEC_PROMPT);
    expect(result.found.objective).toBe(true);
    expect(result.found.requirements).toBe(true);
    expect(result.found.deliverables).toBe(true);
    expect(result.found.constraints).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(4);
  });

  it('detects "## Important" as constraints section', () => {
    const result = detectSections(SPEC_PROMPT);
    // "## Important" maps to constraints
    expect(result.found.constraints).toBe(true);
  });

  it('does NOT detect spec sections in a workflow prompt', () => {
    const result = detectSections(WORKFLOW_PROMPT);
    expect(result.found.objective).toBe(false);
    expect(result.found.requirements).toBe(false);
    expect(result.found.deliverables).toBe(false);
  });

  it('does NOT detect spec sections in an analysis prompt', () => {
    const result = detectSections(ANALYSIS_PROMPT);
    expect(result.found.objective).toBe(false);
    expect(result.found.deliverables).toBe(false);
  });

  it('detects sections in bold format (**Objective**)', () => {
    const result = detectSections(SPEC_BOLD_FORMAT);
    expect(result.found.objective).toBe(true);
    expect(result.found.requirements).toBe(true);
    expect(result.found.deliverables).toBe(true);
  });

  it('detects partial spec (objective + requirements only)', () => {
    const result = detectSections(PARTIAL_SPEC_PROMPT);
    expect(result.found.objective).toBe(true);
    expect(result.found.requirements).toBe(true);
    expect(result.found.deliverables).toBe(false);
  });

  it('returns positions sorted by index', () => {
    const result = detectSections(SPEC_PROMPT);
    for (let i = 1; i < result.positions.length; i++) {
      expect(result.positions[i].index).toBeGreaterThan(result.positions[i - 1].index);
    }
  });

  it('handles empty/null input', () => {
    const result = detectSections('');
    expect(result.count).toBe(0);
    expect(result.found.objective).toBe(false);

    const nullResult = detectSections(null);
    expect(nullResult.count).toBe(0);
  });
});


// ─── extractSectionContent ───────────────────────────────────────────────────

describe('extractSectionContent', () => {
  it('extracts content between sections', () => {
    const { positions } = detectSections(SPEC_PROMPT);
    const content = extractSectionContent(SPEC_PROMPT, positions);

    expect(content.objective).toBeTruthy();
    expect(content.objective).toContain('clean objective');
    expect(content.requirements).toBeTruthy();
    expect(content.requirements).toContain('Objective Synthesis');
    expect(content.deliverables).toBeTruthy();
    expect(content.deliverables).toContain('Full implementation');
  });

  it('returns empty object for empty positions', () => {
    expect(extractSectionContent('some text', [])).toEqual({});
  });

  it('last section captures to end of text', () => {
    const text = '## Objective\nDo something.\n## Requirements\n- Item A\n- Item B';
    const { positions } = detectSections(text);
    const content = extractSectionContent(text, positions);
    expect(content.requirements).toContain('Item B');
  });
});


// ─── classifyPromptType ──────────────────────────────────────────────────────

describe('classifyPromptType', () => {
  it('classifies full spec prompt as "specification"', () => {
    const result = classifyPromptType(SPEC_PROMPT, 'content');
    expect(result.type).toBe('specification');
    expect(result.isSpecification).toBe(true);
  });

  it('classifies partial spec (no deliverables) as the intent', () => {
    const result = classifyPromptType(PARTIAL_SPEC_PROMPT, 'workflow');
    expect(result.type).toBe('workflow');
    expect(result.isSpecification).toBe(false);
  });

  it('classifies workflow prompt as its intent', () => {
    const result = classifyPromptType(WORKFLOW_PROMPT, 'workflow');
    expect(result.type).toBe('workflow');
    expect(result.isSpecification).toBe(false);
  });

  it('classifies analysis prompt as its intent', () => {
    const result = classifyPromptType(ANALYSIS_PROMPT, 'analysis');
    expect(result.type).toBe('analysis');
    expect(result.isSpecification).toBe(false);
  });

  it('classifies execution prompt as its intent', () => {
    const result = classifyPromptType(EXECUTION_PROMPT, 'execution');
    expect(result.type).toBe('execution');
    expect(result.isSpecification).toBe(false);
  });

  it('classifies bold-format spec as "specification"', () => {
    const result = classifyPromptType(SPEC_BOLD_FORMAT, 'content');
    expect(result.type).toBe('specification');
    expect(result.isSpecification).toBe(true);
  });
});


// ─── buildSpecification ──────────────────────────────────────────────────────

describe('buildSpecification', () => {
  it('produces structured output with all sections', () => {
    const { positions } = detectSections(SPEC_PROMPT);
    const result = buildSpecification(SPEC_PROMPT, positions, 'Senior Software Engineer');

    expect(result.output).toContain('Role: Senior Software Engineer');
    expect(result.output).toContain('Objective:');
    expect(result.output).toContain('Requirements:');
    expect(result.output).toContain('Deliverables:');
    expect(result.output).toContain('Constraints:');
  });

  it('extracts objective as a single statement', () => {
    const { positions } = detectSections(SPEC_PROMPT);
    const result = buildSpecification(SPEC_PROMPT, positions, 'Engineer');

    expect(result.objective).toBeTruthy();
    expect(result.objective).toContain('clean objective');
    // Should not contain markdown headers
    expect(result.objective).not.toMatch(/^#/);
  });

  it('extracts requirements as an array', () => {
    const { positions } = detectSections(SPEC_PROMPT);
    const result = buildSpecification(SPEC_PROMPT, positions, 'Engineer');

    expect(Array.isArray(result.requirements)).toBe(true);
    expect(result.requirements.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts deliverables as an array', () => {
    const { positions } = detectSections(SPEC_PROMPT);
    const result = buildSpecification(SPEC_PROMPT, positions, 'Engineer');

    expect(Array.isArray(result.deliverables)).toBe(true);
    expect(result.deliverables.length).toBeGreaterThanOrEqual(3);
    expect(result.deliverables.some(d => /implementation/i.test(d))).toBe(true);
  });

  it('extracts constraints as an array', () => {
    const { positions } = detectSections(SPEC_PROMPT);
    const result = buildSpecification(SPEC_PROMPT, positions, 'Engineer');

    expect(Array.isArray(result.constraints)).toBe(true);
    expect(result.constraints.some(c => /JavaScript/i.test(c))).toBe(true);
  });

  it('formats deliverables as numbered list in output', () => {
    const { positions } = detectSections(SPEC_PROMPT);
    const result = buildSpecification(SPEC_PROMPT, positions, 'Engineer');

    expect(result.output).toMatch(/Deliverables:\n1\./);
  });

  it('formats requirements as bullet list in output', () => {
    const { positions } = detectSections(SPEC_PROMPT);
    const result = buildSpecification(SPEC_PROMPT, positions, 'Engineer');

    expect(result.output).toMatch(/Requirements:\n- /);
  });

  it('handles bold-format sections', () => {
    const { positions } = detectSections(SPEC_BOLD_FORMAT);
    const result = buildSpecification(SPEC_BOLD_FORMAT, positions, 'Backend Engineer');

    expect(result.objective).toContain('REST API');
    expect(result.requirements.length).toBeGreaterThanOrEqual(2);
    expect(result.deliverables.length).toBeGreaterThanOrEqual(2);
  });
});


// ─── Engine Integration (interpret) ──────────────────────────────────────────

describe('interpret — specification mode', () => {
  it('detects specification prompt and returns spec structure', () => {
    const result = interpret(SPEC_PROMPT);

    expect(result.type).toBe('specification');
    expect(result.specification).toBeTruthy();
    expect(result.specification.objective).toBeTruthy();
    expect(result.specification.requirements.length).toBeGreaterThanOrEqual(2);
    expect(result.specification.deliverables.length).toBeGreaterThanOrEqual(3);
  });

  it('specification output preserves section headers', () => {
    const result = interpret(SPEC_PROMPT);

    expect(result.output).toContain('Objective:');
    expect(result.output).toContain('Requirements:');
    expect(result.output).toContain('Deliverables:');
  });

  it('specification skips step extraction', () => {
    const result = interpret(SPEC_PROMPT);

    // Steps should be empty — deliverables are NOT steps
    expect(result.steps).toEqual([]);
  });

  it('specification still has role, intent, domain', () => {
    const result = interpret(SPEC_PROMPT);

    expect(result.role).toBeTruthy();
    expect(result.intent).toBeTruthy();
    expect(result.domain).toBeTruthy();
    expect(result.scores.intent).toBeTruthy();
    expect(result.scores.domain).toBeTruthy();
  });

  it('non-spec prompts do NOT trigger specification mode', () => {
    const workflowResult = interpret(WORKFLOW_PROMPT);
    expect(workflowResult.type).toBeUndefined(); // normal path doesn't set type

    const analysisResult = interpret(ANALYSIS_PROMPT);
    expect(analysisResult.type).toBeUndefined();

    const executionResult = interpret(EXECUTION_PROMPT);
    expect(executionResult.type).toBeUndefined();
  });
});


// ─── Cross-Mode Comparison ───────────────────────────────────────────────────

describe('cross-mode comparison', () => {
  it('specification: preserves structure, no synthesis', () => {
    const result = interpret(SPEC_PROMPT);
    expect(result.type).toBe('specification');
    expect(result.specification.deliverables.length).toBeGreaterThan(0);
    expect(result.steps).toEqual([]); // deliverables NOT mapped to steps
  });

  it('workflow: extracts steps normally', () => {
    const result = interpret(WORKFLOW_PROMPT);
    expect(result.type).toBeUndefined();
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('execution: extracts steps and constraints', () => {
    const result = interpret(EXECUTION_PROMPT);
    expect(result.type).toBeUndefined();
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.constraints.length).toBeGreaterThan(0);
  });

  it('analysis: extracts task, not specification', () => {
    const result = interpret(ANALYSIS_PROMPT);
    expect(result.type).toBeUndefined();
    expect(result.task).toBeTruthy();
  });
});
