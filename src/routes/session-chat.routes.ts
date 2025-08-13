/**
 * 세션 기반 채팅 API 라우트
 * 멀티 스토어 권한 시스템과 하이브리드 데이터 저장 지원
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { RAGService } from '../services/rag/rag.service'
import { EmbeddingService } from '../services/openai/embedding.service'
import { ChatService } from '../services/openai/chat.service'
// IntegratedChatService는 Fastify에서 주입됨
import type { CreateSessionRequest, SessionChatRequest } from '../types/session-chat'
import { CHAT_CONSTANTS, SESSION_CONSTANTS } from '../constants'

// 세션 생성 요청 스키마
const CreateSessionRequestSchema = {
  type: 'object',
  required: ['storeId', 'userId'],
  properties: {
    storeId: { type: 'string', minLength: 1 },
    userId: { type: 'string', minLength: 1 },
    metadata: { type: 'object' },
  }
} as const

// 세션 기반 채팅 요청 스키마
const SessionChatRequestSchema = {
  type: 'object',
  required: ['sessionId', 'message'],
  properties: {
    sessionId: { type: 'string', format: 'uuid' },
    message: {
      type: 'string',
      minLength: CHAT_CONSTANTS.MESSAGE_MIN_LENGTH,
      maxLength: CHAT_CONSTANTS.MESSAGE_MAX_LENGTH
    },
    businessMetadata: {
      type: 'object',
      properties: {
        inquiryCategory: { type: 'string' },
        priority: { type: 'string', enum: ['긴급', '보통', '낮음'] },
        topicTags: { type: 'array', items: { type: 'string' } }
      }
    }
  }
} as const

// 타입 정의는 types/session-chat.ts로 이동됨

const sessionChatRoutes: FastifyPluginAsync = async (fastify) => {
  if (!fastify.integratedChatService) {
    throw new Error('IntegratedChatService가 초기화되지 않았습니다')
  }

  const integratedChatService = fastify.integratedChatService
  
  // RAGService 의존성 설정
  const embeddingService = new EmbeddingService(fastify.openaiClient!)
  const ragService = new RAGService(
    embeddingService,
    fastify.pineconeService!,
    new ChatService(fastify.openaiClient!),
    fastify.openaiClient!
  )

  // POST /api/session-chat/sessions - 새 세션 생성
  fastify.post<{
    Body: CreateSessionRequest
  }>('/sessions', {
    schema: {
      body: CreateSessionRequestSchema,
      response: {
        201: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', format: 'uuid' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: CreateSessionRequest }>, reply: FastifyReply) => {
    try {
      const { storeId, userId, metadata } = request.body

      const sessionData = {
        storeId,
        userId,
        metadata
      }
      
      const sessionId = await integratedChatService.createSession(sessionData)

      return reply.status(201).send({
        sessionId,
        message: '새 채팅 세션이 생성되었습니다'
      })
    } catch (error) {
      console.error('세션 생성 실패:', error)
      return reply.status(500).send({
        error: '세션 생성에 실패했습니다',
        timestamp: new Date().toISOString()
      })
    }
  })

  // GET /api/session-chat/sessions/:sessionId - 세션 정보 조회
  fastify.get<{
    Params: { sessionId: string }
    Querystring: { messageLimit?: number }
  }>('/sessions/:sessionId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', format: 'uuid' }
        },
        required: ['sessionId']
      },
      querystring: {
        type: 'object',
        properties: {
          messageLimit: { 
            type: 'number', 
            minimum: SESSION_CONSTANTS.MIN_MESSAGE_LIMIT, 
            maximum: SESSION_CONSTANTS.MAX_MESSAGE_LIMIT, 
            default: SESSION_CONSTANTS.DEFAULT_MESSAGE_LIMIT 
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Params: { sessionId: string }
    Querystring: { messageLimit?: number }
  }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params
      const { messageLimit = SESSION_CONSTANTS.DEFAULT_MESSAGE_LIMIT } = request.query

      const sessionContext = await integratedChatService.getSessionContext(sessionId, messageLimit)
      const sessionStats = await integratedChatService.getSessionStats(sessionId)

      return reply.send({
        session: sessionContext.session,
        recentMessages: sessionContext.recentMessages,
        stats: sessionStats
      })
    } catch (error) {
      console.error('세션 조회 실패:', error)
      return reply.status(404).send({
        error: '세션을 찾을 수 없습니다',
        timestamp: new Date().toISOString()
      })
    }
  })

  // POST /api/session-chat/:sessionId/stream - 세션 기반 스트리밍 채팅
  fastify.post<{
    Params: { sessionId: string }
    Body: Omit<SessionChatRequest, 'sessionId'>
  }>('/:sessionId/stream', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', format: 'uuid' }
        },
        required: ['sessionId']
      },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
            minLength: CHAT_CONSTANTS.MESSAGE_MIN_LENGTH,
            maxLength: CHAT_CONSTANTS.MESSAGE_MAX_LENGTH
          },
          businessMetadata: {
            type: 'object',
            properties: {
              inquiryCategory: { type: 'string' },
              priority: { type: 'string' },
              topicTags: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Params: { sessionId: string }
    Body: Omit<SessionChatRequest, 'sessionId'>
  }>, reply: FastifyReply) => {
    const { sessionId } = request.params
    const { message, businessMetadata } = request.body

    // SSE 헤더 설정
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    try {
      // 세션 유효성 확인
      await integratedChatService.getSessionContext(sessionId, 1)

      const startTime = Date.now()
      let fullResponse = ''
      let tokenCount = 0
      
      // 스트리밍 시작
      const streamGenerator = ragService.askQuestionStream({ message })

      for await (const event of streamGenerator) {
        const eventData = JSON.stringify(event)
        reply.raw.write(`data: ${eventData}\n\n`)

        // 응답 데이터 수집
        if (event.type === 'content') {
          fullResponse += event.content
        } else if (event.type === 'done' && event.data) {
          tokenCount = event.data.tokenCount || 0
        }
      }

      const responseTime = Date.now() - startTime

      // 통합 채팅 서비스에 로그 저장
      await integratedChatService.logChatInteraction({
        sessionId,
        userMessage: message,
        assistantResponse: fullResponse,
        tokenUsage: tokenCount,
        responseTimeMs: responseTime,
        businessMetadata: {
          ...businessMetadata,
          retrievedDocsCount: 0, // RAG 결과에서 가져와야 함
          relevanceScore: 0.8    // RAG 결과에서 가져와야 함
        }
      })

      // 세션 완료 이벤트 전송
      const completionEvent = JSON.stringify({
        type: 'session_logged',
        data: { 
          sessionId,
          responseTime,
          tokenCount,
          timestamp: new Date().toISOString()
        }
      })
      reply.raw.write(`data: ${completionEvent}\n\n`)

      // 스트림 종료
      reply.raw.end()

    } catch (error) {
      console.error('세션 기반 스트리밍 에러:', error)
      
      // 에러 이벤트 전송
      const errorEvent = JSON.stringify({
        type: 'error',
        content: '서버 에러가 발생했습니다. 잠시 후 다시 시도해주세요.',
        data: { 
          timestamp: new Date().toISOString(),
          sessionId 
        }
      })
      
      reply.raw.write(`data: ${errorEvent}\n\n`)
      reply.raw.end()
    }
  })

  // POST /api/session-chat/:sessionId - 세션 기반 REST API
  fastify.post<{
    Params: { sessionId: string }
    Body: Omit<SessionChatRequest, 'sessionId'>
  }>('/:sessionId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', format: 'uuid' }
        },
        required: ['sessionId']
      },
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: {
            type: 'string',
            minLength: CHAT_CONSTANTS.MESSAGE_MIN_LENGTH,
            maxLength: CHAT_CONSTANTS.MESSAGE_MAX_LENGTH
          },
          businessMetadata: {
            type: 'object',
            properties: {
              inquiryCategory: { type: 'string' },
              priority: { type: 'string' },
              topicTags: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      },
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
            sessionId: { type: 'string' },
            responseTime: { type: 'number' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{
    Params: { sessionId: string }
    Body: Omit<SessionChatRequest, 'sessionId'>
  }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params
      const { message, businessMetadata } = request.body

      // 세션 유효성 확인
      await integratedChatService.getSessionContext(sessionId, 1)

      const startTime = Date.now()
      
      // RAG 서비스 호출
      const response = await ragService.askQuestion({ question: message })
      
      const responseTime = Date.now() - startTime

      // 통합 채팅 서비스에 로그 저장
      await integratedChatService.logChatInteraction({
        sessionId,
        userMessage: message,
        assistantResponse: response.answer,
        tokenUsage: response.metadata?.tokenCount || 0,
        responseTimeMs: responseTime,
        businessMetadata: {
          ...businessMetadata,
          retrievedDocsCount: response.sources?.length || 0,
          relevanceScore: response.sources?.[0]?.score || 0
        }
      })

      return reply.send({
        ...response,
        sessionId,
        responseTime,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('세션 기반 채팅 API 에러:', error)
      
      return reply.status(500).send({
        error: '서버 에러가 발생했습니다. 잠시 후 다시 시도해주세요.',
        timestamp: new Date().toISOString()
      })
    }
  })

  // GET /api/session-chat/:sessionId/stats - 세션 통계 조회
  fastify.get<{
    Params: { sessionId: string }
  }>('/:sessionId/stats', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', format: 'uuid' }
        },
        required: ['sessionId']
      }
    }
  }, async (request: FastifyRequest<{
    Params: { sessionId: string }
  }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params
      const stats = await integratedChatService.getSessionStats(sessionId)
      
      return reply.send(stats)
    } catch (error) {
      console.error('세션 통계 조회 실패:', error)
      return reply.status(404).send({
        error: '세션을 찾을 수 없습니다',
        timestamp: new Date().toISOString()
      })
    }
  })
}

export default sessionChatRoutes