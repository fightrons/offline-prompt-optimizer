import { extractRole, extractTask } from './content.js';
import { fixCasing } from '../utils.js';

export function detectPromptType(text) {
  const lower = text.toLowerCase();
  const signals = [
    /\bstep\s*\d+\b/i,                          // "Step 1", "Step 2"
    /\bcolumn\s*[a-g]\b/i,                       // "Column A", "Column B"
    /\brss\s*feed/i,                             // RSS feeds
    /\bgoogle\s*(?:sheet|alert|doc)/i,           // Google tools
    /\b(?:spreadsheet|excel\s*sheet)\b/i,        // Spreadsheets
    /\b(?:scrape|fetch|crawl)\b/i,               // Data collection
    /\bupdate\s*rows?\b/i,                       // Data entry
    /\b(?:daily|weekly|recurring)\s*(?:basis|task|research)\b/i, // Recurring workflows
    /https?:\/\/[^\s]+(?:rss|feed|xml)\b/i,     // RSS URLs
    /\b\w+\.com\/(?:rss|feed)\b/i,              // Feed URLs
    /\b(?:jira\b|github\s*issues?|sentry|crash\s*logs?|bug\s*reports?)\b/i, // QA / Engineering tracking
    /\b(?:track(?:ing)?|analyz(?:e|ing))\s*(?:bugs?|issues?|errors?)\b/i,    // QA / Engineering analysis
    /\b(?:features?|roadmap|prioritiz(?:e|ing|ation)|ideas?|impact\s+vs\s+effort)\b/i, // PM Decision workflows
  ];
  const matchCount = signals.filter(p => p.test(lower)).length;
  // Workflow if 3+ signals, or has both steps and structured output (columns/sheets)
  if (matchCount >= 3) return 'workflow';
  if (/\bstep\s*\d+\b/i.test(lower) && /\bcolumn\s*[a-g]\b/i.test(lower)) return 'workflow';
  if (/\b(?:jira|github\s*issues?|sentry)\b/i.test(lower) && /\b(?:bugs?|issues?|track(?:ing)?)\b/i.test(lower)) return 'workflow';
  if (/\b(?:prioritize|impact|effort|feature|roadmap)\b/i.test(lower)) return 'workflow';
  return 'content';
}

export function extractWorkflowComponents(text, originalText) {
  const lower = (originalText || text).toLowerCase();
  const orig = originalText || text;

  // --- Role ---
  let role = extractRole(orig);
  if (!role) {
    // Financial/analytical intent takes priority — objective is analysis, not just content gathering
    if (/\b(?:financial|finance|cost\s+optimi|revenue|pricing\s+strateg|business\s+margin|profitability|economic|investment)\b/i.test(lower)
      && /\b(?:insight|decision|analy|actionable|strateg)\b/i.test(lower)) {
      role = 'Financial analyst';
    } else if (/\b(?:research|rss|scrape|content\s+pipeline|daily\s+(?:research|content))\b/i.test(lower)) {
      role = 'Content research specialist';
    } else if (/\b(?:automat|workflow|pipeline|etl|data\s+(?:entry|collection))\b/i.test(lower)) {
      role = 'Workflow automation specialist';
    } else if (/\b(?:qa|quality\s*assurance|bug|tester|reliability|systems\s+analyst)\b/i.test(lower) || /\b(?:jira|sentry|github\s*issues?)\b/i.test(lower)) {
      role = 'QA Engineer';
    } else if (/\b(?:product\s+manager|roadmap|prioritiz(?:e|ation)|feature\s+requests?)\b/i.test(lower)) {
      role = 'Product Manager';
    } else {
      role = 'Domain expert';
    }
  }

  // --- Objective ---
  // Try to extract from "you need to" / "what you need to do" / opening context
  let objective = null;
  const objPatterns = [
    /(?:you\s+(?:need|have)\s+to|your\s+(?:task|job|goal)\s+is\s+to)\s+(.+?)(?:\.\s|\n|$)/im,
    /(?:objective|goal|purpose)\s*[:—]\s*(.+?)(?:\.\s|\n|$)/im,
    /\b(?:the\s+goal\s+is\s*(?:not\s+just.+?but\s*)?to)\s+(.+?)(?:\.\s|\n|$)/im,
    /\bneed\s+help\s+(?:setting\s+up|with|figuring\s+out)\s+(.+?)(?:\.\s|\n|$)/im,
    /\b(?:analyze|track|monitor)\s*(?:and|to)?\s*(?:track|analyze)?\s*(?:bugs?|issues?|errors?).+?(?:patterns?|root\s*causes?|improve).+?(?:\.\s|\n|$)/im,
    /\b(?:analyze|prioritize)\s+(?:product\s+)?(?:ideas|features).+?(?:feedback|business\s+goals?).+?(?:\.\s|\n|$)/im,
  ];
  for (const p of objPatterns) {
    const m = orig.match(p);
    if (m && m[1].trim().length > 10) {
      objective = m[1].trim().replace(/^\w/, c => c.toUpperCase());
      break;
    }
  }
  // Fallback: extract task the normal way
  if (!objective) {
    objective = extractTask(text);
  }

  // --- Context ---
  const context = [];
  // Extract "who is this for" context
  const forMatch = orig.match(/\b(?:for|who)\s+(?:a\s+)?([\w\s]+(?:consultant|specialist|manager|engineer|expert|person|client|team|company|owner|business))\b/i);
  if (forMatch) {
    context.push(`For: ${forMatch[1].trim()}`);
  }
  // Extract expertise/knowledge areas
  const knowledgeMatches = orig.match(/\b(?:deep\s+)?knowledge\s+(?:on|in|of)\s+(.+?)(?:\.\s|\n|$)/gim);
  if (knowledgeMatches) {
    for (const km of knowledgeMatches) {
      const detail = km.replace(/\b(?:deep\s+)?knowledge\s+(?:on|in|of)\s+/i, '').trim().replace(/[.\n]+$/, '');
      if (detail.length > 3) context.push(`Expertise: ${detail}`);
    }
  }
  // Extract platform/channel info
  const platformMatch = orig.match(/\b(?:social\s+media\s+)?(?:platform|channel)s?\s*\(([^)]+)\)/i)
    || orig.match(/\bfor\s+(?:his|her|their)\s+(?:social\s+media\s+)?(?:platform|channel)?s?\s*\(([^)]+)\)/i);
  if (platformMatch) {
    context.push(`Platforms: ${platformMatch[1].trim()}`);
  } else {
    const platforms = [];
    if (/\blinkedin\b/i.test(lower)) platforms.push('LinkedIn');
    if (/\binstagram\b/i.test(lower)) platforms.push('Instagram');
    if (/\byoutube\b/i.test(lower)) platforms.push('YouTube');
    if (/\btwitter\b/i.test(lower) || /\b(?:x\.com)\b/i.test(lower)) platforms.push('Twitter/X');
    if (platforms.length > 0) context.push(`Platforms: ${platforms.join(', ')}`);
  }
  // Extract content goal/style
  const goalMatch = orig.match(/\bcontent\s+(?:more\s+)?towards?\s+(.+?)(?:\.\s|\n|$)/i);
  if (goalMatch) {
    context.push(`Content style: ${goalMatch[1].trim()}`);
  }

  // --- Topics ---
  const topics = [];
  // Look for list-like topic sections — match "topics on:", "find topics on:", etc.
  const topicPatterns = [
    /\b(?:topics?|categories|subjects?)\s*(?:to\s+(?:research|cover|find))?\s*(?:on)?:?\s*\n([\s\S]*?)(?:\n\s*\n(?:\s*\n)*(?:RSS|Data|Source|http|Here|Step|What|You|I\s)|\n(?:RSS|Data|Source|http|Here|Step|What|You|I\s))/im,
    /(?:find|research|cover)\s+(?:recent\s+)?topics?\s+(?:on|about)\s*:?\s*\n([\s\S]*?)(?:\n\s*\n(?:\s*\n)*(?:RSS|Data|Source|http|Here|Step|What|You|I\s)|\n(?:RSS|Data|Source|http|Here|Step|What|You|I\s))/im,
  ];
  for (const tp of topicPatterns) {
    if (topics.length > 0) break;
    const topicSection = orig.match(tp);
    if (topicSection) {
      const tLines = topicSection[1].split('\n')
        .map(l => l.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter(l => l.length > 2 && l.length < 80 && !/^https?:\/\//i.test(l));
      topics.push(...tLines);
    }
  }

  // Fallback: extract inline topic mentions like "things like X, Y, Z" or "like X, Y, and Z"
  if (topics.length === 0) {
    const inlineTopicPatterns = [
      /\b(?:things\s+like|such\s+as|including|like)\s+(.+?)(?:\.\s|\n\n|$)/im,
      /\b(?:keywords?\s+like|alerts?\s+for\s+keywords?\s+like)\s+(.+?)(?:\.\s|\n\n|$)/im,
    ];
    for (const itp of inlineTopicPatterns) {
      if (topics.length > 0) break;
      const inlineMatch = orig.match(itp);
      if (inlineMatch) {
        // Split comma/and-separated items, clean quotes
        const items = inlineMatch[1]
          .split(/,\s*(?:and\s+)?|\s+and\s+/)
          .map(i => i.replace(/^["'"]+|["'"]+$/g, '').trim())
          .filter(i => i.length > 2 && i.length < 60);
        if (items.length >= 2) topics.push(...items);
      }
    }
  }

  // --- Data Sources ---
  const dataSources = {};

  // Split original text into lines for section-based parsing
  const lines = orig.split('\n');
  let currentCategory = null;
  const urlRegex = /^(?:https?:\/\/)?[\w.-]+(?:\.[\w.-]+)+(?:\/[\w./?&=%#-]*)?$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check if this line is a URL-like entry
    const isUrl = urlRegex.test(line) && line.includes('.') && !line.includes('@') && line.length > 8;

    if (isUrl) {
      // Add to current category or create default
      const cat = currentCategory || 'Sources';
      if (!dataSources[cat]) dataSources[cat] = [];
      dataSources[cat].push(line);
    } else if (!isUrl && line.length > 2 && line.length < 60) {
      // Check if next non-empty line is a URL — if so, this is a category header
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length) {
        const nextLine = lines[j].trim();
        const nextIsUrl = urlRegex.test(nextLine) && nextLine.includes('.') && nextLine.length > 8;
        if (nextIsUrl) {
          currentCategory = line.replace(/[:.]$/, '').trim();
        }
      }
    }
  }

  // Check for Google Alerts or QA/PM Inputs
  if (/\bgoogle\s*alerts?\b/i.test(lower)) {
    dataSources['Google Alerts'] = ['Email-based signals'];
  }
  if (/\b(?:github\s*issues?|jira\s*tickets?|user\s+feedback|crash\s*logs?|sentry)\b/i.test(lower)) {
    const qaSources = [];
    if (/\bgithub\b/i.test(lower)) qaSources.push('GitHub Issues');
    if (/\bjira\b/i.test(lower)) qaSources.push('Jira tickets');
    if (/\b(?:user\s+)?feedback\b/i.test(lower)) qaSources.push('User feedback');
    if (/\b(?:crash\s*logs?|sentry)\b/i.test(lower)) qaSources.push('Crash logs (e.g., Sentry)');
    if (qaSources.length > 0) dataSources['Bug Reports'] = qaSources;
  }
  if (/\b(?:user\s+feedback|feature\s+requests?|product\s+analytics|competitor\s+analysis)\b/i.test(lower)) {
    const pmSources = [];
    if (/\buser\s+feedback\b/i.test(lower)) pmSources.push('User feedback (tickets, surveys, emails)');
    if (/\bfeature\s+requests?\b/i.test(lower)) pmSources.push('Feature requests');
    if (/\bproduct\s+analytics?\b/i.test(lower)) pmSources.push('Product analytics');
    if (/\bcompetitor\b/i.test(lower)) pmSources.push('Market and competitor insights');
    if (pmSources.length > 0) dataSources['Product Inputs'] = pmSources;
  }

  // --- Steps / Key Tasks ---
  const steps = [];
  const stepPattern = /\bstep\s*(\d+)\s*:?\s*(.+?)(?:\n|$)/gim;
  let stepMatch;
  while ((stepMatch = stepPattern.exec(orig)) !== null) {
    const stepText = stepMatch[2].trim();
    if (stepText.length > 3) {
      steps.push(stepText.replace(/^\w/, c => c.toUpperCase()));
    }
  }
  // Also extract "What you need to do" numbered items
  if (steps.length === 0) {
    const numberedPattern = /(?:^|\n)\s*(\d+)[.)]\s*(.+?)(?:\n|$)/gim;
    let nm;
    while ((nm = numberedPattern.exec(orig)) !== null) {
      const stepText = nm[2].trim();
      if (stepText.length > 3) {
        steps.push(stepText.replace(/^\w/, c => c.toUpperCase()));
      }
    }
  }
  // Fallback: looking for gerund lists if no numbered steps
  if (steps.length === 0) {
    const taskListMatch = orig.match(/\b(?:actions?|tasks?|do|steps?)\s*[:—]\s*\n([\s\S]*?)(?:\n\s*\n|\n(?:Data|Source|http|Here|Column|Output|Tools))/im);
    if (taskListMatch) {
      const tLines = taskListMatch[1].split('\n')
        .map(l => l.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter(l => l.length > 3 && l.length < 80);
      steps.push(...tLines);
    } else if (/\b(?:identif|analyz|categoriz|assess|detect|group|align|evaluat|assign)\b/i.test(lower)) {
       // specific check for the QA analytical patterns when formatted loosely
       const taskVerbs = orig.match(/(?:identifying|analyzing|figuring out|categorizing|assessing|detecting|grouping|aligning|evaluating|assigning)\s+(.+?)(?:,|\.|and|$)/gi);
       if (taskVerbs) {
         steps.push(...taskVerbs.map(t => {
           let action = t.trim().replace(/^and\s+/i, '').trim();
           // Gerund to imperative
           action = action.replace(/^(identifying|analyzing|figuring out|categorizing|assessing|detecting|grouping|aligning|evaluating|assigning)\s+/i, (m, v) => {
             const vLower = v.toLowerCase();
             if (vLower === 'identifying') return 'Identify ';
             if (vLower === 'analyzing') return 'Analyze ';
             if (vLower === 'figuring out') return 'Determine ';
             if (vLower === 'categorizing') return 'Categorize ';
             if (vLower === 'assessing') return 'Assess ';
             if (vLower === 'detecting') return 'Detect ';
             if (vLower === 'grouping') return 'Group ';
             if (vLower === 'aligning') return 'Align ';
             if (vLower === 'evaluating') return 'Evaluate ';
             if (vLower === 'assigning') return 'Assign ';
           });
           return action.charAt(0).toUpperCase() + action.slice(1);
         }));
       }
    }
  }

  // --- Output Format ---
  const outputFormat = [];
  const columnPattern = /\bcolumn\s*([a-g])\s*:?\s*(.+?)(?:\n|$)/gim;
  let colMatch;
  while ((colMatch = columnPattern.exec(orig)) !== null) {
    const col = colMatch[1].toUpperCase();
    let desc = colMatch[2].trim();
    if (desc.endsWith(')')) desc = desc.slice(0, -1);
    desc = desc.replace(/^\(/, '');
    
    // Clean parenthetical details for cleaner format
    const parenMatch = desc.match(/^(.+?)\s*\((.+)$/);
    if (parenMatch) {
      desc = `${parenMatch[1].trim()} — ${parenMatch[2].trim()}`;
    }
    outputFormat.push(`Column ${col}: ${desc}`);
  }

  // --- Tools ---
  const tools = [];
  if (/\bgoogle\s*sheet/i.test(lower) || /\bexcel\s*sheet\b/i.test(lower) && /\bgoogle\.com\/spreadsheets\b/i.test(lower)) tools.push('Google Sheets');
  if (/\bmon[ao]co\s*editor/i.test(lower)) tools.push('Monaco Editor');
  if (/\bexcel\b/i.test(lower) && !tools.includes('Google Sheets')) tools.push('Excel');
  if (/\bnotion\b/i.test(lower)) tools.push('Notion');
  if (/\bairtable\b/i.test(lower)) tools.push('Airtable');

  // --- Guidelines ---
  // Only add guidelines that are explicitly stated or directly requested in the prompt
  // Avoid inferring guidelines from vague keywords to prevent token bloat
  const guidelines = [];
  if (/\bavoid\s+duplic/i.test(lower)) guidelines.push('Avoid duplication');
  if (/\bscrape\b/i.test(lower) && /\bclean\b/i.test(lower)) guidelines.push('Clean scraped content');
  if (/\b(?:actionable|relevant)\b/i.test(lower) && /\b(?:make\s+sure|ensure|must|should)\b/i.test(lower)) guidelines.push('Ensure summaries are actionable and relevant');
  if (/\bdecision[- ]?making\b/i.test(lower)) guidelines.push('Focus on business decision-making');
  if (/\bavoid\s+(?:generic|general)\b/i.test(lower)) guidelines.push('Filter out generic news');
  if (/\bpractical\s+takeaway/i.test(lower) || /\bhighlight\s+practical\b/i.test(lower)) guidelines.push('Highlight practical takeaways');
  if (/\b(?:business|key)\s+metrics\b/i.test(lower) && /\b(?:focus|priorit|move)\b/i.test(lower)) guidelines.push('Focus on features that impact key business metrics');
  if (/\b(?:justify|highlight\s+why)\b/i.test(lower)) guidelines.push('Clearly justify prioritization decisions');
  if (/\bsynthesize\b/i.test(lower) || /\bdon'?t\s+just\s+copy\b/i.test(lower)) guidelines.push('Synthesize inputs, don\'t just copy');
  if (/\bgroup\s+similar\b/i.test(lower)) guidelines.push('Group similar items');

  return { role, objective, context, topics, dataSources, steps, outputFormat, tools, guidelines };
}

export function buildWorkflowPrompt(components) {
  const sections = [];

  if (components.role) {
    sections.push(`Role: ${components.role}`);
  }

  if (components.objective) {
    sections.push(`Objective: ${components.objective}`);
  }

  if (components.context.length > 0) {
    sections.push(`Context:\n${components.context.join('\n')}`);
  }

  if (components.topics.length > 0) {
    // Compact: comma-separated if all topics are short, otherwise bare lines
    const allShort = components.topics.every(t => t.length <= 30);
    if (allShort && components.topics.length <= 12) {
      sections.push(`Topics: ${components.topics.join(', ')}`);
    } else {
      sections.push(`Topics:\n${components.topics.join('\n')}`);
    }
  }

  if (Object.keys(components.dataSources).length > 0) {
    let sourceText = 'Inputs:';
    for (const [category, urls] of Object.entries(components.dataSources)) {
      if (Object.keys(components.dataSources).length === 1 && (category === 'Sources' || category === 'Bug Reports')) {
        sourceText += '\n' + urls.join('\n');
      } else {
        sourceText += `\n${category}:`;
        sourceText += '\n' + urls.join('\n');
      }
    }
    sections.push(sourceText);
  }

  if (components.steps.length > 0) {
    sections.push(`Key Tasks:\n${components.steps.join('\n')}`);
  }

  if (components.outputFormat.length > 0) {
    sections.push(`Output Format:\n${components.outputFormat.join('\n')}`);
  }

  if (components.tools.length > 0) {
    sections.push(`Tools: ${components.tools.join(', ')}`);
  }

  if (components.guidelines.length > 0) {
    sections.push(`Guidelines:\n${components.guidelines.join('\n')}`);
  }

  return fixCasing(sections.join('\n\n'));
}
