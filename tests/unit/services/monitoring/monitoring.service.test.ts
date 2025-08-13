/**
 * MonitoringService 유닛 테스트
 */

import { MonitoringService } from '../../../../src/services/monitoring/monitoring.service'

const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation()

describe('MonitoringService', () => {
  let monitoringService: MonitoringService
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    monitoringService = new MonitoringService()
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('초기화', () => {
    test('LangSmith 환경변수가 모두 설정된 경우 활성화되어야 함', () => {
      process.env.LANGCHAIN_TRACING_V2 = 'true'
      process.env.LANGCHAIN_API_KEY = 'test-key'
      process.env.LANGCHAIN_PROJECT = 'test-project'

      const service = new MonitoringService()
      
      expect(service.isMonitoringEnabled()).toBe(true)
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ AI 모니터링 활성화됨')
    })

    test('필수 환경변수가 누락된 경우 비활성화되어야 함', () => {
      delete process.env.LANGCHAIN_TRACING_V2
      delete process.env.LANGCHAIN_API_KEY
      delete process.env.LANGCHAIN_PROJECT

      const service = new MonitoringService()
      
      expect(service.isMonitoringEnabled()).toBe(false)
      expect(mockConsoleLog).toHaveBeenCalledWith('⚠️  AI 모니터링 비활성화됨')
    })
  })

  describe('getMonitoringConfig', () => {
    test('모니터링 설정을 올바르게 반환해야 함', () => {
      process.env.LANGCHAIN_PROJECT = 'test-project'
      process.env.LANGCHAIN_ENDPOINT = 'https://custom.endpoint.com'

      const service = new MonitoringService()
      const config = service.getMonitoringConfig()

      expect(config).toEqual({
        enabled: expect.any(Boolean),
        project: 'test-project',
        endpoint: 'https://custom.endpoint.com'
      })
    })

    test('기본 endpoint를 사용해야 함', () => {
      delete process.env.LANGCHAIN_ENDPOINT

      const service = new MonitoringService()
      const config = service.getMonitoringConfig()

      expect(config.endpoint).toBe('https://api.smith.langchain.com')
    })
  })

  describe('trackAIInteraction', () => {
    test('모니터링 활성화 시 상호작용을 추적해야 함', async () => {
      process.env.LANGCHAIN_TRACING_V2 = 'true'
      process.env.LANGCHAIN_API_KEY = 'test-key'
      process.env.LANGCHAIN_PROJECT = 'test-project'

      const service = new MonitoringService()
      const testData = {
        sessionId: 'test-session',
        responseTimeMs: 1500,
        tokenUsage: { total: 100 }
      }

      await service.trackAIInteraction(testData)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '📊 AI 상호작용 추적:',
        {
          sessionId: 'test-session',
          responseTime: '1500ms',
          tokenUsage: { total: 100 }
        }
      )
    })

    test('모니터링 비활성화 시 무시해야 함', async () => {
      delete process.env.LANGCHAIN_TRACING_V2

      const service = new MonitoringService()
      await service.trackAIInteraction({ sessionId: 'test' })

      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining('📊 AI 상호작용 추적:')
      )
    })

    test('에러 발생 시 에러를 기록해야 함', async () => {
      process.env.LANGCHAIN_TRACING_V2 = 'true'
      process.env.LANGCHAIN_API_KEY = 'test-key'
      process.env.LANGCHAIN_PROJECT = 'test-project'

      const service = new MonitoringService()
      
      // 잘못된 데이터로 에러 유발
      const badData = { get tokenUsage() { throw new Error('Test error') } }
      
      await service.trackAIInteraction(badData)

      expect(mockConsoleError).toHaveBeenCalledWith(
        '모니터링 추적 실패:',
        expect.any(Error)
      )
    })
  })

  describe('trackUserFeedback', () => {
    test('모니터링 활성화 시 사용자 피드백을 추적해야 함', async () => {
      process.env.LANGCHAIN_TRACING_V2 = 'true'
      process.env.LANGCHAIN_API_KEY = 'test-key'
      process.env.LANGCHAIN_PROJECT = 'test-project'

      const service = new MonitoringService()
      const feedbackData = {
        sessionId: 'test-session',
        messageId: 'test-message',
        rating: 5,
        comment: '매우 좋습니다'
      }

      await service.trackUserFeedback(feedbackData)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '📝 사용자 피드백 추적:',
        {
          sessionId: 'test-session',
          rating: 5,
          hasComment: true
        }
      )
    })

    test('comment 없이도 작동해야 함', async () => {
      process.env.LANGCHAIN_TRACING_V2 = 'true'
      process.env.LANGCHAIN_API_KEY = 'test-key'
      process.env.LANGCHAIN_PROJECT = 'test-project'

      const service = new MonitoringService()
      const feedbackData = {
        sessionId: 'test-session',
        messageId: 'test-message',
        rating: 3
      }

      await service.trackUserFeedback(feedbackData)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        '📝 사용자 피드백 추적:',
        {
          sessionId: 'test-session',
          rating: 3,
          hasComment: false
        }
      )
    })

    test('모니터링 비활성화 시 무시해야 함', async () => {
      delete process.env.LANGCHAIN_TRACING_V2

      const service = new MonitoringService()
      await service.trackUserFeedback({
        sessionId: 'test',
        messageId: 'test',
        rating: 5
      })

      expect(mockConsoleLog).not.toHaveBeenCalledWith(
        expect.stringContaining('📝 사용자 피드백 추적:')
      )
    })
  })

  describe('checkConnection', () => {
    test('모니터링 활성화 시 true를 반환해야 함', async () => {
      process.env.LANGCHAIN_TRACING_V2 = 'true'
      process.env.LANGCHAIN_API_KEY = 'test-key'
      process.env.LANGCHAIN_PROJECT = 'test-project'

      const service = new MonitoringService()
      const result = await service.checkConnection()

      expect(result).toBe(true)
    })

    test('모니터링 비활성화 시 false를 반환해야 함', async () => {
      delete process.env.LANGCHAIN_TRACING_V2

      const service = new MonitoringService()
      const result = await service.checkConnection()

      expect(result).toBe(false)
    })
  })
})