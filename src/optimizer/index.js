import { estimateTokens, estimateCost, countAnthropicTokens, getEncoder } from './tokens.js';
import { hardCleanup } from './utils.js';
import { extractWorkflowComponents, buildIntentSpecificPrompt } from './extractors/workflow.js';
import { extractRole, extractTask, extractConstraints, extractKeyPoints, extractOutputRequirements, deduplicateAgainstTask, deduplicateRequirements, buildStructuredPrompt } from './extractors/content.js';
import { detectIntent } from './extractors/intent.js';
import { detectDomain } from './extractors/domain.js';
import { mapRole } from './extractors/role.js';
import { splitPrompt, extractTask as extractInstructionTask, extractSteps, extractConstraints as extractInstructionConstraints } from './extractors/instructions.js';
import { buildModeOutput } from './builder.js';

// Pre-load encoder on import so it's ready by the time user clicks optimize
getEncoder();

export { estimateTokens, estimateCost, countAnthropicTokens };
export { optimizeWithAI } from './ai.js';

export function optimizeLocal(input) {
  if (!input.trim()) {
    return { optimizedPrompt: '', changes: [], beforeTokens: 0, afterTokens: 0, reduction: 0 };
  }

  const changes = [];

  // Layer 1: Hard cleanup
  const cleaned = hardCleanup(input);
  if (cleaned !== input.trim()) {
    changes.push('Reduced verbosity and removed soft language');
  }

  // Layer 2.0 & 3.0: Classification
  const intent = detectIntent(cleaned);
  const domain = detectDomain(cleaned);
  changes.push(`Detected Intent: ${intent.toUpperCase()}`);
  changes.push(`Detected Domain: ${domain.toUpperCase()}`);

  let optimized;

  if (intent === 'workflow' || intent === 'analysis' || intent === 'decision') {
    // ─── Intent-Aware Path: extract structured components based on intent ───
    const components = extractWorkflowComponents(cleaned, input, intent, domain);
    optimized = buildIntentSpecificPrompt(components);
    changes.push(`Detected ${intent} prompt — used structured ${intent} format`);
    if (components.role) changes.push(`Inferred role: "${components.role}"`);
    if (components.topics.length > 0) changes.push(`Extracted ${components.topics.length} topic/factor(s)`);
    if (Object.keys(components.dataSources).length > 0) changes.push(`Extracted ${Object.keys(components.dataSources).length} data source(s)`);
    if (components.steps.length > 0) changes.push(`Extracted ${components.steps.length} task(s)`);
    if (components.outputFormat.length > 0) changes.push(`Extracted ${components.outputFormat.length} output format(s)`);
  } else if (intent === 'execution') {
    // ─── Execution Path: instruction-priority extraction ───
    const { instructions: execInstructions, hasInstructions } = splitPrompt(cleaned);
    const source = hasInstructions ? execInstructions : cleaned;
    const execRole = extractRole(input) || mapRole('execution', domain);
    const execTask = extractInstructionTask(
      hasInstructions ? execInstructions : null,
      hasInstructions ? null : cleaned,
    );
    const execSteps = extractSteps(source);
    const execConstraints = extractInstructionConstraints(source);

    optimized = buildModeOutput('execution', {
      role: execRole,
      task: execTask,
      steps: execSteps,
      constraints: execConstraints,
    });

    changes.push('Detected execution prompt — used structured execution format');
    if (execRole) changes.push(`Inferred role: "${execRole}"`);
    if (execSteps.length > 0) changes.push(`Extracted ${execSteps.length} step(s)`);
    if (execConstraints.length > 0) changes.push(`Extracted ${execConstraints.length} constraint(s)`);
  } else {

    // ─── Content Path: original extraction pipeline ───

    // Layer 4: Extract structure (Content Intent)
    const explicitRole = extractRole(input);
    const task = extractTask(cleaned);
    const role = explicitRole || mapRole(intent, domain);
    const constraints = extractConstraints(input);
    let keyPoints = extractKeyPoints(cleaned, input, intent, domain);
    let outputRequirements = extractOutputRequirements(cleaned);

    // Split: "Include/Add X" in key points → move to requirements (but not "Provide optional..." feature descriptions)
    const promoted = [];
    keyPoints = keyPoints.filter(p => {
      if (/^(Include|Add)\b/i.test(p) || /^Provide\s+(?:a\s+)?(?:clear|relevant|detailed)\b/i.test(p)) {
        if (!outputRequirements.includes(p)) promoted.push(p);
        return false;
      }
      return true;
    });
    outputRequirements = [...outputRequirements, ...promoted];

    // Deduplicate: key points vs task, requirements vs key points
    keyPoints = deduplicateAgainstTask(keyPoints, task);
    outputRequirements = deduplicateRequirements(outputRequirements, keyPoints);

    // Quality check: only structure if we have enough signal
    const structureScore =
      (task ? 1 : 0) +
      (constraints.length > 0 ? 1 : 0) +
      (keyPoints.length > 0 ? 1 : 0) +
      (outputRequirements.length > 0 ? 1 : 0);

    if (structureScore >= 2) {
      optimized = buildStructuredPrompt(role, task, constraints, keyPoints, outputRequirements, cleaned);
      changes.push('Converted unstructured input into structured prompt format');
      if (!explicitRole && role) changes.push(`Inferred role: "${role}"`);
      if (explicitRole) changes.push(`Extracted role: "${explicitRole}"`);
      if (constraints.length > 0) changes.push(`Extracted ${constraints.length} constraint(s)`);
      if (keyPoints.length > 0) changes.push(`Identified ${keyPoints.length} key point(s)`);
      if (outputRequirements.length > 0) changes.push(`Identified ${outputRequirements.length} output requirement(s)`);
    } else if (task) {
      // Partial structure: at least format as task
      optimized = role ? `Role: ${role}\n\nTask: ${task}` : `Task: ${task}`;
      if (cleaned !== optimized) {
        changes.push('Extracted core task from conversational text');
        if (!explicitRole && role) changes.push(`Inferred role: "${role}"`);
      } else {
        optimized = cleaned;
      }
    } else {
      optimized = cleaned;
    }

  } // end content path

  const beforeTokens = estimateTokens(input);
  let afterTokens = estimateTokens(optimized);

  // Guard: if structured output is longer than input, fall back to cleaned text
  // Skip for workflow/analysis/decision prompts — their value is in restructuring, not compression
  if (intent !== 'workflow' && intent !== 'analysis' && intent !== 'decision' && intent !== 'execution' && afterTokens > beforeTokens) {
    optimized = cleaned;
    afterTokens = estimateTokens(optimized);
    // If even cleaned is longer (very short input), return original
    if (afterTokens >= beforeTokens) {
      return {
        optimizedPrompt: input.trim(),
        changes: ['Prompt is already concise — no optimizations needed'],
        beforeTokens,
        afterTokens: beforeTokens,
        reduction: 0,
      };
    }
  }

  if (changes.length === 0) {
    changes.push('Prompt is already well-structured — no optimizations needed');
  }

  const reduction = beforeTokens > 0
    ? Math.round(((beforeTokens - afterTokens) / beforeTokens) * 100)
    : 0;

  if (reduction > 0 && changes.length > 1) {
    changes.push(`Reduced tokens by ${reduction}% while improving clarity`);
  }

  return { optimizedPrompt: optimized, changes, beforeTokens, afterTokens, reduction };
}
