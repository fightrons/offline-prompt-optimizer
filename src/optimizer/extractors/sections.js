/**
 * Section Detection
 *
 * Detects structured sections in specification-style prompts.
 * Specification prompts contain explicit headers like:
 *   ## Objective, ### Requirements, ## Deliverables, ## Constraints
 *
 * Unlike task/workflow prompts which bury instructions in prose,
 * specification prompts declare their structure explicitly.
 * This module detects that structure so the pipeline can preserve it
 * instead of decomposing it into task/steps/constraints.
 */


// ─── Section Header Patterns ─────────────────────────────────────────────────
// Each entry: { name, patterns[] }
// Patterns match markdown headers (##, ###), bold labels (**X**), or bare labels (X:)
// Order doesn't matter — all sections are detected independently.

const SECTION_DEFINITIONS = [
  {
    name: 'objective',
    patterns: [
      /^#{1,3}\s*objective\b/im,
      /^\*{1,2}objective\*{1,2}\s*:?/im,
      /^objective\s*:/im,
    ],
  },
  {
    name: 'requirements',
    patterns: [
      /^#{1,3}\s*requirements?\b/im,
      /^\*{1,2}requirements?\*{1,2}\s*:?/im,
      /^requirements?\s*:/im,
    ],
  },
  {
    name: 'deliverables',
    patterns: [
      /^#{1,3}\s*deliverables?\b/im,
      /^\*{1,2}deliverables?\*{1,2}\s*:?/im,
      /^deliverables?\s*:/im,
    ],
  },
  {
    name: 'steps',
    patterns: [
      /^#{1,3}\s*steps?\b/im,
      /^\*{1,2}steps?\*{1,2}\s*:?/im,
      /^steps?\s*:/im,
    ],
  },
  {
    name: 'constraints',
    patterns: [
      /^#{1,3}\s*constraints?\b/im,
      /^\*{1,2}constraints?\*{1,2}\s*:?/im,
      /^constraints?\s*:/im,
      /^#{1,3}\s*important\b/im,
    ],
  },
];


/**
 * Detects which structured sections are present in the text.
 *
 * Returns a map of section names to their detected state:
 *   { objective: true, requirements: true, deliverables: false, ... }
 *
 * Also returns the raw section positions for extraction.
 *
 * @param {string} text — the raw prompt text
 * @returns {{
 *   found: Object<string, boolean>,
 *   count: number,
 *   positions: Array<{ name: string, index: number, headerEnd: number }>
 * }}
 */
export function detectSections(text) {
  if (!text || !text.trim()) {
    return {
      found: { objective: false, requirements: false, deliverables: false, steps: false, constraints: false },
      count: 0,
      positions: [],
    };
  }

  const found = {};
  const positions = [];

  for (const { name, patterns } of SECTION_DEFINITIONS) {
    found[name] = false;

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        found[name] = true;
        positions.push({
          name,
          index: match.index,
          headerEnd: match.index + match[0].length,
        });
        break; // One match per section is enough
      }
    }
  }

  // Sort positions by index for ordered extraction
  positions.sort((a, b) => a.index - b.index);

  return {
    found,
    count: positions.length,
    positions,
  };
}


/**
 * Extracts section content from text given detected positions.
 *
 * Each section's content runs from its header end to the start of the next section
 * (or end of text). Content is trimmed and stripped of leading colons/dashes.
 *
 * @param {string} text — the raw prompt text
 * @param {Array<{ name: string, index: number, headerEnd: number }>} positions
 * @returns {Object<string, string>} — section name → content
 */
export function extractSectionContent(text, positions) {
  if (!positions || positions.length === 0) return {};

  const content = {};

  for (let i = 0; i < positions.length; i++) {
    const { name, headerEnd } = positions[i];
    const nextStart = i + 1 < positions.length ? positions[i + 1].index : text.length;

    let sectionText = text.slice(headerEnd, nextStart).trim();

    // Strip leading colon or dash if the header pattern left one
    sectionText = sectionText.replace(/^[:—-]\s*/, '').trim();

    content[name] = sectionText;
  }

  return content;
}
