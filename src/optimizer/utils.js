import { 
  SOFT_LANGUAGE, 
  VERBOSE_TO_CONCISE, 
  REDUNDANT_PATTERNS, 
  TASK_NORMALIZATIONS, 
  CLARITY_COMPRESSIONS 
} from './patterns.js';

export function hardCleanup(text) {
  let result = text;
  // Task normalization first (before soft language removal)
  for (const [pattern, replacement] of TASK_NORMALIZATIONS) {
    result = result.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of VERBOSE_TO_CONCISE) {
    result = result.replace(pattern, replacement);
  }
  for (const pattern of SOFT_LANGUAGE) {
    result = result.replace(pattern, '');
  }
  for (const pattern of REDUNDANT_PATTERNS) {
    result = result.replace(pattern, '');
  }
  // Collapse whitespace
  result = result
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^ +/gm, '')
    .replace(/ +$/gm, '')
    .replace(/\.\s*\./g, '.')
    .replace(/,\s*,/g, ',')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
  return result;
}

export function compressClarity(text) {
  let result = text;
  for (const [pattern, replacement] of CLARITY_COMPRESSIONS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// Fix common acronym/proper noun casing
export function fixCasing(text) {
  return text
    .replace(/\bai\b/g, 'AI')
    .replace(/\bapi\b/gi, 'API')
    .replace(/\bapis\b/gi, 'APIs')
    .replace(/\bml\b/gi, 'ML')
    .replace(/\bui\b/gi, 'UI')
    .replace(/\bux\b/gi, 'UX')
    .replace(/\bsql\b/gi, 'SQL')
    .replace(/\bcss\b/gi, 'CSS')
    .replace(/\bhtml\b/gi, 'HTML')
    .replace(/\bjson\b/gi, 'JSON')
    .replace(/\byaml\b/gi, 'YAML')
    .replace(/\bci\/cd\b/gi, 'CI/CD')
    .replace(/\bdevops\b/gi, 'DevOps')
    .replace(/\bdocker\b/gi, 'Docker')
    .replace(/\bgithub\b/gi, 'GitHub')
    .replace(/\bjenkins\b/gi, 'Jenkins');
}
