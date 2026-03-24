/**
 * Specification Builder
 *
 * Builds structured output for specification-style prompts.
 *
 * Unlike other modes that synthesize/normalize content, the spec builder
 * PRESERVES the original structure. It extracts sections cleanly but does
 * not rewrite, group, or deduplicate content — the user wrote a spec
 * intentionally, and the structure is the value.
 *
 * Output format:
 *   Role: [inferred role]
 *   Objective: [from objective section]
 *   Requirements: [from requirements section, cleaned]
 *   Deliverables: [from deliverables section, cleaned]
 *   Constraints: [from constraints section, if present]
 */

import { extractSectionContent } from './extractors/sections.js';
import { fixCasing } from './utils.js';


// ─── Section Cleaners ────────────────────────────────────────────────────────
// Light cleaning for each section type. Goal: normalize formatting without
// losing content. These are NOT synthesis — just noise removal.

/**
 * Cleans an objective section: strip sub-headers, collapse to single statement.
 */
function cleanObjective(raw) {
  if (!raw) return '';
  return raw
    .replace(/^#{1,3}\s+.*/gm, '')  // strip any nested sub-headers
    .replace(/\n{2,}/g, ' ')         // collapse to single line
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cleans a list section (requirements, deliverables, constraints).
 * Extracts items from numbered lists, bullets, or plain lines.
 * Returns an array of cleaned items.
 */
function cleanListSection(raw) {
  if (!raw) return [];

  const items = [];
  const lines = raw.split('\n');

  let currentItem = '';
  let inSubSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect sub-section headers (### 1. Something, **1. Something**)
    if (/^#{1,4}\s+/.test(trimmed) || /^\*{2}[^*]+\*{2}\s*$/.test(trimmed)) {
      // Flush current item
      if (currentItem) {
        items.push(currentItem.trim());
        currentItem = '';
      }
      // Extract sub-section title as an item
      const title = trimmed
        .replace(/^#{1,4}\s+/, '')
        .replace(/^\*{2}/, '').replace(/\*{2}$/, '')
        .replace(/^\d+[.)]\s*/, '')
        .trim();
      if (title) {
        currentItem = title;
        inSubSection = true;
      }
      continue;
    }

    // Bullet or numbered item
    if (/^\s*(?:[-–—•*]|\d+[.)])\s+/.test(trimmed)) {
      if (currentItem) {
        items.push(currentItem.trim());
      }
      currentItem = trimmed
        .replace(/^\s*(?:[-–—•*]|\d+[.)])\s+/, '')
        .trim();
      inSubSection = false;
      continue;
    }

    // Continuation line within a sub-section (indented or following)
    if (inSubSection || currentItem) {
      // If this is a plain sentence following a sub-header, treat as detail
      // Append with separator
      if (currentItem && !currentItem.endsWith(':')) {
        currentItem += ': ' + trimmed;
      } else {
        currentItem += ' ' + trimmed;
      }
      inSubSection = false;
      continue;
    }

    // Standalone line with content — treat as item
    if (trimmed.length > 5) {
      items.push(trimmed);
    }
  }

  // Flush last item
  if (currentItem) {
    items.push(currentItem.trim());
  }

  // Final cleanup: capitalize, remove trailing periods for consistency
  return items
    .filter(item => item.length > 3)
    .map(item => {
      let cleaned = item.replace(/\s+/g, ' ').trim();
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      return cleaned;
    });
}


/**
 * Builds a structured specification output from raw text and detected positions.
 *
 * Extracts each section, cleans it lightly, and assembles into a structured
 * format. Does NOT synthesize, normalize steps, or modify content heavily.
 *
 * @param {string} text — the raw prompt text
 * @param {Array<{ name: string, index: number, headerEnd: number }>} positions — from detectSections
 * @param {string} role — the inferred role from intent × domain mapping
 * @returns {{
 *   output: string,
 *   role: string,
 *   objective: string,
 *   requirements: string[],
 *   deliverables: string[],
 *   constraints: string[]
 * }}
 */
export function buildSpecification(text, positions, role) {
  const rawSections = extractSectionContent(text, positions);

  // Extract and clean each section
  const objective = cleanObjective(rawSections.objective || '');
  const requirements = cleanListSection(rawSections.requirements || '');
  const deliverables = cleanListSection(rawSections.deliverables || '');
  const constraints = cleanListSection(rawSections.constraints || '');

  // Build formatted output
  const sections = [];

  if (role) sections.push(`Role: ${role}`);

  if (objective) {
    sections.push(`Objective: ${objective}`);
  }

  if (requirements.length > 0) {
    sections.push(`Requirements:\n${requirements.map(r => `- ${r}`).join('\n')}`);
  }

  if (deliverables.length > 0) {
    sections.push(`Deliverables:\n${deliverables.map((d, i) => `${i + 1}. ${d}`).join('\n')}`);
  }

  if (constraints.length > 0) {
    sections.push(`Constraints:\n${constraints.map(c => `- ${c}`).join('\n')}`);
  }

  const output = fixCasing(sections.join('\n\n'));

  return {
    output,
    role,
    objective,
    requirements,
    deliverables,
    constraints,
  };
}
