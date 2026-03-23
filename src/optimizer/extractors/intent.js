export function detectIntent(text) {
  const lowerText = text.toLowerCase();
  
  // Decision intent (highest priority)
  if (/\b(prioritize|impact(.{0,10}?)effort|roadmap|what to build next|trade-off|tradeoffs|strategic plan|evaluate options)\b/.test(lowerText)) {
    return 'decision';
  }
  
  // Analysis intent 
  if (/\b(analyze|analyzing|trends?|insights?)\b/.test(lowerText)) {
    return 'analysis';
  }
  
  // Workflow intent - using weighted scoring for robust detection
  let workflowScore = 0;
  if (/step \d|step 1|step 2/i.test(text)) workflowScore += 1;
  if (/column [a-z]/i.test(text)) workflowScore += 1;
  if (/(spreadsheet|excel sheet|google sheet)/i.test(text)) workflowScore += 1;
  if (/(scrape|fetch|crawl|update rows|data entry)/i.test(text)) workflowScore += 1;
  if (/(rss|xml|feed)/i.test(text)) workflowScore += 1;
  if (/(daily basis|weekly task|recurring|pipeline|automate)/i.test(text)) workflowScore += 1;
  
  if (workflowScore >= 2) {
    return 'workflow';
  }
  
  // Content intent
  if (/(write|create|generate|draft|compose|produce|blog|article)/.test(lowerText)) {
    return 'content';
  }
  
  return 'generic';
}
