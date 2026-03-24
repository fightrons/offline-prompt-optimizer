/**
 * Role Mapping: Intent × Domain → Role
 *
 * Maps the detected intent and domain to an appropriate professional role.
 * Granular engineering domains (devops, frontend, backend) override intent
 * because those roles are highly specialized regardless of task type.
 */
export function mapRole(intent, domain) {
  // Granular engineering overrides — these roles are specialized regardless of intent
  if (domain === 'devops') return 'DevOps engineer';
  if (domain === 'frontend') return 'Frontend developer';
  if (domain === 'backend') return 'Backend engineer';

  if (intent === 'decision') {
    if (domain === 'product') return 'Product Manager';
    if (domain === 'marketing') return 'Marketing strategist';
    if (domain === 'finance') return 'Financial Controller';
    if (domain === 'software') return 'Engineering Manager';
    if (domain === 'hr') return 'HR Director';
    if (domain === 'healthcare') return 'Healthcare Operations Director';
    return 'Strategic planner';
  }

  if (intent === 'analysis') {
    if (domain === 'finance') return 'Financial analyst';
    if (domain === 'marketing') return 'Marketing analyst';
    if (domain === 'hr') return 'Talent Analyst';
    if (domain === 'product') return 'Product Manager';
    if (domain === 'software') return 'Senior software engineer';
    if (domain === 'qa') return 'Data analyst';
    if (domain === 'healthcare') return 'Healthcare Data Analyst';
    return 'Data analyst';
  }

  if (intent === 'workflow') {
    if (domain === 'software') return 'Senior software engineer';
    if (domain === 'qa') return 'QA Engineer';
    if (domain === 'finance') return 'Financial Operations Specialist';
    if (domain === 'marketing') return 'Content research specialist';
    if (domain === 'hr') return 'HR Operations Specialist';
    if (domain === 'healthcare') return 'Clinical Workflow Specialist';
    return 'Workflow automation specialist';
  }

  if (intent === 'execution') {
    if (domain === 'marketing') return 'Business Development Specialist';
    if (domain === 'finance') return 'Financial Operations Analyst';
    if (domain === 'hr') return 'HR Operations Specialist';
    if (domain === 'product') return 'Product Operations Manager';
    if (domain === 'software') return 'Software Engineer';
    if (domain === 'qa') return 'QA Engineer';
    if (domain === 'healthcare') return 'Healthcare Operations Coordinator';
    if (domain === 'design') return 'Design Operations Specialist';
    if (domain === 'education') return 'Training Coordinator';
    return 'Operations Specialist';
  }

  if (intent === 'content') {
    if (domain === 'marketing') return 'Professional content writer';
    if (domain === 'education') return 'Technical educator';
    if (domain === 'design') return 'UX/UI designer';
    if (domain === 'software') return 'Senior software engineer';
    if (domain === 'healthcare') return 'Medical Content Writer';
    return 'Professional content writer';
  }

  // Specification prompts use the underlying intent for role mapping,
  // so they flow through the intent blocks above. No separate block needed.

  // Generic intent fallbacks
  if (domain === 'software') return 'Senior software engineer';
  if (domain === 'design') return 'UX/UI designer';
  if (domain === 'qa') return 'QA Engineer';
  if (domain === 'finance') return 'Financial analyst';
  if (domain === 'marketing') return 'Marketing strategist';
  if (domain === 'product') return 'Product engineer';
  if (domain === 'healthcare') return 'Healthcare Specialist';
  if (domain === 'hr') return 'HR Specialist';

  return 'Domain expert';
}
