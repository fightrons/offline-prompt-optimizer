import { hardCleanup, compressClarity, fixCasing } from '../utils.js';

export function extractRole(text) {
  const rolePatterns = [
    /(?:you are|act as|role:?\s*)\s*(?:a |an )?([\w\s]+(?:writer|engineer|developer|designer|analyst|expert|teacher|educator|consultant|advisor|strategist|planner|scientist|researcher|translator|editor|reviewer|manager|architect|specialist))(?:\.|,|$)/im,
    /(?:imagine you(?:'re| are))\s+(?:a |an )?([\w\s]+(?:writer|engineer|developer|designer|analyst|expert|teacher|educator|consultant|advisor|strategist))(?:\.|,|$)/im,
  ];
  for (const pattern of rolePatterns) {
    const match = text.match(pattern);
    if (match && match[1].trim().length > 3 && match[1].trim().length < 80) {
      return match[1].trim().replace(/^\w/, c => c.toUpperCase());
    }
  }
  return null;
}

export function extractTask(text) {
  const cleaned = text
    .replace(/\b(you are|act as|role:?|imagine you).+?[.,]/gi, '')
    .trim();

  // Core QA/Engineering Intent Override
  if (/\b(?:track(?:ing)?|analyz(?:e|ing)|monitor(?:ing)?|log(?:ging)?)\s+(?:bugs?|issues?|errors?|crashes?)\b/i.test(cleaned) ||
      /\b(?:github\s*issues?|jira\s*tickets?|sentry)\b/i.test(cleaned) && /\b(?:bugs?|issues?|patterns?|root\s*causes?)\b/i.test(cleaned)) {
    return 'Analyze and track software bugs to identify patterns, root causes, and improve system stability';
  }

  const taskPatterns = [
    // 1. Decision / Strategic (Highest Priority)
    /(?:help me |help us |can you )?(prioritize|evaluate options|strategize)\s+(.+?)(?:[.?!]|$)/im,
    /(?:help me |help us |can you )plan\s+(.+?)(?:[.?!]|$)/im,
    // 2. Analysis
    /(?:help me |help us )?(analyze|review|compare|evaluate|investigate|assess)\s+(.+?)(?:[.?!]|$)/im,
    // 3. Workflow / Transformation
    /(?:help me |help us )?(translate|convert|transform|rewrite|edit|fix|debug|refactor|optimize|update)\s+(.+?)(?:[.?!]|$)/im,
    // 4. Content / Creation
    /(?:help me |help us )?(write|create|build|generate|design|develop|draft|compose|produce|prepare|outline|summarize|explain|describe)\s+(.+?)(?:[.?!]|$)/im,
    // Basic gerund fallback
    /\b(building|creating|developing|designing|writing|making|analyzing|prioritizing)\s+(?:something\s+like\s+)?(.+?)(?:[.?!]|$)/im,
  ];

  // Priority extraction: Instead of earliest match index, find the first matching pattern in priority order
  let bestMatch = null;
  for (const pattern of taskPatterns) {
    const match = cleaned.match(pattern);
    // Extra validation for gerund fallback: ensure the captured verb isn't preceded by noise 
    if (match) {
      bestMatch = match;
      break; // Since array is sorted by Decision > Analysis > Workflow > Content
    }
  }

  if (bestMatch) {
    const match = bestMatch;
    {
      let rawVerb = match[1].toLowerCase();
      // Normalize gerund to imperative: "building" → "build", "creating" → "create"
      if (rawVerb.endsWith('ing')) {
        rawVerb = rawVerb.replace(/ing$/, '');
        if (rawVerb.endsWith('t')) rawVerb = rawVerb + 'e'; // "writ" → "write", "creat" → "create"
        else if (rawVerb.endsWith('k')) { /* "mak" → needs special handling */ }
        if (rawVerb === 'mak') rawVerb = 'make';
        if (rawVerb === 'develop') rawVerb = 'develop'; // already correct
      }
      const verb = rawVerb.charAt(0).toUpperCase() + rawVerb.slice(1);
      let obj = match[2].trim();
      // Aggressively trim trailing noise from the object
      obj = obj
        .replace(/\s*,\s*(?:about|but|and|or|not|if|because|since|like|it|i)\b.*$/i, '')
        .replace(/\s+(that|which|where|with|and|but)\s*$/, '')
        .trim();
      if (obj.length > 3) {
        let task = `${verb} ${obj}`;

        // Look anywhere in text for "about/on/regarding" clause to enrich the task
        const topicMatch = cleaned.match(/\b(?:about|regarding|concerning)\s+(?:the\s+)?(.+?)(?:\.|,|$)/im);
        if (topicMatch && topicMatch[1].trim().length > 5) {
          const topic = topicMatch[1].trim().toLowerCase();
          // Skip generic/non-topic phrases
          if (!/\b(mobile|desktop|this|that|it|how|what|where)\b/i.test(topic.split(/\s+/).slice(0, 2).join(' '))) {
            // Only append if not already in the task
            if (!task.toLowerCase().includes(topic.split(/\s+/)[0])) {
              task += ` on ${topic}`;
            }
          }
        }

        // Final task sanitizer — hard clamp conversational tails + noise
        task = task
          .replace(/,?\s*(?:or whatever|you know|like with|something like that|if that makes sense|I think|I guess|I feel like|I was wondering).*$/i, '')
          .replace(/\blike a\s+(?:rough\s+)?(?:plan|outline|idea)\b/gi, '')
          .replace(/\bor steps\b/gi, '')
          .replace(/\bfor how to (?:build|make|do) this\b/gi, '')
          .replace(/\b(help me|help us|figure it out|something|stuff|things|some sort of|or something|whatever\s*works?|if it's not too much trouble|man,?\s*)\b/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        // Second-pass cleanup on extracted task to catch any remaining soft language
        task = hardCleanup(task)
          .replace(/^[,.\s]+/, '')
          .replace(/[,.\s]+$/, '')
          .trim();
        // Normalize "guide/tutorial about" → "guide on" for cleaner phrasing
        task = task.replace(/\b(guide|tutorial)\s+about\b/i, '$1 on');

        // Enrich thin tasks with product context from full text — STRICT GATE
        // Only fire when the user explicitly says they want to build a SaaS/MVP/product.
        // The verb "build/create/develop/launch" must appear in the same sentence as
        // "saas/mvp/product/startup/app" to prevent leakage from incidental mentions
        // (e.g., "marketing, product, sales" where "product" is a department name).
        const fullLower = text.toLowerCase();
        const hasBuildVerb = /\b(?:build(?:ing)?|creat(?:e|ing)|develop(?:ing)?|launch(?:ing)?|mak(?:e|ing))\b/i;
        const hasProductNoun = /\b(?:mvp|saas|product|startup|app|application|platform)\b/i;
        const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
        const hasExplicitBuildProduct = sentences.some(s =>
          hasBuildVerb.test(s) && hasProductNoun.test(s) &&
          // Exclude sentences where the build verb itself is hedged:
          // "maybe we should build" = hedged, but "building something like a SaaS product" = not hedged
          !/\b(?:maybe|perhaps)\s+(?:we\s+)?(?:should|could|might)\s+(?:build|create|develop)\b/i.test(s)
        );
        if (task.split(/\s+/).length <= 3 && hasExplicitBuildProduct) {
          // Extract what the product is about
          const productMatch = fullLower.match(/\b(?:saas|app|application|product|platform)\s+(?:for|about|to\s+(?:help\s+with\s+)?)\s*(.+?)(?:\.|,|$)/i)
            || fullLower.match(/\b(?:for|about)\s+(task\s+management|project\s+management|[\w\s]+?(?:management|tracking|scheduling|monitoring))\b/i);
          const productDesc = productMatch ? productMatch[1].trim() : '';
          const desc = productDesc ? ` for ${productDesc}` : '';
          task = `Plan and outline the development of a small SaaS MVP${desc}`;
        }

        return task;
      }
    }
  }

  const sentences = cleaned.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
  if (sentences.length > 0) {
    let task = sentences[0].replace(/^\w/, c => c.toUpperCase());
    if (task.length > 120) task = task.slice(0, 120).trim();
    return task;
  }
  return null;
}

export function extractConstraints(text) {
  const constraints = [];
  const lower = text.toLowerCase();

  // Tone — detect compound tones like "professional but not too boring"
  const toneWords = ['professional', 'casual', 'formal', 'friendly', 'simple', 'academic', 'conversational', 'humorous', 'serious', 'persuasive', 'informative'];
  const detectedTones = [];
  for (const tone of toneWords) {
    // Skip if negated — "not too X", "nothing too X", "no X", "without X"
    if (new RegExp(`\\b(?:not|nothing|no|without)\\s+(?:too\\s+)?${tone}\\b`, 'i').test(lower)) continue;
    // Skip "simple" when used for implementation simplicity, not writing tone
    // e.g., "simple implementation", "cheap and simple" — but NOT "simple language" (that's writing tone)
    if (tone === 'simple' && !(/\bsimple\s+(?:language|terms?|words?|tone|style|writing)\b/i.test(lower))
        && /\b(?:keep\s+it\s+(?:\w+\s+and\s+)?simple(?!\s+(?:language|terms?|words?))|simple\s+(?:implementation|architecture|approach|solution|setup|stack|design)|(?:cheap|budget|affordable)\s+and\s+simple|simple\s+and\s+(?:cheap|fast|lean|affordable))\b/i.test(lower)) continue;
    if (new RegExp(`\\b${tone}\\b`, 'i').test(lower)) {
      detectedTones.push(tone.charAt(0).toUpperCase() + tone.slice(1));
    }
  }
  // "technical" is special — only add as tone if not negated
  if (/\btechnical\b/i.test(lower) && !/\b(?:not|nothing|no|without)\s+(?:too\s+)?technical\b/i.test(lower) && !/\bnon-technical\b/i.test(lower)) {
    detectedTones.push('Technical');
  }
  // Detect accessibility signals
  const accessibilitySignals = [
    /\b(?:not|nothing) too (?:technical|complicated|complex|boring)\b/i,
    /\bdon't.+?understand.+?complicated\b/i,
    /\bnon-technical\b/i,
    /\beasy to (?:understand|read|follow)\b/i,
    /\bsimple (?:language|terms|words)\b/i,
    /\baccessible\b/i,
  ];
  const isAccessible = accessibilitySignals.some(p => p.test(lower));
  if (detectedTones.length > 0 || isAccessible) {
    let tone = detectedTones.join(' and ');
    if (isAccessible) {
      tone = tone ? `${tone} (non-technical audience)` : 'Accessible (non-technical audience)';
    }
    if (tone) constraints.push(`Tone: ${tone}`);
  }

  // Length — detect ranges like "800 to 1000 words"
  const rangeMatch = lower.match(/\b(\d+)\s*(?:to|-|–)\s*(\d+)\s*(?:words|word)\b/i);
  if (rangeMatch) {
    constraints.push(`Length: ${rangeMatch[1]}–${rangeMatch[2]} words`);
  } else {
    const lengthMatch = lower.match(/\b(?:around|about|approximately|roughly|~)?\s*(\d+)\s*(?:words|word)\b/i)
      || lower.match(/\b(?:under|at most|maximum|max|no more than|limit to)\s*(\d+)\s*(?:words|word)\b/i);
    if (lengthMatch) {
      constraints.push(`Length: ~${lengthMatch[1]} words`);
    }
  }

  // Language
  const langMatch = lower.match(/\b(?:in |write in |respond in |use )(english|spanish|french|german|chinese|japanese|korean|portuguese|italian|russian|arabic|hindi)\b/i);
  if (langMatch) {
    constraints.push(`Language: ${langMatch[1].charAt(0).toUpperCase() + langMatch[1].slice(1)}`);
  }

  // Audience — capture the base audience + parenthetical qualifier if present
  const audienceMatch = text.match(/\b(?:for|target|audience|aimed at|written for)\s*(?:a |an )?(beginners?|experts?|developers?|students?|children|kids|professionals?|managers?|executives?|non-technical|technical)(?:\s+(developers?|engineers?|users?|readers?|audiences?))?\s*(\([^)]+\))?/i);
  if (audienceMatch) {
    let audience = audienceMatch[1].charAt(0).toUpperCase() + audienceMatch[1].slice(1);
    if (audienceMatch[2]) audience += ' ' + audienceMatch[2].toLowerCase();
    if (audienceMatch[3]) audience += ' ' + audienceMatch[3];
    constraints.push(`Audience: ${audience}`);
  }

  // Intermediate audience upgrade — "know what they're doing but haven't done X" / "not beginners but not experts"
  const intermediateSignals = [
    /\b(?:know\s+(?:what\s+they'?re\s+doing|the\s+basics?)|not\s+(?:complete\s+)?beginners?\s+but\s+(?:also\s+)?not\s+experts?|some\s+experience)\b/i,
    /\bhaven'?t\s+(?:really\s+)?(?:done|used|tried|worked\s+with)\s+(.+?)\s+before\b/i,
  ];
  const hasIntermediateSignal = intermediateSignals.some(s => s.test(lower));
  if (hasIntermediateSignal) {
    // Remove basic audience if we're upgrading to intermediate
    const basicIdx = constraints.findIndex(c => c.startsWith('Audience:'));
    if (basicIdx !== -1) constraints.splice(basicIdx, 1);
    const newToMatch = lower.match(/\bhaven'?t\s+(?:really\s+)?(?:done|used|tried|worked\s+with)\s+(.+?)\s+(?:before|yet)\b/i);
    const domain = newToMatch ? newToMatch[1].replace(/\b(stuff|things)\b/gi, '').trim() : null;
    const audience = domain
      ? `Intermediate developers (new to ${domain})`
      : 'Intermediate developers';
    constraints.push(`Audience: ${audience}`);
  }

  // Tech stack detection — require "in/with/use/want it in" context to avoid topic false positives
  // e.g., "build it in React" = tech stack, "write about React hooks" = topic, not stack
  const techStackPatterns = [
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(react(?:\.?js)?|reactjs)\b/i, 'React.js'],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(next\.?js|nextjs)\b/i, 'Next.js'],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(node\.?js|nodejs)\b/i, 'Node.js'],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(vue\.?js|vuejs)\b/i, 'Vue.js'],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(angular)\b/i, 'Angular'],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(svelte)\b/i, 'Svelte'],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(django|flask|fastapi|express)\b/i, null],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(tailwind(?:\s*css)?)\b/i, 'Tailwind CSS'],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(python)\b/i, 'Python'],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(typescript|ts)\b/i, 'TypeScript'],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(javascript|js)\b/i, 'JavaScript'],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(rust)\b/i, 'Rust'],
    [/\b(?:in|with|use|using|want\s+(?:it\s+)?in)\s+(go(?:lang)?)\b/i, 'Go'],
  ];
  // Uncertainty detection — "maybe Next.js or React", "I've heard", "not sure" = suggestion, not requirement
  const isUncertain = (techName) => {
    const techPattern = new RegExp(`\\b(?:maybe|perhaps|heard|not sure|might|could)\\b[^.]*\\b${techName}\\b|\\b${techName}\\b[^.]*\\b(?:or something|not sure|might)\\b`, 'i');
    return techPattern.test(lower);
  };

  for (const [pattern, label] of techStackPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const tech = label || match[1].charAt(0).toUpperCase() + match[1].slice(1);
      // Skip if mentioned with uncertainty — will be captured as suggestion in key points instead
      if (!isUncertain(match[1])) {
        constraints.push(`Use ${tech}`);
      }
    }
  }

  // No-database constraint
  if (/\bno\s+database\b/i.test(lower) || /\bwithout\s+(?:a\s+)?database\b/i.test(lower) || /\bignore\s+(?:any\s+)?database\b/i.test(lower) || /\bdon'?t\s+(?:need|want|use)\s+(?:a\s+)?database\b/i.test(lower)) {
    constraints.push('No database required');
  }

  // Responsive / mobile-friendly UI
  if (/\bresponsive\b/i.test(lower) || /\bmobile[- ]?friendly\b/i.test(lower) || /\bmobile\s+users?\b/i.test(lower) || /\bworks?\s+(?:\w+\s+)?on\s+mobile\b/i.test(lower)) {
    constraints.push('Ensure mobile-friendly design');
  }

  // Cost sensitivity — only when talking about money/budget, not "keep it simple" for writing style
  if (/\b(?:cheap|budget|low[- ]?cost|affordable|free\s+tier|minimize\s+cost|cost[- ]?effective)\b/i.test(lower)
    || /\bspend\s+(?:too\s+)?much\s+(?:money|cash|budget)?\b/i.test(lower)
    || /\bkeep\s+it\s+cheap\b/i.test(lower)) {
    constraints.push('Prioritize low-cost implementation');
  }

  // Avoid over-engineering — only when explicitly building + product context co-occur
  // in the same sentence, or explicit "over-engineer" phrase is used.
  // Prevents leakage when "product" is a department name.
  {
    const constraintSentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
    const hasExplicitBuildForOverEng = constraintSentences.some(s =>
      /\b(?:build|develop|create|implement|launch)\b/i.test(s) &&
      /\b(?:mvp|saas|startup)\b/i.test(s) &&
      !/\b(?:maybe|perhaps)\s+(?:we\s+)?(?:should|could|might)\s+(?:build|create|develop)\b/i.test(s)
    );
    if (/\b(?:over[- ]?engineer|too\s+(?:fancy|complex|complicated))\b/i.test(lower)
      || (/\bkeep\s+it\s+simple\b/i.test(lower) && /\b(?:mvp|saas|product|build|develop|implement|architect)\b/i.test(lower))
      || hasExplicitBuildForOverEng) {
      constraints.push('Avoid over-engineering');
    }
  }

  return constraints;
}

export function extractKeyPoints(text, originalText, intent = 'content', domain = 'general') {
  const points = [];
  const lower = text.toLowerCase();
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);

  // Pattern-based extraction from sentences
  const contentPatterns = [
    /\b(?:about|cover|mention|discuss|address|talk about|focus on)\s+(?:the )?(.+)/i,
    /\b(?:benefits? of|advantages? of|reasons? for|importance of)\s+(.+)/i,
  ];

  for (const sentence of sentences) {
    for (const pattern of contentPatterns) {
      const match = sentence.match(pattern);
      if (match) {
        let point = match[1].trim();
        // Clean conversational tails and noise before processing
        point = point
          .replace(/,?\s*(?:you know|like|kind of|sort of|I think|I guess|I feel like).*$/i, '')
          .replace(/\s+(?:somewhere|in there|out there|if you can|if possible)\b.*$/i, '')
          .replace(/\s+(?:when they'?re|who are|people)\s+.*$/i, '')
          .replace(/\s+(that|which|because|since|as|so|and|but)\s.*$/, '');
        point = compressClarity(point);
        point = point.replace(/^\w/, c => c.toUpperCase());
        const words = point.split(/\s+/).filter(w => w.length > 2);
        // Skip if it matches a semantic signal prefix (semantic extraction will add a cleaner version)
        const semanticPrefixes = ['challenges', 'risks', 'real-world', 'statistics', 'conclusion', 'compare', 'pros and cons', 'common mistakes', 'docker'];
        const isSemanticDupe = semanticPrefixes.some(p => point.toLowerCase().startsWith(p));
        if (point.length > 5 && point.length < 150 && words.length >= 2 && !points.includes(point) && !isSemanticDupe) {
          points.push(point);
        }
      }
    }
  }

  // Semantic signal detection — things the user wants covered
  const semanticSignals = [
    [/\b(?:challenges?|risks?|downsides?|drawbacks?|limitations?|concerns?|problems?)\b/i, null],
    [/\b(?:real[- ]?world|practical)\s*(?:examples?|cases?|use cases?|applications?)\b/i, 'Real-world examples and applications'],
    [/\b(?:how\s+(?:\w+\s+)?(?:are|is)\s+(?:using|leveraging|implementing|adopting))\b/i, 'Real-world examples and applications'],
    [/\b(?:include|provide|add|show|with)\s+(?:relevant\s+)?(?:statistics?|stats|numerical\s+data|figures)\b/i, 'Include relevant statistics'],
    [/\b(?:conclusion|summary|wrap\s*up|closing|final\s+(?:thoughts?|remarks?))\b/i, 'Provide a clear conclusion'],
    [/\b(?:compare|comparison|difference between|pros?\s+(?:and|&)\s+cons?|trade-?offs?|advantages?\s+(?:and|&)\s+disadvantages?)\b/i, null], // handled below with tool detection
    [/\b(?:common\s+)?(?:mistakes?|pitfalls?|gotchas?|anti-?patterns?)\b/i, null], // handled below with example extraction
  ];

  for (const [pattern, label] of semanticSignals) {
    if (!pattern.test(lower)) continue;

    if (label) {
      if (!points.includes(label)) points.push(label);
      continue;
    }

    // Handle null-label signals with example extraction
    if (/\b(?:challenges?|risks?|downsides?|drawbacks?|limitations?|concerns?|problems?)\b/i.test(lower) && pattern.source.includes('challenges')) {
      let example = '';
      const examplePatterns = [
        /\b(?:challenges?|risks?)\b[^.]*?(?:like|such as|e\.?g\.?|for example)\s+([\w\s]+?)(?:\.|,|\band\b|$)/i,
        /\b(?:challenges?|risks?)\b[^.]*\.[^.]*?(?:like|such as|e\.?g\.?|for example)\s+([\w\s]+?)(?:\.|,|\band\b|$)/i,
        /\b(?:data privacy|bias|security|accuracy|fairness|transparency|regulation|compliance|ethical|consent)\b/i,
      ];
      for (const ep of examplePatterns) {
        const em = lower.match(ep);
        if (em) {
          const candidate = (em[1] ? em[1].trim() : em[0].trim());
          if (candidate && !/\b(perfect|anything|something|good|bad|sound|want)\b/i.test(candidate) && candidate.length >= 3 && candidate.length <= 40) {
            example = candidate;
            break;
          }
        }
      }
      const point = example
        ? `Challenges and risks (e.g., ${example.toLowerCase()})`
        : 'Challenges and risks';
      if (!points.includes(point)) points.push(point);
    }

    // Compare/pros-cons — detect specific tools being compared
    if (/\b(?:compare|comparison|difference|pros?\s+(?:and|&)\s+cons?|trade-?offs?)\b/i.test(lower) && pattern.source.includes('compare')) {
      // Try to find specific tools/approaches being compared
      const toolPairs = lower.match(/\b(github\s*actions|jenkins|gitlab|circleci|travis)\b/gi);
      if (toolPairs && toolPairs.length >= 2) {
        const unique = [...new Set(toolPairs.map(t => t.trim().replace(/\b\w/g, c => c.toUpperCase())))];
        const point = `Compare tools: ${unique.join(' vs ')} (pros and cons)`;
        if (!points.includes(point)) points.push(point);
      } else {
        const point = 'Compare approaches (pros and cons)';
        if (!points.includes(point)) points.push(point);
      }
    }

    // Common mistakes/pitfalls — extract specific examples
    if (/\b(?:common\s+)?(?:mistakes?|pitfalls?|gotchas?|anti-?patterns?)\b/i.test(lower) && pattern.source.includes('mistakes')) {
      let example = '';
      const mistakePatterns = [
        /\b(?:mistakes?|pitfalls?)\b[^.]*?(?:like|such as|e\.?g\.?|for example)\s+([\w\s,]+?)(?:\.|$)/i,
        /\b(?:secrets?|credentials?|storing secrets|security)\b/i,
        /\b(?:over\s*build|lack\s+of\s+validation)\b/i,
      ];
      for (const mp of mistakePatterns) {
        const mm = lower.match(mp);
        if (mm) {
          let candidate = (mm[1] ? mm[1].trim() : mm[0].trim());
          // Clean noise from example
          candidate = candidate
            .replace(/\b(stuff|things|and such)\b/gi, '')
            .replace(/\s+,/g, ',')
            .replace(/,\s*,/g, ',')
            .replace(/^\s*,\s*/, '')
            .replace(/,\s*$/, '')
            .replace(/\s+/g, ' ')
            .trim();
          // Normalize specific mistake descriptions
          candidate = candidate
            .replace(/\bnot storing (secrets?|credentials?) properly\b/i, 'handling $1')
            .replace(/\bnot\s+\w+ing\s+(\w+)\s+properly\b/i, 'handling $1')
            .replace(/\bover\s*build\b/i, 'overbuilding')
            .replace(/\black\s+of\s+validation\b/i, 'lack of validation');
          if (candidate && candidate.length >= 3 && candidate.length <= 60) {
            example = candidate;
            break;
          }
        }
      }
      const point = example
        ? `Common mistakes (e.g., ${example.toLowerCase().replace(/,\s*$/, '')})`
        : 'Common mistakes and pitfalls';
      if (!points.includes(point)) points.push(point);
    }
  }

  // Docker/container mention — add as key point if mentioned as something to include
  if (/\b(?:mention|include|cover)\s+(?:\w+\s+)*?(?:docker|containers?|containerization)\b/i.test(lower)
    || /\b(?:docker|containers?)\b/i.test(lower) && /\b(?:important|must|need|should)\b/i.test(lower)) {
    const point = 'Docker integration in the workflow';
    if (!points.includes(point)) points.push(point);
  }

  // MVP/product signals — STRICT GATE: build verb + product noun must co-occur
  // in the same sentence AND not be hedged with uncertainty language.
  // Prevents leakage when "product" is a department name or incidental mention.
  const mvpSentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
  const hasExplicitMvpBuild = mvpSentences.some(s =>
    /\b(?:build(?:ing)?|develop(?:ing)?|creat(?:e|ing)|implement(?:ing)?|launch(?:ing)?)\b/i.test(s) &&
    /\b(?:mvp|minimum viable product|saas|startup)\b/i.test(s) &&
    !/\b(?:maybe|perhaps)\s+(?:we\s+)?(?:should|could|might)\s+(?:build|create|develop)\b/i.test(s)
  );
  if (hasExplicitMvpBuild) {
    const mvpPoint = 'Define MVP scope and core features';
    if (!points.includes(mvpPoint)) points.push(mvpPoint);
  }

  // Feature flag detection — offline/local, AI, etc.
  if (/\b(?:offline|locally|local\s+(?:system|mode|processing)|without\s+internet)\b/i.test(lower)) {
    const offlinePoint = 'Optimize prompts locally (offline)';
    if (!points.includes(offlinePoint)) points.push(offlinePoint);
  }
  if (/\b(?:optional\s+)?ai[- ]?(?:based|powered)?\s+optimi\w+\b/i.test(lower)) {
    const aiPoint = 'Provide optional AI-based optimization';
    if (!points.includes(aiPoint)) points.push(aiPoint);
  }

  // Explicit-only constraint for aggressive patterns (Pattern Leakage protection)
  // Require build verb + product noun in the same non-hedged sentence.
  const buildSentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
  const isExplicitBuilding = buildSentences.some(s =>
    /\b(?:build(?:ing)?|develop(?:ing)?|creat(?:e|ing)|implement(?:ing)?|launch(?:ing)?)\b/i.test(s) &&
    /\b(?:mvp|saas|product|app|application|platform|tool|system|service)\b/i.test(s) &&
    !/\b(?:maybe|perhaps)\s+(?:we\s+)?(?:should|could|might)\s+(?:build|create|develop)\b/i.test(s)
  ) && intent !== 'decision' && intent !== 'analysis';

  // AI feature integration (generic — not prompt optimization specific)
  const origLowerFull = (originalText || text).toLowerCase();
  if (/\b(?:add|integrate|include|want|uses?)\s+(?:some\s+)?(?:ai|artificial intelligence|machine learning)\b/i.test(origLowerFull)
    || /\bai\s+(?:stuff|features?|functionality|capabilities?)\b/i.test(origLowerFull)) {
    // Try to extract specific AI use case from original text (before "maybe"/"like" are stripped)
    const aiUseCase = origLowerFull.match(/\b(?:ai|artificial intelligence)\s+(?:in\s+some\s+way\s*,?\s*)?(?:stuff\s*,?\s*)?(?:like\s+)?(?:maybe\s+)?(?:like\s+)?(?:e\.?g\.?\s+)?([\w\s]+?)(?:\.|,|\bor\s+something\b|$)/i);
    const detail = aiUseCase && aiUseCase[1].trim().length > 3 && aiUseCase[1].trim().length < 50
      ? ` (e.g., ${aiUseCase[1].trim().replace(/\b(stuff|things|something)\b/gi, '').trim()})`
      : '';
    const aiPoint = `Integrate basic AI functionality${detail}`;
    if (!points.includes(aiPoint) && !points.includes('Provide optional AI-based optimization')) {
      points.push(aiPoint);
    }
  }

  // Tech stack as suggestion (uncertain mentions)
  // Only applies when explicitly building something, guarded against analysis/decision leakage
  if (isExplicitBuilding) {
    const origLower = (originalText || text).toLowerCase();
    const techSuggestions = [];
    const techNames = [
      [/\b(next\.?js|nextjs)\b/i, 'Next.js'], [/\b(react(?:\.?js)?|reactjs)\b/i, 'React'],
      [/\b(firebase)\b/i, 'Firebase'], [/\b(supabase)\b/i, 'Supabase'],
      [/\b(vue\.?js|vuejs)\b/i, 'Vue.js'], [/\b(node\.?js|nodejs)\b/i, 'Node.js'],
    ];
    for (const [pattern, label] of techNames) {
      if (pattern.test(origLower)) {
        const uncertaintyPattern = new RegExp(`\\b(?:maybe|perhaps|heard|not sure|might|could)\\b[^.]*\\b${label.replace('.', '\\.')}\\b|\\b${label.replace('.', '\\.')}\\b[^.]*\\b(?:or something|not sure|might)\\b`, 'i');
        if (uncertaintyPattern.test(originalText || text)) {
          techSuggestions.push(label);
        }
      }
    }
    if (techSuggestions.length > 0) {
      const point = `Suggest suitable tech stack options (e.g., ${techSuggestions.join(', ')})`;
      if (!points.includes(point)) points.push(point);
    }
  }

  // Validation strategy (strictly gated by building intent)
  if (isExplicitBuilding && /\b(?:validate|validation|user\s+feedback|test\s+(?:the\s+)?(?:idea|concept|market)|metrics|measure)\b/i.test(lower)) {
    const point = 'Define validation strategy (user feedback, metrics)';
    if (!points.includes(point)) points.push(point);
  }

  // Development steps/plan detection — add as key point if task is about planning
  if (/\b(?:outline|plan|steps|roadmap|phases?)\b/i.test(lower) && /\b(?:build|develop|create|launch)\b/i.test(lower)) {
    const point = 'Outline development steps and priorities';
    if (!points.includes(point)) points.push(point);
  }

  // Mark semantic entries so we can distinguish them from content-pattern entries
  const semanticEntries = new Set();
  // Semantic-generated entries have recognizable prefixes
  const semanticPrefixes = ['Challenges and risks', 'Real-world examples', 'Include relevant statistics', 'Provide a clear conclusion', 'Compare ', 'Common mistakes', 'Docker integration', 'Optimize prompts locally', 'Provide optional AI', 'Define MVP', 'Integrate basic AI', 'Suggest suitable tech', 'Define validation', 'Outline development'];
  for (const p of points) {
    if (semanticPrefixes.some(prefix => p.startsWith(prefix))) {
      semanticEntries.add(p);
    }
  }

  // Remove content-pattern entries that overlap with semantic entries
  return points.filter(p => {
    if (semanticEntries.has(p)) return true; // always keep semantic
    // Check if this content-pattern entry overlaps with any semantic entry
    const pLower = p.toLowerCase().replace(/[,.]$/,'');
    for (const s of semanticEntries) {
      const sLower = s.toLowerCase();
      const pWords = pLower.split(/\s+/).filter(w => w.length > 3);
      const sWords = sLower.split(/\s+/).filter(w => w.length > 3);
      const overlap = pWords.filter(w => sWords.includes(w)).length;
      if (pWords.length > 0 && (overlap / pWords.length) >= 0.4) return false;
    }
    return true;
  });
}

export function deduplicateAgainstTask(points, task) {
  if (!task) return points;
  const taskWords = new Set(task.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  return points.filter(point => {
    const pointWords = point.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const overlap = pointWords.filter(w => taskWords.has(w)).length;
    // If more than 60% of the point's words are already in the task, skip it
    return pointWords.length === 0 || (overlap / pointWords.length) < 0.6;
  });
}

export function deduplicateRequirements(requirements, keyPoints) {
  // First: deduplicate within requirements (e.g., "Include statistics" vs "Include relevant statistics")
  const unique = [];
  for (const req of requirements) {
    const reqLower = req.toLowerCase();
    const reqWords = reqLower.split(/\s+/).filter(w => w.length > 3);
    const isDupe = unique.some(existing => {
      const exWords = existing.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const overlap = reqWords.filter(w => exWords.includes(w)).length;
      return reqWords.length > 0 && exWords.length > 0 && (overlap / Math.min(reqWords.length, exWords.length)) >= 0.5;
    });
    if (!isDupe) unique.push(req);
  }

  if (keyPoints.length === 0) return unique;
  const pointsLower = keyPoints.map(p => p.toLowerCase());
  return unique.filter(req => {
    const reqLower = req.toLowerCase();
    return !pointsLower.some(p => {
      const reqWords = reqLower.split(/\s+/).filter(w => w.length > 3);
      const pWords = p.split(/\s+/).filter(w => w.length > 3);
      const overlap = reqWords.filter(w => pWords.includes(w)).length;
      return reqWords.length > 0 && (overlap / reqWords.length) >= 0.5;
    });
  });
}

export function extractOutputRequirements(text) {
  const requirements = [];
  const lower = text.toLowerCase();

  // Format requirements
  const formatPatterns = [
    [/\b(?:in |as |use )?(?:bullet|bulleted)\s*(?:points?|list|format)?\b/i, 'Use bullet points'],
    [/\b(?:in |as |use )?(?:numbered|ordered)\s*(?:list|format)?\b/i, 'Use numbered list'],
    [/\b(?:in |as |return |output )?json\b/i, 'Return JSON'],
    [/\b(?:in |as |use )?markdown\b/i, 'Use Markdown'],
    [/\b(?:in |as |use )?table\s*(?:format)?\b/i, 'Use table format'],
    [/\bcode\s*(?:block|snippet|example)s?\b/i, 'Include code examples'],
    [/\byaml\s*(?:example|config|file|snippet)s?\b/i, 'Include YAML configuration examples'],
    [/\b(?:actual|real)\s+yaml\b/i, 'Include YAML configuration examples'],
  ];

  for (const [pattern, label] of formatPatterns) {
    if (pattern.test(lower)) {
      requirements.push(label);
    }
  }

  // Content requirements (include X, add X)
  const includePatterns = [
    /\b(?:include|add)\s+(?:some\s+)?(?:relevant\s+)?(statistics|stats|data|numbers|examples?|references?|sources?|links?|citations?|images?|diagrams?|charts?|graphs?)\b/gi,
  ];

  for (const pattern of includePatterns) {
    let match;
    while ((match = pattern.exec(lower)) !== null) {
      const item = match[1].toLowerCase();
      const req = `Include ${item}`;
      if (!requirements.includes(req)) {
        requirements.push(req);
      }
    }
  }

  // Specific output instructions like "list of tips"
  const listMatch = text.match(/\b(?:list|include|give|provide)\s+(?:a list of |some )?(tips|steps|strategies|recommendations|suggestions|ideas|ways|methods|techniques|approaches)\s+(?:for|to|on)\s+(.+?)(?:\.|,|$)/i);
  if (listMatch) {
    const req = `Include ${listMatch[1].toLowerCase()} for ${listMatch[2].trim()}`;
    if (!requirements.includes(req)) {
      requirements.push(req);
    }
  }

  // Structured article / headings detection (ONLY for content tasks)
  if (/\b(?:format|structure)\b.*?\b(?:headings?|sections?|subheadings?)\b/i.test(lower)
    || /\b(?:structured|well-structured|organized)\s*(?:article|post|essay|document|response)\b/i.test(lower)) {
    requirements.push('Structured article with headings and sections');
  }

  // Clean / usable UI requirement - strict matching to avoid triggering on "UI / Backend"
  if (/\b(?:clean|usable|good|nice|better|improve)\s+(?:the\s+)?(?:ui|interface|user\s+interface)\b/i.test(lower)) {
    requirements.push('Clean and usable UI');
  }

  // Step-by-step plan / actionable guidance
  if (/\b(?:plan|steps|outline|roadmap|phases?)\b/i.test(lower) && /\b(?:build|develop|create|launch|how to)\b/i.test(lower)) {
    requirements.push('Clear step-by-step plan');
    requirements.push('Practical and actionable guidance');
  }

  return requirements;
}

export function buildStructuredPrompt(role, task, constraints, keyPoints, outputRequirements, cleanedText) {
  const sections = [];

  // Role
  if (role) {
    sections.push(`Role: ${role}`);
  }

  // Task
  if (task) {
    sections.push(`Task: ${task}`);
  }

  // Constraints
  if (constraints.length > 0) {
    sections.push(`Constraints:\n${constraints.map(c => `- ${c}`).join('\n')}`);
  }

  // Key Points
  if (keyPoints.length > 0) {
    sections.push(`Key points:\n${keyPoints.map(p => `- ${p}`).join('\n')}`);
  }

  // Output Requirements
  if (outputRequirements.length > 0) {
    sections.push(`Output requirements:\n${outputRequirements.map(r => `- ${r}`).join('\n')}`);
  }

  if (!task && sections.length <= 1) {
    return fixCasing(cleanedText);
  }

  return fixCasing(sections.join('\n\n'));
}
