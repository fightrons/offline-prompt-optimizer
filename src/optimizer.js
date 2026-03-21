// Local, rule-based prompt optimizer — no API calls, no internet needed.

// Filler phrases that add no meaning
const FILLER_PHRASES = [
  // Politeness fluff
  /\b(please|kindly|if you could|if you would|would you mind|i would like you to|i want you to|i need you to|i'd like you to)\b/gi,
  // Hedging
  /\b(maybe|perhaps|possibly|I think|I believe|I feel like|it seems like|sort of|kind of|just|really|very|actually|basically|essentially|literally|honestly|frankly)\b/gi,
  // Redundant preamble
  /\b(as an ai|as a language model|you are an ai|you are a language model)\b/gi,
  // Unnecessary transitions
  /\b(in order to)\b/g,
  // "Can you" / "Could you" → imperative
  /^(can you|could you|will you|would you)\s+/gim,
];

// Verbose phrase → concise replacement
const PHRASE_REPLACEMENTS = [
  [/\bin order to\b/gi, 'to'],
  [/\bdue to the fact that\b/gi, 'because'],
  [/\bfor the purpose of\b/gi, 'to'],
  [/\bin the event that\b/gi, 'if'],
  [/\bat this point in time\b/gi, 'now'],
  [/\bat the present time\b/gi, 'now'],
  [/\bin the near future\b/gi, 'soon'],
  [/\bprior to\b/gi, 'before'],
  [/\bsubsequent to\b/gi, 'after'],
  [/\bin spite of the fact that\b/gi, 'although'],
  [/\bwith regard to\b/gi, 'about'],
  [/\bwith respect to\b/gi, 'about'],
  [/\bin regard to\b/gi, 'about'],
  [/\bin relation to\b/gi, 'about'],
  [/\bpertaining to\b/gi, 'about'],
  [/\bon the other hand\b/gi, 'however'],
  [/\bin addition to\b/gi, 'besides'],
  [/\bas a result of\b/gi, 'because of'],
  [/\bby means of\b/gi, 'by'],
  [/\bin the process of\b/gi, 'while'],
  [/\bit is important to note that\b/gi, ''],
  [/\bit should be noted that\b/gi, ''],
  [/\bit is worth mentioning that\b/gi, ''],
  [/\bneedless to say\b/gi, ''],
  [/\bas a matter of fact\b/gi, ''],
  [/\bthe fact that\b/gi, 'that'],
  [/\bin light of\b/gi, 'given'],
  [/\ba large number of\b/gi, 'many'],
  [/\ba significant number of\b/gi, 'many'],
  [/\bthe majority of\b/gi, 'most'],
  [/\bin the case of\b/gi, 'for'],
  [/\bis able to\b/gi, 'can'],
  [/\bhas the ability to\b/gi, 'can'],
  [/\bmake sure that\b/gi, 'ensure'],
  [/\bmake sure to\b/gi, 'ensure you'],
  [/\btake into consideration\b/gi, 'consider'],
  [/\btake into account\b/gi, 'consider'],
  [/\bgive an explanation of\b/gi, 'explain'],
  [/\bprovide a description of\b/gi, 'describe'],
  [/\bprovide an explanation of\b/gi, 'explain'],
  [/\bprovide a summary of\b/gi, 'summarize'],
  [/\bprovide a list of\b/gi, 'list'],
  [/\bprovide me with\b/gi, 'give me'],
  [/\bI would appreciate it if you could\b/gi, ''],
  [/\bdo not hesitate to\b/gi, ''],
];

// Redundant instruction patterns (often repeated in prompts)
const REDUNDANT_PATTERNS = [
  /\b(make sure|ensure) (that )?you (are |do )?/gi,
  /\bplease note that\b/gi,
  /\bkeep in mind that\b/gi,
  /\bremember that\b/gi,
  /\bdon't forget to\b/gi,
  /\bI want the (output|result|response|answer) to be\b/gi,
];

function removeFiller(text) {
  let result = text;
  for (const pattern of FILLER_PHRASES) {
    result = result.replace(pattern, '');
  }
  return result;
}

function applyReplacements(text) {
  let result = text;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function removeRedundant(text) {
  let result = text;
  for (const pattern of REDUNDANT_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result;
}

function collapseWhitespace(text) {
  return text
    .replace(/[ \t]+/g, ' ')         // multiple spaces/tabs → single space
    .replace(/\n{3,}/g, '\n\n')      // 3+ newlines → 2
    .replace(/^ +/gm, '')            // leading spaces on lines
    .replace(/ +$/gm, '')            // trailing spaces on lines
    .trim();
}

function removeDuplicateSentences(text) {
  const lines = text.split('\n');
  const seen = new Set();
  const result = [];
  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    if (normalized === '' || !seen.has(normalized)) {
      seen.add(normalized);
      result.push(line);
    }
  }
  return result.join('\n');
}

function capitalizeFirstLetter(text) {
  if (!text) return text;
  // Capitalize start of each sentence after cleanup
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_, prefix, letter) =>
    prefix + letter.toUpperCase()
  );
}

export function estimateTokens(text) {
  if (!text.trim()) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.3);
}

export function optimizePrompt(input) {
  if (!input.trim()) {
    return { optimizedPrompt: '', changes: [], beforeTokens: 0, afterTokens: 0, reduction: 0 };
  }

  const changes = [];
  let text = input;

  // Track what each step does
  const before = text;

  // Step 1: Replace verbose phrases with concise ones
  text = applyReplacements(text);
  if (text !== before) changes.push('Replaced verbose phrases with concise alternatives');

  // Step 2: Remove filler words
  const beforeFiller = text;
  text = removeFiller(text);
  if (text !== beforeFiller) changes.push('Removed filler words and unnecessary hedging');

  // Step 3: Remove redundant instruction patterns
  const beforeRedundant = text;
  text = removeRedundant(text);
  if (text !== beforeRedundant) changes.push('Removed redundant instruction phrases');

  // Step 4: Remove duplicate sentences/lines
  const beforeDupes = text;
  text = removeDuplicateSentences(text);
  if (text !== beforeDupes) changes.push('Removed duplicate lines');

  // Step 5: Clean up whitespace
  text = collapseWhitespace(text);

  // Step 6: Capitalize properly
  text = capitalizeFirstLetter(text);

  const beforeTokens = estimateTokens(input);
  const afterTokens = estimateTokens(text);
  const reduction = beforeTokens > 0
    ? Math.round(((beforeTokens - afterTokens) / beforeTokens) * 100)
    : 0;

  if (changes.length === 0) {
    changes.push('Prompt is already concise — no major optimizations found');
  }

  return {
    optimizedPrompt: text,
    changes,
    beforeTokens,
    afterTokens,
    reduction,
  };
}
