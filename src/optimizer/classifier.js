/**
 * Prompt Type Classifier
 *
 * Determines whether a prompt is a specification (structured document with
 * explicit sections) or a standard intent-based prompt (task, workflow, etc.).
 *
 * Specification prompts have a fundamentally different structure:
 *   - They declare sections explicitly (Objective, Requirements, Deliverables)
 *   - Their content should be preserved, not decomposed
 *   - Synthesis and step extraction should be skipped
 *
 * Classification rule:
 *   If Objective + Requirements + Deliverables all exist → "specification"
 *   Else → fall through to the detected intent
 */

import { detectSections } from './extractors/sections.js';


/**
 * Classifies a prompt as either "specification" or the detected intent type.
 *
 * A prompt is a specification when it contains all three core spec sections:
 * Objective, Requirements, and Deliverables. This is a strict gate —
 * having only two of three is not enough (it could be a structured workflow).
 *
 * @param {string} text — the raw prompt text
 * @param {string} intent — the detected intent from scoring (content|workflow|analysis|decision|execution)
 * @returns {{
 *   type: string,
 *   isSpecification: boolean,
 *   sections: Object<string, boolean>,
 *   sectionCount: number,
 *   positions: Array<{ name: string, index: number, headerEnd: number }>
 * }}
 */
export function classifyPromptType(text, intent) {
  const { found, count, positions } = detectSections(text);

  // Core specification gate: all three must be present
  const isSpecification = found.objective && found.requirements && found.deliverables;

  return {
    type: isSpecification ? 'specification' : intent,
    isSpecification,
    sections: found,
    sectionCount: count,
    positions,
  };
}
