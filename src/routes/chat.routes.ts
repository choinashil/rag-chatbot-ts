import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { RAGService } from '../services/rag/rag.service'
import { EmbeddingService } from '../services/openai/embedding.service'
import { PineconeService } from '../services/pinecone/pinecone.service'
import { ChatService } from '../services/openai/chat.service'
import { OpenAIClient } from '../services/openai/openai.client'
import type { StreamingChatRequest } from '../types'
import { CHAT_CONSTANTS } from '../constants'

// 요청 스키마 정의
const StreamingChatRequestSchema = {
  type: 'object',
  required: ['message'],
  properties: {
    message: {
      type: 'string',
      minLength: CHAT_CONSTANTS.MESSAGE_MIN_LENGTH,
      maxLength: CHAT_CONSTANTS.MESSAGE_MAX_LENGTH
    }
  }
} as const

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // RAGService 의존성 설정
  const embeddingService = new EmbeddingService(fastify.openaiClient!)
  const ragService = new RAGService(
    embeddingService,
    fastify.pineconeService!,
    new ChatService(fastify.openaiClient!),
    fastify.openaiClient!
  )

  // POST /api/chat/stream - SSE 스트리밍 채팅
  fastify.post<{
    Body: StreamingChatRequest
  }>('/stream', {
    schema: {
      body: StreamingChatRequestSchema,
      response: {
        200: {
          type: 'string',
          description: 'Server-Sent Events stream'
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: StreamingChatRequest }>, reply: FastifyReply) => {
    const { message } = request.body

    // SSE 헤더 설정
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    try {
      // 스트리밍 시작
      const streamGenerator = ragService.askQuestionStream({ message })

      for await (const event of streamGenerator) {
        const eventData = JSON.stringify(event)
        reply.raw.write(`data: ${eventData}\n\n`)
      }

      // 스트림 종료
      reply.raw.end()

    } catch (error) {
      console.error('스트리밍 에러', error)
      
      // 에러 이벤트 전송
      const errorEvent = JSON.stringify({
        type: 'error',
        content: '서버 에러가 발생했습니다. 잠시 후 다시 시도해주세요.',
        data: { timestamp: new Date().toISOString() }
      })
      
      reply.raw.write(`data: ${errorEvent}\n\n`)
      reply.raw.end()
    }
  })

  // POST /api/chat - 백업용 REST API (선택사항)
  fastify.post<{
    Body: StreamingChatRequest
  }>('/', {
    schema: {
      body: StreamingChatRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  content: { type: 'string' },
                  score: { type: 'number' },
                  url: { type: 'string' }
                }
              }
            },
            metadata: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: StreamingChatRequest }>, reply: FastifyReply) => {
    try {
      const { message } = request.body
      
      // 기존 RAG 서비스 사용 (비스트리밍)
      const response = await ragService.askQuestion({ question: message })
      
      return reply.send(response)
      
    } catch (error) {
      console.error('채팅 API 에러:', error)
      
      return reply.status(500).send({
        error: '서버 에러가 발생했습니다. 잠시 후 다시 시도해주세요.',
        timestamp: new Date().toISOString()
      })
    }
  })
}

export default chatRoutes