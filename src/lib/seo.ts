/**
 * Search and crawler settings. The site is indexed only once ALLOW_INDEXING=true is set
 * (in Vercel, for Production, when tillotsondesign.com points here): until then preview
 * deployments and the *.vercel.app address must not compete with the live site in search.
 */
export const indexingAllowed = () => process.env.ALLOW_INDEXING === 'true'

export const siteUrl = () => (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/+$/, '')

// Crawlers that collect text for AI products, as their operators name them.
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'PerplexityBot',
  'CCBot',
  'Bytespider',
  'meta-externalagent',
  'Amazonbot',
  'cohere-ai',
]
