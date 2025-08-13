import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { RAGService } from '../services/rag/rag.service'
import { EmbeddingService } from '../services/openai/embedding.service'
import { PineconeService } from '../services/pinecone/pinecone.service'
import { ChatService } from '../services/openai/chat.service'
import { OpenAIClient } from '../services/openai/openai.client'
import { IntegratedChatService } from '../services/chat/integrated-chat.service'
import type { StreamingChatRequest } from '../types'
import { CHAT_CONSTANTS } from '../constants'
import { v4 as uuidv4 } from 'uuid'

// 요청 스키마 정의 (세션 기반으로 확장)
const StreamingChatRequestSchema = {
  type: 'object',
  required: ['message', 'storeId', 'userId'],
  properties: {
    message: {
      type: 'string',
      minLength: CHAT_CONSTANTS.MESSAGE_MIN_LENGTH,
      maxLength: CHAT_CONSTANTS.MESSAGE_MAX_LENGTH
    },
    // 필수 세션 정보
    storeId: { type: 'string', minLength: 1 },
    userId: { type: 'string', minLength: 1 },
    // 선택적 세션 ID
    sessionId: { type: 'string', format: 'uuid' }
  }
} as const

const chatRoutes: FastifyPluginAsync = async (fastify) => {
  // 서비스 의존성 설정
  const embeddingService = new EmbeddingService(fastify.openaiClient!)
  const ragService = new RAGService(
    embeddingService,
    fastify.pineconeService!,
    new ChatService(fastify.openaiClient!),
    fastify.openaiClient!
  )

  // 세션 기반 서비스 (사용 가능한 경우)
  const integratedChatService: IntegratedChatService | null = 
    (fastify as any).integratedChatService || null

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
  }, async (request: FastifyRequest<{ Body: StreamingChatRequest & { sessionId?: string; storeId?: string; userId?: string } }>, reply: FastifyReply) => {
    const { message, sessionId, storeId, userId } = request.body

    // 필수값 검증
    if (!storeId || !userId) {
      return reply.status(400).send({
        error: 'storeId와 userId는 필수값입니다',
        code: 'MISSING_REQUIRED_FIELDS',
        timestamp: new Date().toISOString()
      })
    }

    // 세션 정보 처리
    let currentSessionId = sessionId
    if (integratedChatService && !currentSessionId) {
      // 기존 활성 세션이 있는지 확인 (같은 사용자/스토어)
      try {
        const existingSession = await integratedChatService.findActiveSession({
          storeId,
          userId
        })
        
        if (existingSession) {
          currentSessionId = existingSession.id
          console.log(`기존 세션 재사용: ${currentSessionId}`)
        } else {
          // 기존 세션이 없으면 새로 생성
          currentSessionId = await integratedChatService.createSession({
            storeId,
            userId,
            metadata: { createdAt: new Date().toISOString() }
          })
          console.log(`새 세션 생성: ${currentSessionId}`)
        }
      } catch (error) {
        console.error('세션 처리 실패:', error)
        // 세션 처리 실패 시에도 계속 진행 (세션 없이)
      }
    }

    // SSE 헤더 설정
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    try {
      const startTime = Date.now()
      let fullResponse = ''
      let tokenCount = 0
      let sources: any[] = []
      
      // 스트리밍 시작
      const streamGenerator = ragService.askQuestionStream({ message })

      for await (const event of streamGenerator) {
        const eventData = JSON.stringify(event)
        reply.raw.write(`data: ${eventData}\n\n`)

        // 세션 로깅을 위한 데이터 수집
        if (event.type === 'token' && event.content) {
          fullResponse += event.content
        } else if (event.type === 'sources' && event.data) {
          sources = event.data
        } else if (event.type === 'done' && event.data) {
          tokenCount = event.data.tokenCount || 0
        }
      }

      // 세션 기반 로깅 (사용 가능한 경우)
      if (integratedChatService && currentSessionId && fullResponse) {
        try {
          const responseTime = Date.now() - startTime
          await integratedChatService.logChatInteraction({
            sessionId: currentSessionId,
            userMessage: message,
            assistantResponse: fullResponse,
            tokenUsage: tokenCount,
            responseTimeMs: responseTime,
            businessMetadata: {
              retrievedDocsCount: sources.length,
              relevanceScore: sources[0]?.score || 0
            }
          })
          console.log(`채팅 상호작용 기록됨: ${currentSessionId}`)
        } catch (error) {
          console.error('채팅 상호작용 로깅 실패:', error)
        }
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
  }, async (request: FastifyRequest<{ Body: StreamingChatRequest & { sessionId?: string; storeId?: string; userId?: string } }>, reply: FastifyReply) => {
    try {
      const { message, sessionId, storeId, userId } = request.body

      // 필수값 검증
      if (!storeId || !userId) {
        return reply.status(400).send({
          error: 'storeId와 userId는 필수값입니다',
          code: 'MISSING_REQUIRED_FIELDS',
          timestamp: new Date().toISOString()
        })
      }

      // 세션 정보 처리
      let currentSessionId = sessionId
      if (integratedChatService && !currentSessionId) {
        // 기존 활성 세션이 있는지 확인 (같은 사용자/스토어)
        try {
          const existingSession = await integratedChatService.findActiveSession({
            storeId,
            userId
          })
          
          if (existingSession) {
            currentSessionId = existingSession.id
            console.log(`기존 세션 재사용: ${currentSessionId}`)
          } else {
            // 기존 세션이 없으면 새로 생성
            currentSessionId = await integratedChatService.createSession({
              storeId,
              userId,
              metadata: { createdAt: new Date().toISOString() }
            })
            console.log(`새 세션 생성: ${currentSessionId}`)
          }
        } catch (error) {
          console.error('세션 처리 실패:', error)
        }
      }
      
      const startTime = Date.now()
      // RAG 서비스 사용 (비스트리밍)
      const response = await ragService.askQuestion({ question: message })
      const responseTime = Date.now() - startTime

      // 세션 기반 로깅 (사용 가능한 경우)
      if (integratedChatService && currentSessionId) {
        try {
          await integratedChatService.logChatInteraction({
            sessionId: currentSessionId,
            userMessage: message,
            assistantResponse: response.answer,
            tokenUsage: response.metadata?.tokenCount || 0,
            responseTimeMs: responseTime,
            businessMetadata: {
              retrievedDocsCount: response.sources?.length || 0,
              relevanceScore: response.sources?.[0]?.score || 0
            }
          })
          console.log(`채팅 상호작용 기록됨: ${currentSessionId}`)
        } catch (error) {
          console.error('채팅 상호작용 로깅 실패:', error)
        }
      }
      
      return reply.send({
        ...response,
        sessionId: currentSessionId,
        responseTime,
        timestamp: new Date().toISOString()
      })
      
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