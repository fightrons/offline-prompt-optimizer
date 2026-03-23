export function detectDomain(text) {
  const lowerText = text.toLowerCase().replace(/https?:\/\/[^\s]+/gi, '');
  
  // Product > Frontend/Backend since SaaS MVP should be built by Product Engineer
  if (/(product|roadmap|saas|mvp|user feedback|retention|go-to-market)/.test(lowerText)) return 'product';
  
  // Specific engineering domains first
  if (/\b(devops|docker|kubernetes|ci\/cd|pipeline|deploy|terraform|aws|azure|gcp|github\s*actions|jenkins)\b/.test(lowerText)) return 'devops';
  if (/\b(react|vue|angular|svelte|frontend|front-end|component|hook|css|html|dom|tailwind)\b/.test(lowerText)) return 'frontend';
  if (/\b(api|backend|back-end|server|endpoint|database|sql|node|express|django|flask)\b/.test(lowerText)) return 'backend';
  
  // Require stronger signal for finance or at least prioritize product first
  if (/(finance|cost\s+optimi|revenue|pricing|profitability|economic|financial|investment)/.test(lowerText)) return 'finance';
  
  if (/(qa|test|quality|jira|sentry|crash|bug analysis|issue tracker)/.test(lowerText)) return 'qa';
  
  if (/(code|debug|refactor|bug|software|application|app|script|function|algorithm|class|module)\b/.test(lowerText)) return 'software';
  
  if (/(hire|recruit|talent|interview|candidate|hr|employee)/.test(lowerText)) return 'hr';
  if (/(design|wireframe|mockup|prototype|layout|ui|ux|figma)/.test(lowerText)) return 'design';
  if (/(teach|tutorial|educate|explain|lesson|course|learn)/.test(lowerText)) return 'education';
  
  // Map domains based on semantic clusters (general marketing / content)
  if (/(blog|article|content|marketing|seo|brand|campaign|social media|audience|lead generation)/.test(lowerText)) return 'marketing';
  
  return 'general';
}
