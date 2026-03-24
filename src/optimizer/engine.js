/**
 * Signal-Based Prompt Interpretation Engine
 *
 * A 7-layer pipeline that converts raw prompts into structured, intent-aware
 * instructions using signal scoring instead of rigid rules.
 *
 * Pipeline:
 *   Layer 1: Cleanup          — strip soft language, normalize verbosity
 *   Layer 2: Intent Scoring   — weighted signal scoring across 5 intent types
 *   Layer 3: Domain Scoring   — weighted signal scoring across 13 domains
 *   Layer 4: Instruction Detection — confidence-based context/instruction split
 *   Layer 5: Extraction       — task, steps, constraints (instruction-priority)
 *   Layer 6: Role Mapping     — intent × domain → appropriate role
 *   Layer 7: Output Builder   — mode-specific structured formatting
 *
 * Design principles:
 *   - Signal scoring over hard rules (no if/else chains for classification)
 *   - Instruction-priority extraction (context never pollutes task detection)
 *   - Deterministic (no randomness, same input → same output)
 *   - No external libraries
 */

import { hardCleanup } from './utils.js';
import { scoreIntent, scoreDomain, scoreInstructionConfidence } from './scoring.js';
import {
  splitPrompt,
  extractTask as extractInstructionTask,
  extractSteps,
  extractConstraints as extractInstructionConstraints,
} from './extractors/instructions.js';
import { mapRole } from './extractors/role.js';
import { buildModeOutput } from './builder.js';


/**
 * Main entry point: interprets a raw prompt through the full 7-layer pipeline.
 *
 * @param {string} rawText — the user's raw, unstructured prompt
 * @returns {{
 *   output: string,
 *   intent: string,
 *   domain: string,
 *   role: string,
 *   task: string|null,
 *   steps: string[],
 *   constraints: string[],
 *   hasInstructions: boolean,
 *   contextUsed: boolean,
 *   scores: {
 *     intent: Object<string,number>,
 *     domain: Object<string,number>,
 *     instructionConfidence: number
 *   }
 * }}
 */
export function interpret(rawText) {
  if (!rawText || !rawText.trim()) {
    return emptyResult();
  }

  // ─── Layer 1: Cleanup ────────────────────────────────────────────────
  const cleaned = hardCleanup(rawText);

  // ─── Layer 2: Intent Scoring ─────────────────────────────────────────
  const intentResult = scoreIntent(cleaned);

  // ─── Layer 3: Domain Scoring ─────────────────────────────────────────
  const domainResult = scoreDomain(cleaned);

  // ─── Layer 4: Instruction Detection ──────────────────────────────────
  // Split on RAW text first — cleanup strips anchor phrases like "I want you to",
  // which destroys instruction anchors. Then clean each portion separately.
  // The structural split determines WHERE to extract from;
  // the confidence score is metadata about HOW instruction-heavy the prompt is.
  const { context: rawContext, instructions: rawInstructions, hasInstructions } = splitPrompt(rawText);
  const context = hasInstructions ? hardCleanup(rawContext) : '';
  const instructions = hasInstructions ? hardCleanup(rawInstructions) : '';
  const instrConfidence = scoreInstructionConfidence(rawText);

  // ─── Layer 5: Extraction (instruction-priority) ──────────────────────
  // Critical rule: when instructions exist, extract ONLY from them.
  // Context is used solely for domain detection (Layer 3 already did this).
  //
  // Task extraction uses RAW instructions (before cleanup) because:
  //   - Anchor phrases ("I want you to") provide scoring signal
  //   - Numbered step prefixes ("1.") need to be visible for penalty scoring
  //   - The extractInstructionTask function handles its own noise stripping
  // Steps/constraints use cleaned text for cleaner output.
  const task = extractInstructionTask(
    hasInstructions ? rawInstructions : null,
    hasInstructions ? null : rawText,
  );
  const source = hasInstructions ? instructions : cleaned;
  const steps = extractSteps(source);
  const constraints = extractInstructionConstraints(source);

  // ─── Layer 6: Role Mapping ───────────────────────────────────────────
  const role = mapRole(intentResult.winner, domainResult.winner);

  // ─── Layer 7: Mode-Based Output ──────────────────────────────────────
  // Quality gate: only structure if we extracted enough signal
  const signalStrength = (task ? 1 : 0) + (steps.length > 0 ? 1 : 0) + (constraints.length > 0 ? 1 : 0);
  let output;

  if (signalStrength >= 1) {
    output = buildModeOutput(intentResult.winner, {
      role,
      task,
      steps,
      constraints,
    });
  } else {
    // Not enough signal to structure — return cleaned text
    output = cleaned;
  }

  return {
    output,
    intent: intentResult.winner,
    domain: domainResult.winner,
    role,
    task,
    steps,
    constraints,
    hasInstructions,
    contextUsed: !hasInstructions,
    scores: {
      intent: intentResult.scores,
      domain: domainResult.scores,
      instructionConfidence: instrConfidence.confidence,
    },
  };
}


/**
 * Returns a blank result for empty input.
 */
function emptyResult() {
  return {
    output: '',
    intent: 'generic',
    domain: 'general',
    role: '',
    task: null,
    steps: [],
    constraints: [],
    hasInstructions: false,
    contextUsed: true,
    scores: { intent: {}, domain: {}, instructionConfidence: 0 },
  };
}
