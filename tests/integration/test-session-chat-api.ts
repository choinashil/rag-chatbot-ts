/**
 * 세션 기반 채팅 API 통합 테스트
 * 실제 데이터베이스 연동 및 API 엔드포인트 검증
 */

import dotenv from 'dotenv'
import path from 'path'
import { FastifyInstance } from 'fastify'
import { buildApp } from '../../src/server'

// 환경변수 로드 (테스트용)
dotenv.config({ path: path.join(__dirname, '../../env/.env.dev') })

describe('Session Chat API Integration Tests', () => {
  let app: FastifyInstance
  let testSessionId: string

  beforeAll(async () => {
    // 테스트용 Fastify 앱 생성
    app = await buildApp()
    
    // 서버가 데이터베이스 연결을 지원하는지 확인
    if (!app.integratedChatService) {
      console.log('⚠️  데이터베이스 연결이 없어 세션 API 테스트를 건너뜁니다')
      return
    }
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  describe('POST /api/session-chat/sessions', () => {
    test('새 세션 생성이 성공해야 함', async () => {
      if (!app.integratedChatService) {
        console.log('⚠️  하이브리드 추적 서비스 없음 - 테스트 건너뜀')
        return
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/session-chat/sessions',
        payload: {
          storeId: 'test-store-001',
          userId: 'test-user-001',
          metadata: {
            userAgent: 'test-agent',
            source: 'integration-test'
          }
        }
      })

      expect(response.statusCode).toBe(201)
      
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('sessionId')
      expect(body).toHaveProperty('message')
      expect(typeof body.sessionId).toBe('string')
      
      // 생성된 세션 ID를 다른 테스트에서 사용
      testSessionId = body.sessionId
      
      console.log('✅ 테스트 세션 생성됨:', testSessionId)
    })

    test('필수 필드 누락 시 400 에러를 반환해야 함', async () => {
      if (!app.integratedChatService) {
        return
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/session-chat/sessions',
        payload: {
          storeId: 'test-store',
          // userId 누락
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/session-chat/sessions/:sessionId', () => {
    test('세션 정보를 성공적으로 조회해야 함', async () => {
      if (!app.integratedChatService || !testSessionId) {
        return
      }

      const response = await app.inject({
        method: 'GET',
        url: `/api/session-chat/sessions/${testSessionId}`
      })

      expect(response.statusCode).toBe(200)
      
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('session')
      expect(body).toHaveProperty('recentMessages')
      expect(body).toHaveProperty('stats')
      
      expect(body.session.id).toBe(testSessionId)
      expect(body.session.store_id).toBe('test-store-001')
      expect(body.session.user_id).toBe('test-user-001')
      expect(Array.isArray(body.recentMessages)).toBe(true)
    })

    test('존재하지 않는 세션 조회 시 404 에러를 반환해야 함', async () => {
      if (!app.integratedChatService) {
        return
      }

      const response = await app.inject({
        method: 'GET',
        url: '/api/session-chat/sessions/non-existent-session-id'
      })

      expect(response.statusCode).toBe(404)
    })
  })

  describe('POST /api/session-chat/:sessionId (REST)', () => {
    test('세션 기반 채팅이 성공해야 함', async () => {
      if (!app.integratedChatService || !testSessionId) {
        return
      }

      // OpenAI 클라이언트가 있는지 확인
      if (!app.openaiClient) {
        console.log('⚠️  OpenAI 클라이언트 없음 - 채팅 테스트 건너뜀')
        return
      }

      const response = await app.inject({
        method: 'POST',
        url: `/api/session-chat/${testSessionId}`,
        payload: {
          message: '안녕하세요! 테스트 메시지입니다.',
          businessMetadata: {
            inquiryCategory: '테스트',
            priority: '보통',
            topicTags: ['통합테스트', 'API']
          }
        }
      })

      expect(response.statusCode).toBe(200)
      
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('answer')
      expect(body).toHaveProperty('sessionId', testSessionId)
      expect(body).toHaveProperty('responseTime')
      expect(body).toHaveProperty('timestamp')
      
      expect(typeof body.answer).toBe('string')
      expect(typeof body.responseTime).toBe('number')
      
      console.log('✅ 세션 기반 채팅 응답:', {
        sessionId: body.sessionId,
        responseTime: body.responseTime,
        answerLength: body.answer.length
      })
    }, 30000) // 30초 타임아웃 (OpenAI API 호출 시간 고려)

    test('잘못된 세션 ID로 채팅 시 404 에러를 반환해야 함', async () => {
      if (!app.integratedChatService) {
        return
      }

      const response = await app.inject({
        method: 'POST',
        url: '/api/session-chat/invalid-session-id',
        payload: {
          message: '테스트 메시지'
        }
      })

      expect(response.statusCode).toBe(404)
    })

    test('빈 메시지로 요청 시 400 에러를 반환해야 함', async () => {
      if (!app.integratedChatService || !testSessionId) {
        return
      }

      const response = await app.inject({
        method: 'POST',
        url: `/api/session-chat/${testSessionId}`,
        payload: {
          message: ''  // 빈 메시지
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /api/session-chat/:sessionId/stats', () => {
    test('세션 통계를 성공적으로 조회해야 함', async () => {
      if (!app.integratedChatService || !testSessionId) {
        return
      }

      const response = await app.inject({
        method: 'GET',
        url: `/api/session-chat/${testSessionId}/stats`
      })

      expect(response.statusCode).toBe(200)
      
      const stats = JSON.parse(response.body)
      expect(stats).toHaveProperty('messageCount')
      expect(stats).toHaveProperty('totalTokens')
      expect(stats).toHaveProperty('avgResponseTime')
      expect(stats).toHaveProperty('lastActiveAt')
      
      expect(typeof stats.messageCount).toBe('number')
      expect(typeof stats.totalTokens).toBe('number')
      expect(typeof stats.avgResponseTime).toBe('number')
      
      console.log('✅ 세션 통계:', stats)
    })
  })

  describe('POST /api/session-chat/:sessionId/stream (SSE)', () => {
    test('스트리밍 채팅이 성공해야 함', async () => {
      if (!app.integratedChatService || !testSessionId) {
        return
      }

      // OpenAI 클라이언트가 있는지 확인
      if (!app.openaiClient) {
        console.log('⚠️  OpenAI 클라이언트 없음 - 스트리밍 테스트 건너뜀')
        return
      }

      const response = await app.inject({
        method: 'POST',
        url: `/api/session-chat/${testSessionId}/stream`,
        payload: {
          message: '스트리밍 테스트 메시지입니다.',
          businessMetadata: {
            inquiryCategory: '스트리밍테스트',
            priority: '낮음'
          }
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.headers['content-type']).toBe('text/event-stream')
      
      // SSE 응답 본문에 이벤트 데이터가 포함되어야 함
      expect(response.body).toContain('data:')
      
      console.log('✅ 스트리밍 응답 시작됨')
    }, 30000) // 30초 타임아웃
  })

  describe('세션별 메시지 이력 검증', () => {
    test('채팅 후 세션에 메시지가 저장되어야 함', async () => {
      if (!app.integratedChatService || !testSessionId) {
        return
      }

      // 세션 정보 다시 조회하여 메시지 확인
      const response = await app.inject({
        method: 'GET',
        url: `/api/session-chat/sessions/${testSessionId}?messageLimit=10`
      })

      expect(response.statusCode).toBe(200)
      
      const body = JSON.parse(response.body)
      const messages = body.recentMessages
      
      // 적어도 하나의 메시지가 있어야 함 (이전 테스트에서 생성됨)
      expect(messages.length).toBeGreaterThan(0)
      
      // 메시지 구조 확인
      const firstMessage = messages[0]
      expect(firstMessage).toHaveProperty('role')
      expect(firstMessage).toHaveProperty('content')
      expect(firstMessage).toHaveProperty('sequence_number')
      expect(firstMessage).toHaveProperty('created_at')
      
      console.log('✅ 세션 메시지 이력:', {
        sessionId: testSessionId,
        messageCount: messages.length,
        roles: messages.map((m: any) => m.role)
      })
    })
  })

  // 테스트 정리
  describe('테스트 데이터 정리', () => {
    test('테스트용 세션 데이터 정리', async () => {
      if (!app.integratedChatService || !testSessionId) {
        return
      }

      // 실제 운영에서는 soft delete를 사용하지만, 테스트에서는 완전 삭제
      try {
        const pool = app.databasePool
        if (pool) {
          const client = await pool.connect()
          
          // 테스트 메시지 삭제
          await client.query('DELETE FROM chat_messages WHERE session_id = $1', [testSessionId])
          
          // 테스트 세션 삭제
          await client.query('DELETE FROM chat_sessions WHERE id = $1', [testSessionId])
          
          client.release()
          console.log('🧹 테스트 데이터 정리 완료')
        }
      } catch (error) {
        console.warn('⚠️  테스트 데이터 정리 중 오류:', error)
      }
    })
  })
})