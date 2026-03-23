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
  ];
  const matchCount = signals.filter(p => p.test(lower)).length;
  // Workflow if 3+ signals, or has both steps and structured output (columns/sheets)
  if (matchCount >= 3) return 'workflow';
  if (/\bstep\s*\d+\b/i.test(lower) && /\bcolumn\s*[a-g]\b/i.test(lower)) return 'workflow';
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
    /\b(?:the\s+goal\s+is\s+to)\s+(.+?)(?:\.\s|\n|$)/im,
    /\bneed\s+help\s+(?:setting\s+up|with)\s+(.+?)(?:\.\s|\n|$)/im,
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

  // Check for Google Alerts
  if (/\bgoogle\s*alerts?\b/i.test(lower)) {
    dataSources['Google Alerts'] = ['Email-based signals'];
  }

  // --- Steps ---
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

  // --- Output Format ---
  const outputFormat = [];
  const columnPattern = /\bcolumn\s*([a-g])\s*:?\s*(.+?)(?:\n|$)/gim;
  let colMatch;
  while ((colMatch = columnPattern.exec(orig)) !== null) {
    const col = colMatch[1].toUpperCase();
    let desc = colMatch[2].trim().replace(/^\(/, '').replace(/\)$/, '');
    // Clean parenthetical details for cleaner format
    const parenMatch = desc.match(/^(.+?)\s*\((.+)\)$/);
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
  const guidelines = [];
  if (/\binformative\b/i.test(lower)) guidelines.push('Prioritize recent and high-impact insights');
  if (/\bavoid\s+duplicate/i.test(lower) || topics.length > 0) guidelines.push('Avoid duplicate topics');
  if (/\bscrape\b/i.test(lower) || /\bclean\b/i.test(lower)) guidelines.push('Clean scraped content (remove ads, noise, formatting issues)');
  if (/\b(?:actionable|useful|relevant)\b/i.test(lower)) guidelines.push('Ensure summaries are actionable and relevant');
  if (/\bdecision[- ]?making\b/i.test(lower) || /\b(?:financial|business)\s+(?:insight|decision)\b/i.test(lower)) guidelines.push('Focus on relevance to business decision-making');
  if (/\bavoid\s+(?:generic|general)\b/i.test(lower)) guidelines.push('Filter out generic news with no practical value');
  if (/\bpractical\s+takeaway/i.test(lower) || /\bhighlight\s+(?:practical|key)\b/i.test(lower)) guidelines.push('Highlight practical takeaways');
  if (/\bcontent\s+creat/i.test(lower) || /\bsocial\s+media\b/i.test(lower)) guidelines.push('Focus on insights useful for content creation');

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
    sections.push(`Context:\n${components.context.map(c => `- ${c}`).join('\n')}`);
  }

  if (components.topics.length > 0) {
    sections.push(`Topics:\n${components.topics.map(t => `- ${t}`).join('\n')}`);
  }

  if (Object.keys(components.dataSources).length > 0) {
    let sourceText = 'Data Sources:';
    for (const [category, urls] of Object.entries(components.dataSources)) {
      if (Object.keys(components.dataSources).length === 1 && category === 'Sources') {
        sourceText += '\n' + urls.map(u => `- ${u}`).join('\n');
      } else {
        sourceText += `\n${category}:`;
        sourceText += '\n' + urls.map(u => `- ${u}`).join('\n');
      }
    }
    sections.push(sourceText);
  }

  if (components.steps.length > 0) {
    sections.push(`Steps:\n${components.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
  }

  if (components.outputFormat.length > 0) {
    sections.push(`Output Format:\n${components.outputFormat.map(f => `- ${f}`).join('\n')}`);
  }

  if (components.tools.length > 0) {
    sections.push(`Tools:\n${components.tools.map(t => `- ${t}`).join('\n')}`);
  }

  if (components.guidelines.length > 0) {
    sections.push(`Guidelines:\n${components.guidelines.map(g => `- ${g}`).join('\n')}`);
  }

  return fixCasing(sections.join('\n\n'));
}
