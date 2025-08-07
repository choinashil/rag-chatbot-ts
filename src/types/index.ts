// 공통 타입 export
export * from './api'
export * from './document'
export * from './notion'

// Fastify 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    notionService?: import('../services/notion/notion.service').NotionService;
  }
}