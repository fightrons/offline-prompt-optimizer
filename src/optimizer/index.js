import { estimateTokens, estimateCost, getEncoder } from './tokens.js';
import { hardCleanup } from './utils.js';
import { detectPromptType, extractWorkflowComponents, buildWorkflowPrompt } from './extractors/workflow.js';
import { extractRole, inferRole, extractTask, extractConstraints, extractKeyPoints, extractOutputRequirements, deduplicateAgainstTask, deduplicateRequirements, buildStructuredPrompt } from './extractors/content.js';

// Pre-load encoder on import so it's ready by the time user clicks optimize
getEncoder();

export { estimateTokens, estimateCost };
export { optimizeWithAI } from './ai.js';

export function optimizeLocal(input) {
  if (!input.trim()) {
    return { optimizedPrompt: '', changes: [], beforeTokens: 0, afterTokens: 0, reduction: 0 };
  }

  const changes = [];

  // Detect prompt type: workflow vs content
  const promptType = detectPromptType(input);

  // Layer 1: Hard cleanup
  const cleaned = hardCleanup(input);
  if (cleaned !== input.trim()) {
    changes.push('Reduced verbosity and removed soft language');
  }

  let optimized;

  if (promptType === 'workflow') {
    // ─── Workflow path: extract structured workflow components ───
    const components = extractWorkflowComponents(cleaned, input);
    optimized = buildWorkflowPrompt(components);
    changes.push('Detected workflow prompt — used structured workflow format');
    if (components.role) changes.push(`Inferred role: "${components.role}"`);
    if (components.topics.length > 0) changes.push(`Extracted ${components.topics.length} topic(s)`);
    if (Object.keys(components.dataSources).length > 0) changes.push(`Extracted ${Object.keys(components.dataSources).length} data source category(ies)`);
    if (components.steps.length > 0) changes.push(`Extracted ${components.steps.length} step(s)`);
    if (components.outputFormat.length > 0) changes.push(`Extracted ${components.outputFormat.length} output column(s)`);
    if (components.tools.length > 0) changes.push(`Identified ${components.tools.length} tool(s)`);
  } else {
    // ─── Content path: original extraction pipeline ───

    // Layer 2: Extract structure
    const explicitRole = extractRole(input);
    const task = extractTask(cleaned);
    const role = explicitRole || inferRole(task);
    const constraints = extractConstraints(input);
    let keyPoints = extractKeyPoints(cleaned, input);
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
  // Skip for workflow prompts — their value is in restructuring, not compression
  if (promptType !== 'workflow' && afterTokens > beforeTokens) {
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
