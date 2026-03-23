export function mapRole(intent, domain) {
  // Granular engineering overrides globally applied
  if (domain === 'devops') return 'DevOps engineer';
  if (domain === 'frontend') return 'Frontend developer';
  if (domain === 'backend') return 'Backend engineer';
  
  if (intent === 'decision') {
    if (domain === 'product') return 'Product Manager';
    if (domain === 'marketing') return 'Marketing strategist';
    if (domain === 'finance') return 'Financial Controller';
    if (domain === 'software') return 'Engineering Manager';
    if (domain === 'hr') return 'HR Director';
    return 'Strategic planner';
  }
  
  if (intent === 'analysis') {
    if (domain === 'finance') return 'Financial analyst';
    if (domain === 'marketing') return 'Marketing analyst';
    if (domain === 'hr') return 'Talent Analyst';
    if (domain === 'product') return 'Product Manager'; // Product analysis -> PM role
    if (domain === 'software') return 'Senior software engineer';
    if (domain === 'qa') return 'Data analyst'; // or QA analyst
    return 'Data analyst';
  }
  
  if (intent === 'workflow') {
    if (domain === 'software') return 'Senior software engineer';
    if (domain === 'qa') return 'QA Engineer';
    if (domain === 'finance') return 'Financial Operations Specialist';
    if (domain === 'marketing') return 'Content research specialist';
    if (domain === 'hr') return 'HR Operations Specialist';
    return 'Workflow automation specialist';
  }
  
  if (intent === 'content') {
    if (domain === 'marketing') return 'Professional content writer';
    if (domain === 'education') return 'Technical educator';
    if (domain === 'design') return 'UX/UI designer';
    if (domain === 'software') return 'Senior software engineer';
    return 'Professional content writer';
  }
  
  // Generic intent fallbacks
  if (domain === 'software') return 'Senior software engineer';
  if (domain === 'design') return 'UX/UI designer';
  if (domain === 'qa') return 'QA Engineer';
  if (domain === 'finance') return 'Financial analyst';
  if (domain === 'marketing') return 'Marketing strategist';
  if (domain === 'product') return 'Product engineer';
  
  return 'Domain expert';
}
