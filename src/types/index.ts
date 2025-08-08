// 공통 타입 export
export * from './api'
export * from './document'
export * from './notion'
export * from './openai'
export * from './embedding'
export * from './pinecone'
export * from './rag'
export * from './streaming'

// Fastify 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    notionService?: import('../services/notion/notion.service').NotionService;
    openaiClient?: import('../services/openai/openai.client').OpenAIClient;
    pineconeService?: import('../services/pinecone/pinecone.service').PineconeService;
  }
}