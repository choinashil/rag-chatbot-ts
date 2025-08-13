/**
 * ChatService 유닛 테스트
 * SessionService + ChatAnalyticsService + MonitoringService 통합 테스트
 */

import { Pool } from 'pg'
import { ChatService } from '../../../../src/services/chat/chat.service'
import { SessionService } from '../../../../src/services/session/session.service'
import { ChatAnalyticsService } from '../../../../src/services/analytics/analytics.service'
import { MonitoringService } from '../../../../src/services/monitoring/monitoring.service'
import { ChatInteractionData, SessionData } from '../../../../src/types'

jest.mock('../../../../src/services/session/session.service')
jest.mock('../../../../src/services/analytics/analytics.service')
jest.mock('../../../../src/services/monitoring/monitoring.service')

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation()

describe('ChatService', () => {
  let integratedService: ChatService
  let mockPool: jest.Mocked<Pool>
  let mockSessionService: jest.Mocked<SessionService>
  let mockAnalyticsService: jest.Mocked<ChatAnalyticsService>
  let mockMonitoringService: jest.Mocked<MonitoringService>

  beforeEach(() => {
    mockPool = {} as jest.Mocked<Pool>

    mockSessionService = new SessionService(mockPool) as jest.Mocked<SessionService>
    mockAnalyticsService = new ChatAnalyticsService(mockPool) as jest.Mocked<ChatAnalyticsService>
    mockMonitoringService = new MonitoringService() as jest.Mocked<MonitoringService>

    ;(SessionService as jest.Mock).mockImplementation(() => mockSessionService)
    ;(ChatAnalyticsService as jest.Mock).mockImplementation(() => mockAnalyticsService)
    ;(MonitoringService as jest.Mock).mockImplementation(() => mockMonitoringService)

    integratedService = new ChatService(mockPool)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    test('모든 서비스가 올바르게 초기화되어야 함', () => {
      const service = new ChatService(mockPool)

      expect(SessionService).toHaveBeenCalledWith(mockPool)
      expect(ChatAnalyticsService).toHaveBeenCalledWith(mockPool)
      expect(MonitoringService).toHaveBeenCalledWith()
    })
  })

  describe('logChatInteraction', () => {
    test('채팅 상호작용을 성공적으로 로그해야 함', async () => {
      const chatData: ChatInteractionData = {
        sessionId: 'test-session',
        userMessage: '배송은 언제 되나요?',
        assistantResponse: '영업일 기준 2-3일 소요됩니다.',
        tokenUsage: 45,
        responseTimeMs: 1200,
        langsmithTraceId: 'trace-123',
        businessMetadata: {
          inquiryCategory: '배송문의',
          priority: '보통'
        }
      }

      mockAnalyticsService.calculateTokens.mockReturnValue(8)
      mockSessionService.saveMessage
        .mockResolvedValueOnce('user-message-id') // 첫 번째 호출
        .mockResolvedValueOnce('assistant-message-id') // 두 번째 호출
      mockMonitoringService.trackAIInteraction.mockResolvedValue(undefined)

      await integratedService.logChatInteraction(chatData)

      // 사용자 메시지 저장 확인
      expect(mockSessionService.saveMessage).toHaveBeenNthCalledWith(1, {
        sessionId: 'test-session',
        role: 'user',
        content: '배송은 언제 되나요?',
        tokenCount: 8,
        langsmithTraceId: 'trace-123'
      })

      // 어시스턴트 응답 저장 확인
      expect(mockSessionService.saveMessage).toHaveBeenNthCalledWith(2, {
        sessionId: 'test-session',
        role: 'assistant',
        content: '영업일 기준 2-3일 소요됩니다.',
        tokenCount: 45,
        responseTimeMs: 1200,
        langsmithTraceId: 'trace-123',
        parentMessageId: 'user-message-id',
        metadata: {
          inquiryCategory: '배송문의',
          priority: '보통'
        }
      })

      // LangSmith 추적 확인
      expect(mockMonitoringService.trackAIInteraction).toHaveBeenCalledWith({
        sessionId: 'test-session',
        userMessage: '배송은 언제 되나요?',
        assistantResponse: '영업일 기준 2-3일 소요됩니다.',
        tokenUsage: 45,
        responseTimeMs: 1200,
        langsmithTraceId: 'trace-123',
        businessMetadata: {
          inquiryCategory: '배송문의',
          priority: '보통'
        }
      })

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ PostgreSQL 저장 완료:',
        {
          sessionId: 'test-session',
          userMessageId: 'user-message-id',
          assistantMessageId: 'assistant-message-id'
        }
      )
    })

    test('LangSmith 실패 시 PostgreSQL은 보존되어야 함', async () => {
      const chatData: ChatInteractionData = {
        sessionId: 'test-session',
        userMessage: '안녕하세요',
        assistantResponse: '안녕하세요!'
      }

      mockAnalyticsService.calculateTokens.mockReturnValue(3)
      mockSessionService.saveMessage
        .mockResolvedValueOnce('user-msg-id')
        .mockResolvedValueOnce('assistant-msg-id')
      
      const langSmithError = new Error('LangSmith connection failed')
      mockMonitoringService.trackAIInteraction.mockRejectedValue(langSmithError)

      await expect(integratedService.logChatInteraction(chatData)).resolves.not.toThrow()

      expect(mockSessionService.saveMessage).toHaveBeenCalledTimes(2)
      expect(mockConsoleLog).toHaveBeenCalledWith(
        '✅ PostgreSQL 저장 완료:',
        expect.objectContaining({ sessionId: 'test-session' })
      )

      // 에러가 비동기적으로 처리되므로 잠시 기다림
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ LangSmith 추적 실패 (PostgreSQL은 보존됨):',
        langSmithError
      )
    })

    test('PostgreSQL 저장 실패 시 예외를 발생시켜야 함', async () => {
      const chatData: ChatInteractionData = {
        sessionId: 'test-session',
        userMessage: '테스트',
        assistantResponse: '응답'
      }

      mockAnalyticsService.calculateTokens.mockReturnValue(2)
      const dbError = new Error('Database connection failed')
      mockSessionService.saveMessage.mockRejectedValue(dbError)

      await expect(integratedService.logChatInteraction(chatData)).rejects.toThrow(dbError)
      expect(mockConsoleError).toHaveBeenCalledWith('❌ 통합 채팅 추적 실패:', dbError)
    })
  })

  describe('createSession', () => {
    test('세션 생성을 SessionService에 위임해야 함', async () => {
      const sessionData: SessionData = {
        storeId: 'test-store',
        userId: 'test-user',
        metadata: { source: 'web' }
      }

      mockSessionService.createSession.mockResolvedValue('new-session-id')

      const result = await integratedService.createSession(sessionData)

      expect(result).toBe('new-session-id')
      expect(mockSessionService.createSession).toHaveBeenCalledWith(sessionData)
    })
  })

  describe('getSessionContext', () => {
    test('세션 컨텍스트 조회를 SessionService에 위임해야 함', async () => {
      const sessionId = 'test-session'
      const messageLimit = 10
      const mockContext = {
        session: { id: sessionId, store_id: 'test-store' },
        recentMessages: []
      }

      mockSessionService.getSessionContext.mockResolvedValue(mockContext)

      const result = await integratedService.getSessionContext(sessionId, messageLimit)

      expect(result).toBe(mockContext)
      expect(mockSessionService.getSessionContext).toHaveBeenCalledWith(sessionId, messageLimit)
    })

    test('메시지 제한이 없으면 기본값을 사용해야 함', async () => {
      const sessionId = 'test-session'
      const mockContext = { session: {}, recentMessages: [] }

      mockSessionService.getSessionContext.mockResolvedValue(mockContext)

      await integratedService.getSessionContext(sessionId)

      expect(mockSessionService.getSessionContext).toHaveBeenCalledWith(sessionId, 5)
    })
  })

  describe('getSessionStats', () => {
    test('세션 통계 조회를 AnalyticsService에 위임해야 함', async () => {
      const sessionId = 'test-session'
      const mockStats = {
        messageCount: 10,
        totalTokens: 250,
        avgResponseTime: 1200,
        lastActiveAt: new Date()
      }

      mockAnalyticsService.getSessionStats.mockResolvedValue(mockStats)
      
      const result = await integratedService.getSessionStats(sessionId)

      expect(result).toBe(mockStats)
      expect(mockAnalyticsService.getSessionStats).toHaveBeenCalledWith(sessionId)
    })
  })

  describe('getStoreDailyStats', () => {
    test('스토어별 일일 통계 조회를 AnalyticsService에 위임해야 함', async () => {
      const storeId = 'test-store'
      const date = new Date('2024-01-01')
      const mockStats = {
        sessionCount: 5,
        messageCount: 25,
        totalTokens: 500,
        avgResponseTime: 1200,
        topCategories: []
      }

      mockAnalyticsService.getStoreDailyStats.mockResolvedValue(mockStats)

      const result = await integratedService.getStoreDailyStats(storeId, date)

      expect(result).toBe(mockStats)
      expect(mockAnalyticsService.getStoreDailyStats).toHaveBeenCalledWith(storeId, date)
    })
  })

  describe('getPerformanceMetrics', () => {
    test('성능 메트릭 조회를 AnalyticsService에 위임해야 함', async () => {
      const storeId = 'test-store'
      const days = 14
      const mockMetrics = {
        avgResponseTime: 1500,
        responseTimePercentiles: { p50: 1200, p95: 3000, p99: 5000 },
        tokenUsageStats: { avg: 45, total: 2250 },
        errorRate: 2.5
      }

      mockAnalyticsService.getPerformanceMetrics.mockResolvedValue(mockMetrics)

      const result = await integratedService.getPerformanceMetrics(storeId, days)

      expect(result).toBe(mockMetrics)
      expect(mockAnalyticsService.getPerformanceMetrics).toHaveBeenCalledWith(storeId, days)
    })

    test('기본 기간(7일)을 사용해야 함', async () => {
      const storeId = 'test-store'
      const mockMetrics = { 
        avgResponseTime: 1000, 
        responseTimePercentiles: { p50: 1000, p95: 2000, p99: 3000 }, 
        tokenUsageStats: { avg: 30, total: 1500 }, 
        errorRate: 0 
      }

      mockAnalyticsService.getPerformanceMetrics.mockResolvedValue(mockMetrics)

      await integratedService.getPerformanceMetrics(storeId)

      expect(mockAnalyticsService.getPerformanceMetrics).toHaveBeenCalledWith(storeId, 7)
    })
  })

  describe('addUserFeedback', () => {
    test('사용자 피드백을 MonitoringService에 위임해야 함', async () => {
      const sessionId = 'test-session'
      const messageId = 'test-message'
      const rating = 4
      const comment = '도움이 되었습니다'

      mockMonitoringService.trackUserFeedback.mockResolvedValue(undefined)

      await integratedService.addUserFeedback(sessionId, messageId, rating, comment)

      expect(mockMonitoringService.trackUserFeedback).toHaveBeenCalledWith({
        sessionId,
        messageId,
        rating,
        comment
      })
    })

    test('코멘트 없이도 피드백을 추가할 수 있어야 함', async () => {
      const sessionId = 'test-session'
      const messageId = 'test-message'
      const rating = 5

      mockMonitoringService.trackUserFeedback.mockResolvedValue(undefined)

      await integratedService.addUserFeedback(sessionId, messageId, rating)

      expect(mockMonitoringService.trackUserFeedback).toHaveBeenCalledWith({
        sessionId,
        messageId,
        rating,
        comment: undefined
      })
    })
  })

  describe('cleanupExpiredSessions', () => {
    test('만료된 세션 정리를 SessionService에 위임해야 함', async () => {
      mockSessionService.cleanupExpiredSessions.mockResolvedValue(5)

      const result = await integratedService.cleanupExpiredSessions()

      expect(result).toBe(5)
      expect(mockSessionService.cleanupExpiredSessions).toHaveBeenCalled()
    })
  })

  describe('hardDeleteOldData', () => {
    test('오래된 데이터 완전 삭제를 SessionService에 위임해야 함', async () => {
      mockSessionService.hardDeleteOldData.mockResolvedValue(3)

      const result = await integratedService.hardDeleteOldData()

      expect(result).toBe(3)
      expect(mockSessionService.hardDeleteOldData).toHaveBeenCalled()
    })
  })

  describe('getHealthStatus', () => {
    test('LangSmith 연결 성공 시 모든 서비스가 활성 상태여야 함', async () => {
      mockMonitoringService.checkConnection.mockResolvedValue(true)

      const result = await integratedService.getHealthStatus()

      expect(result).toEqual({
        database: 'connected',
        langSmith: 'connected',
        services: {
          session: 'active',
          analytics: 'active',
          monitoring: 'active'
        }
      })
    })

    test('LangSmith 연결 실패 시 모니터링 서비스가 degraded 상태여야 함', async () => {
      mockMonitoringService.checkConnection.mockResolvedValue(false)

      const result = await integratedService.getHealthStatus()

      expect(result).toEqual({
        database: 'connected',
        langSmith: 'disconnected',
        services: {
          session: 'active',
          analytics: 'active',
          monitoring: 'degraded'
        }
      })
    })
  })
})