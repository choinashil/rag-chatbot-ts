/**
 * Fastify 타입 확장
 * 서비스 인스턴스를 위한 타입 선언
 */

import { Pool } from 'pg'
import { NotionService } from '../services/notion/notion.service'
import { PineconeService } from '../services/vector/pinecone.service'
import { ChatService } from '../services/chat/chat.service'

declare module 'fastify' {
  interface FastifyInstance {
    databasePool?: Pool
    integratedChatService?: ChatService
    notionService?: NotionService
    pineconeService?: PineconeService
  }
}