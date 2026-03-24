/**
 * Mode-Based Output Builder
 *
 * Builds structured prompt output based on the detected intent mode.
 * Each mode has a distinct format optimized for its task type:
 *
 *   content   → Role + Task + Constraints
 *   workflow   → Role + Objective + Steps + Output Format
 *   analysis   → Role + Objective + Focus Areas + Constraints
 *   decision   → Role + Objective + Evaluation Criteria + Expected Output
 *   execution  → Role + Objective + Steps + Constraints
 *
 * All builders follow the same contract:
 *   Input:  components object with { role, task, steps, constraints }
 *   Output: formatted string with labeled sections
 */

import { fixCasing } from './utils.js';

// ─── Main Dispatcher ─────────────────────────────────────────────────────────

/**
 * Routes to the appropriate mode-specific builder.
 *
 * @param {string} mode — detected intent (content|workflow|analysis|decision|execution)
 * @param {Object} components — extracted prompt components
 * @param {string} [components.role]
 * @param {string} [components.task]
 * @param {string[]} [components.steps]
 * @param {string[]} [components.constraints]
 * @returns {string} — formatted structured prompt
 */
export function buildModeOutput(mode, components) {
  const builders = {
    content: buildContentOutput,
    workflow: buildWorkflowOutput,
    analysis: buildAnalysisOutput,
    decision: buildDecisionOutput,
    execution: buildExecutionOutput,
  };

  const builder = builders[mode] || buildContentOutput;
  const raw = builder(components);
  return fixCasing(raw);
}

// ─── Mode-Specific Builders ──────────────────────────────────────────────────

/**
 * Content mode: optimized for writing/creation tasks.
 * Sections: Role → Task → Constraints
 */
function buildContentOutput({ role, task, constraints = [] }) {
  const sections = [];
  if (role) sections.push(`Role: ${role}`);
  if (task) sections.push(`Task: ${task}`);
  if (constraints.length > 0) {
    sections.push(`Constraints:\n${constraints.map(c => `- ${c}`).join('\n')}`);
  }
  return sections.join('\n\n');
}

/**
 * Workflow mode: optimized for multi-step processes.
 * Sections: Role → Objective → Steps → Output Format
 */
function buildWorkflowOutput({ role, task, steps = [], constraints = [] }) {
  const sections = [];
  if (role) sections.push(`Role: ${role}`);
  if (task) sections.push(`Objective: ${task}`);
  if (steps.length > 0) {
    sections.push(`Steps:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }
  if (constraints.length > 0) {
    sections.push(`Guidelines:\n${constraints.map(c => `- ${c}`).join('\n')}`);
  }
  return sections.join('\n\n');
}

/**
 * Analysis mode: optimized for data analysis and insight extraction.
 * Sections: Role → Objective → Focus Areas → Constraints
 */
function buildAnalysisOutput({ role, task, steps = [], constraints = [] }) {
  const sections = [];
  if (role) sections.push(`Role: ${role}`);
  if (task) sections.push(`Objective: ${task}`);
  if (steps.length > 0) {
    sections.push(`Focus areas:\n${steps.map(s => `- ${s}`).join('\n')}`);
  }
  if (constraints.length > 0) {
    sections.push(`Constraints:\n${constraints.map(c => `- ${c}`).join('\n')}`);
  }
  return sections.join('\n\n');
}

/**
 * Decision mode: optimized for strategic evaluation and prioritization.
 * Sections: Role → Objective → Evaluation Criteria → Expected Output
 *
 * Heuristic: constraint-like steps become criteria; action-like steps become output.
 */
function buildDecisionOutput({ role, task, steps = [], constraints = [] }) {
  const sections = [];
  if (role) sections.push(`Role: ${role}`);
  if (task) sections.push(`Objective: ${task}`);

  // Merge constraints + evaluation-style steps into criteria
  const criteriaPattern = /\b(?:based\s+on|criteria|evaluat|weigh|score|rank|prioriti[zs]e|impact|effort)\b/i;
  const criteria = [
    ...constraints,
    ...steps.filter(s => criteriaPattern.test(s)),
  ];
  const outputSteps = steps.filter(s => !criteriaPattern.test(s));

  if (criteria.length > 0) {
    sections.push(`Evaluation criteria:\n${criteria.map(c => `- ${c}`).join('\n')}`);
  }
  if (outputSteps.length > 0) {
    sections.push(`Expected output:\n${outputSteps.map(s => `- ${s}`).join('\n')}`);
  }
  return sections.join('\n\n');
}

/**
 * Execution mode: optimized for action-oriented tasks (send, submit, deliver).
 * Sections: Role → Objective → Steps → Constraints
 */
function buildExecutionOutput({ role, task, steps = [], constraints = [] }) {
  const sections = [];
  if (role) sections.push(`Role: ${role}`);
  if (task) sections.push(`Objective: ${task}`);
  if (steps.length > 0) {
    sections.push(`Steps:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }
  if (constraints.length > 0) {
    sections.push(`Constraints:\n${constraints.map(c => `- ${c}`).join('\n')}`);
  }
  return sections.join('\n\n');
}

// Named export for direct use in index.js execution path
export { buildExecutionOutput as buildExecution };
