/**
 * ChatAnalyticsService 유닛 테스트
 * 메시지 통계, 성능 메트릭, 비즈니스 분석 테스트
 */

import { Pool } from 'pg'
import { ChatAnalyticsService } from '../../../../src/services/analytics/chat-analytics.service'

describe('ChatAnalyticsService', () => {
  let analyticsService: ChatAnalyticsService
  let mockPool: jest.Mocked<Pool>
  let mockClient: { query: jest.MockedFunction<any>; release: jest.MockedFunction<any> }

  beforeEach(() => {
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    }

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient)
    } as any

    analyticsService = new ChatAnalyticsService(mockPool)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getSessionStats', () => {
    test('세션 통계를 성공적으로 조회해야 함', async () => {
      const sessionId = 'test-session-id'
      const mockStats = {
        message_count: '10',
        total_tokens: '250',
        avg_response_time: '1500.5',
        last_active_at: new Date('2024-01-01T12:00:00Z')
      }

      mockClient.query.mockResolvedValue({ rows: [mockStats] })

      const result = await analyticsService.getSessionStats(sessionId)

      expect(result).toEqual({
        messageCount: 10,
        totalTokens: 250,
        avgResponseTime: 1500.5,
        lastActiveAt: new Date('2024-01-01T12:00:00Z')
      })

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as message_count'),
        [sessionId]
      )
      expect(mockClient.release).toHaveBeenCalled()
    })

    test('메시지가 없는 세션의 경우 기본값을 반환해야 함', async () => {
      const sessionId = 'empty-session-id'
      mockClient.query.mockResolvedValue({ rows: [] })

      const result = await analyticsService.getSessionStats(sessionId)

      expect(result.messageCount).toBe(0)
      expect(result.totalTokens).toBe(0)
      expect(result.avgResponseTime).toBe(0)
      expect(result.lastActiveAt).toBeInstanceOf(Date)
    })

    test('null 값이 있는 경우 적절히 처리해야 함', async () => {
      const sessionId = 'test-session-id'
      const mockStats = {
        message_count: '5',
        total_tokens: null,
        avg_response_time: null,
        last_active_at: new Date()
      }

      mockClient.query.mockResolvedValue({ rows: [mockStats] })

      const result = await analyticsService.getSessionStats(sessionId)

      expect(result.messageCount).toBe(5)
      expect(result.totalTokens).toBe(0)
      expect(result.avgResponseTime).toBe(0)
    })
  })

  describe('getStoreDailyStats', () => {
    test('스토어별 일일 통계를 성공적으로 조회해야 함', async () => {
      const storeId = 'test-store'
      const date = new Date('2024-01-01')
      
      const mockStats = {
        session_count: '5',
        message_count: '25',
        total_tokens: '500',
        avg_response_time: '1200.0'
      }

      const mockCategories = [
        { category: '배송문의', count: '10' },
        { category: '환불문의', count: '8' },
        { category: '상품문의', count: '7' }
      ]

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockStats] })
        .mockResolvedValueOnce({ rows: mockCategories })

      const result = await analyticsService.getStoreDailyStats(storeId, date)

      expect(result).toEqual({
        sessionCount: 5,
        messageCount: 25,
        totalTokens: 500,
        avgResponseTime: 1200.0,
        topCategories: [
          { category: '배송문의', count: 10 },
          { category: '환불문의', count: 8 },
          { category: '상품문의', count: 7 }
        ]
      })

      expect(mockClient.query).toHaveBeenCalledTimes(2)
      expect(mockClient.release).toHaveBeenCalled()
    })

    test('데이터가 없는 경우 기본값을 반환해야 함', async () => {
      const storeId = 'empty-store'
      const date = new Date('2024-01-01')
      
      const mockEmptyStats = {
        session_count: null,
        message_count: null,
        total_tokens: null,
        avg_response_time: null
      }

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockEmptyStats] })
        .mockResolvedValueOnce({ rows: [] })

      const result = await analyticsService.getStoreDailyStats(storeId, date)

      expect(result).toEqual({
        sessionCount: 0,
        messageCount: 0,
        totalTokens: 0,
        avgResponseTime: 0,
        topCategories: []
      })
    })
  })

  describe('getPerformanceMetrics', () => {
    test('성능 메트릭을 성공적으로 조회해야 함', async () => {
      const storeId = 'test-store'
      const days = 7
      
      const mockMetrics = {
        avg_response_time: '1500.5',
        p50_response_time: '1200.0',
        p95_response_time: '3000.0',
        p99_response_time: '5000.0',
        avg_tokens: '45.2',
        total_tokens: '2260',
        error_count: '3',
        total_messages: '50'
      }

      mockClient.query.mockResolvedValue({ rows: [mockMetrics] })

      const result = await analyticsService.getPerformanceMetrics(storeId, days)

      expect(result).toEqual({
        avgResponseTime: 1500.5,
        responseTimePercentiles: {
          p50: 1200.0,
          p95: 3000.0,
          p99: 5000.0
        },
        tokenUsageStats: {
          avg: 45.2,
          total: 2260
        },
        errorRate: 6.0 // 3/50 * 100
      })

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('PERCENTILE_CONT'),
        [storeId, days]
      )
    })

    test('에러가 없는 경우 에러율이 0이어야 함', async () => {  
      const storeId = 'test-store'
      const mockMetrics = {
        avg_response_time: '1500.0',
        p50_response_time: '1200.0',
        p95_response_time: '3000.0',
        p99_response_time: '5000.0',
        avg_tokens: '45.0',
        total_tokens: '2250',
        error_count: '0',
        total_messages: '50'
      }

      mockClient.query.mockResolvedValue({ rows: [mockMetrics] })

      const result = await analyticsService.getPerformanceMetrics(storeId)

      expect(result.errorRate).toBe(0.0)
    })

    test('메시지가 없는 경우에도 처리되어야 함', async () => {
      const storeId = 'empty-store'
      const mockEmptyMetrics = {
        avg_response_time: null,
        p50_response_time: null,
        p95_response_time: null,
        p99_response_time: null,
        avg_tokens: null,
        total_tokens: null,
        error_count: null,
        total_messages: '0'
      }

      mockClient.query.mockResolvedValue({ rows: [mockEmptyMetrics] })

      const result = await analyticsService.getPerformanceMetrics(storeId)

      expect(result).toEqual({
        avgResponseTime: 0,
        responseTimePercentiles: {
          p50: 0,
          p95: 0,
          p99: 0
        },
        tokenUsageStats: {
          avg: 0,
          total: 0
        },
        errorRate: 0
      })
    })
  })

  describe('calculateTokens', () => {
    test('정상적인 텍스트의 토큰을 계산해야 함', () => {
      const text = '안녕하세요 도움이 필요하신가요'

      const tokens = analyticsService.calculateTokens(text)

      expect(tokens).toBe(Math.ceil(3 * 1.3)) // 3 words * 1.3 = 3.9 -> 4
    })

    test('빈 문자열의 경우 0을 반환해야 함', () => {
      expect(analyticsService.calculateTokens('')).toBe(0)
      expect(analyticsService.calculateTokens('   ')).toBe(0)
    })

    test('null이나 undefined의 경우 0을 반환해야 함', () => {
      expect(analyticsService.calculateTokens(null as any)).toBe(0)
      expect(analyticsService.calculateTokens(undefined as any)).toBe(0)
    })

    test('단일 단어의 경우 올바르게 계산해야 함', () => {
      const text = '안녕하세요'

      const tokens = analyticsService.calculateTokens(text)

      expect(tokens).toBe(Math.ceil(1 * 1.3)) // 1 word * 1.3 = 1.3 -> 2
    })

    test('여러 공백이 있는 텍스트도 올바르게 처리해야 함', () => {
      const text = '안녕하세요    도움이    필요하신가요'

      const tokens = analyticsService.calculateTokens(text)

      expect(tokens).toBe(Math.ceil(3 * 1.3)) // 3 words * 1.3 = 3.9 -> 4
    })
  })
})