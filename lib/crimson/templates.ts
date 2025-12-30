export type TemplateField = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  required: boolean;
  placeholder?: string;
  options?: string[];
  locked?: boolean;
};

export type TemplateConfig = {
  id: string;
  title: string;
  description: string;
  fields: TemplateField[];
};

export const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {
  seo_blog_post: {
    id: 'seo_blog_post',
    title: 'SEO Blog Post',
    description: 'Create or refine long-form content optimized for search.',
    fields: [
      { name: 'topic', label: 'Topic', type: 'text', required: true, placeholder: 'e.g., Local SEO strategies' },
      { name: 'primary_keyword', label: 'Primary Keyword', type: 'text', required: true, placeholder: 'e.g., local seo' },
      { name: 'secondary_keywords', label: 'Secondary Keywords', type: 'textarea', required: false, placeholder: 'Comma-separated keywords' },
      { name: 'seo_intent', label: 'SEO Intent', type: 'select', required: true, options: ['informational', 'transactional', 'comparison'] },
      { name: 'content_length', label: 'Content Length', type: 'select', required: true, options: ['short', 'medium', 'long'] },
      { name: 'brand_voice', label: 'Brand Voice', type: 'text', required: false, placeholder: 'e.g., Professional, Friendly' },
    ],
  },
  listicle: {
    id: 'listicle',
    title: 'Listicle',
    description: 'Turn a topic into scannable, ranked sections with strong SEO structure.',
    fields: [
      { name: 'topic', label: 'Topic', type: 'text', required: true, placeholder: 'e.g., Best SEO tools' },
      { name: 'primary_keyword', label: 'Primary Keyword', type: 'text', required: true, placeholder: 'e.g., seo tools' },
      { name: 'number_of_items', label: 'Number of Items', type: 'number', required: true, placeholder: 'e.g., 10' },
      { name: 'audience', label: 'Audience', type: 'text', required: true, placeholder: 'e.g., Small business owners' },
      { name: 'seo_intent', label: 'SEO Intent', type: 'select', required: true, options: ['informational', 'transactional', 'comparison'] },
    ],
  },
  local_service_page: {
    id: 'local_service_page',
    title: 'Local Service Page',
    description: 'Improve a local landing page for relevance, trust, and conversion.',
    fields: [
      { name: 'service_name', label: 'Service Name', type: 'text', required: true, placeholder: 'e.g., Plumbing Services' },
      { name: 'location', label: 'Location', type: 'text', required: true, placeholder: 'e.g., Portland, OR' },
      { name: 'primary_keyword', label: 'Primary Keyword', type: 'text', required: true, placeholder: 'e.g., plumber portland' },
      { name: 'secondary_keywords', label: 'Secondary Keywords', type: 'textarea', required: false, placeholder: 'Comma-separated keywords' },
      { name: 'cta_goal', label: 'CTA Goal', type: 'text', required: true, placeholder: 'e.g., Schedule consultation' },
      { name: 'trust_elements', label: 'Trust Elements', type: 'textarea', required: false, placeholder: 'e.g., Years in business, certifications' },
    ],
  },
  product_landing_page: {
    id: 'product_landing_page',
    title: 'Product Landing Page',
    description: 'Optimize product messaging, benefits, and conversion CTAs.',
    fields: [
      { name: 'product_name', label: 'Product Name', type: 'text', required: true, placeholder: 'e.g., SEO Analytics Tool' },
      { name: 'primary_benefit', label: 'Primary Benefit', type: 'text', required: true, placeholder: 'e.g., Track rankings in real-time' },
      { name: 'target_customer', label: 'Target Customer', type: 'text', required: true, placeholder: 'e.g., SEO agencies' },
      { name: 'cta_goal', label: 'CTA Goal', type: 'text', required: true, placeholder: 'e.g., Start free trial' },
      { name: 'competitive_angle', label: 'Competitive Angle', type: 'textarea', required: false, placeholder: 'What makes this product unique' },
    ],
  },
  email_campaign: {
    id: 'email_campaign',
    title: 'Email Campaign',
    description: 'Generate or improve email copy aligned with your objective.',
    fields: [
      { name: 'campaign_goal', label: 'Campaign Goal', type: 'text', required: true, placeholder: 'e.g., Drive webinar registrations' },
      { name: 'audience', label: 'Audience', type: 'text', required: true, placeholder: 'e.g., Marketing professionals' },
      { name: 'tone', label: 'Tone', type: 'text', required: true, placeholder: 'e.g., Professional, Friendly' },
      { name: 'email_length', label: 'Email Length', type: 'select', required: true, options: ['short', 'medium', 'long'] },
      { name: 'cta_goal', label: 'CTA Goal', type: 'text', required: true, placeholder: 'e.g., Register now' },
    ],
  },
  seo_audit_summary: {
    id: 'seo_audit_summary',
    title: 'SEO Audit Summary',
    description: 'Turn findings into client-friendly summaries and next steps.',
    fields: [
      { name: 'client_name', label: 'Client Name', type: 'text', required: true, placeholder: 'e.g., Acme Corp' },
      { name: 'audit_focus', label: 'Audit Focus', type: 'textarea', required: true, placeholder: 'Main areas audited' },
      { name: 'summary_depth', label: 'Summary Depth', type: 'select', required: true, options: ['brief', 'detailed', 'comprehensive'] },
      { name: 'next_steps_style', label: 'Next Steps Style', type: 'select', required: true, options: ['bulleted', 'narrative', 'action-oriented'] },
    ],
  },
  social_media_thread: {
    id: 'social_media_thread',
    title: 'Social Media Thread',
    description: 'Convert ideas into a structured thread optimized for engagement.',
    fields: [
      { name: 'platform', label: 'Platform', type: 'select', required: true, options: ['Twitter', 'LinkedIn', 'Instagram'] },
      { name: 'topic', label: 'Topic', type: 'text', required: true, placeholder: 'e.g., Local SEO tips' },
      { name: 'thread_length', label: 'Thread Length', type: 'number', required: true, placeholder: 'e.g., 5' },
      { name: 'engagement_goal', label: 'Engagement Goal', type: 'text', required: true, placeholder: 'e.g., Drive clicks to blog' },
    ],
  },
  how_to_guide: {
    id: 'how_to_guide',
    title: 'How-To Guide',
    description: 'Create step-by-step guidance content that ranks and converts.',
    fields: [
      { name: 'topic', label: 'Topic', type: 'text', required: true, placeholder: 'e.g., How to optimize local SEO' },
      { name: 'audience', label: 'Audience', type: 'text', required: true, placeholder: 'e.g., Small business owners' },
      { name: 'skill_level', label: 'Skill Level', type: 'select', required: true, options: ['beginner', 'intermediate', 'advanced'] },
      { name: 'step_depth', label: 'Step Depth', type: 'select', required: true, options: ['overview', 'detailed', 'comprehensive'] },
      { name: 'seo_intent', label: 'SEO Intent', type: 'select', required: true, options: ['informational', 'transactional', 'comparison'] },
    ],
  },
  crimson_page_review: {
    id: 'crimson_page_review',
    title: 'Page Review',
    description: 'Edit and optimize page content based on Midnight findings.',
    fields: [
      { name: 'url', label: 'URL', type: 'text', required: true, locked: true },
      { name: 'goal', label: 'Goal', type: 'textarea', required: true, locked: true },
      { name: 'tone', label: 'Tone', type: 'text', required: false, locked: true, placeholder: 'e.g., Professional, Friendly' },
    ],
  },
};

export function getTemplateConfig(templateId: string): TemplateConfig | undefined {
  return TEMPLATE_CONFIGS[templateId];
}

export function buildGoalFromTemplateFields(templateId: string, fieldValues: Record<string, string>): string {
  const config = TEMPLATE_CONFIGS[templateId];
  if (!config) return '';

  const parts: string[] = [];
  
  // Build a descriptive goal from template fields
  if (config.id === 'seo_blog_post') {
    parts.push(`Create a ${fieldValues.content_length || 'medium'}-length SEO blog post`);
    if (fieldValues.topic) parts.push(`about "${fieldValues.topic}"`);
    if (fieldValues.primary_keyword) parts.push(`targeting "${fieldValues.primary_keyword}"`);
    if (fieldValues.seo_intent) parts.push(`with ${fieldValues.seo_intent} intent`);
  } else if (config.id === 'listicle') {
    parts.push(`Create a ${fieldValues.number_of_items || '10'}-item listicle`);
    if (fieldValues.topic) parts.push(`about "${fieldValues.topic}"`);
    if (fieldValues.primary_keyword) parts.push(`targeting "${fieldValues.primary_keyword}"`);
  } else if (config.id === 'local_service_page') {
    parts.push(`Optimize local service page`);
    if (fieldValues.service_name) parts.push(`for "${fieldValues.service_name}"`);
    if (fieldValues.location) parts.push(`in ${fieldValues.location}`);
    if (fieldValues.cta_goal) parts.push(`to ${fieldValues.cta_goal}`);
  } else if (config.id === 'product_landing_page') {
    parts.push(`Optimize product landing page`);
    if (fieldValues.product_name) parts.push(`for "${fieldValues.product_name}"`);
    if (fieldValues.primary_benefit) parts.push(`highlighting "${fieldValues.primary_benefit}"`);
    if (fieldValues.cta_goal) parts.push(`to ${fieldValues.cta_goal}`);
  } else if (config.id === 'email_campaign') {
    parts.push(`Create ${fieldValues.email_length || 'medium'}-length email campaign`);
    if (fieldValues.campaign_goal) parts.push(`to ${fieldValues.campaign_goal}`);
    if (fieldValues.audience) parts.push(`for ${fieldValues.audience}`);
  } else if (config.id === 'seo_audit_summary') {
    parts.push(`Create ${fieldValues.summary_depth || 'detailed'} SEO audit summary`);
    if (fieldValues.client_name) parts.push(`for ${fieldValues.client_name}`);
    if (fieldValues.audit_focus) parts.push(`focusing on ${fieldValues.audit_focus}`);
  } else if (config.id === 'social_media_thread') {
    parts.push(`Create ${fieldValues.thread_length || '5'}-post ${fieldValues.platform || 'Twitter'} thread`);
    if (fieldValues.topic) parts.push(`about "${fieldValues.topic}"`);
    if (fieldValues.engagement_goal) parts.push(`to ${fieldValues.engagement_goal}`);
  } else if (config.id === 'how_to_guide') {
    parts.push(`Create ${fieldValues.skill_level || 'beginner'}-level how-to guide`);
    if (fieldValues.topic) parts.push(`on "${fieldValues.topic}"`);
    if (fieldValues.audience) parts.push(`for ${fieldValues.audience}`);
    if (fieldValues.step_depth) parts.push(`with ${fieldValues.step_depth} step depth`);
  }

  return parts.join(' ') + '.';
}

