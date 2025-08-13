/**
 * Fastify 타입 확장
 * 서비스 인스턴스를 위한 타입 선언
 */

import { Pool } from 'pg'
import { NotionService } from '../services/notion/notion.service'
import { OpenAIClient } from '../services/openai/openai.client'
import { PineconeService } from '../services/pinecone/pinecone.service'
import { IntegratedChatService } from '../services/chat/integrated-chat.service'

declare module 'fastify' {
  interface FastifyInstance {
    databasePool?: Pool
    integratedChatService?: IntegratedChatService
    notionService?: NotionService
    openaiClient?: OpenAIClient
    pineconeService?: PineconeService
  }
}