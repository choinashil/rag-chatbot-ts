// 공통 타입 export
export * from './api'
export * from './document'
export * from './notion'
export * from './openai'
export * from './embedding'

// Fastify 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    notionService?: import('../services/notion/notion.service').NotionService;
    openaiClient?: import('../services/openai/openai.client').OpenAIClient;
  }
}