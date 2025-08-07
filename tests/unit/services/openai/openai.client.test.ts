// OpenAI 클라이언트 단위 테스트
import { OpenAIClient } from '../../../../src/services/openai/openai.client'
import { OpenAIConfig } from '../../../../src/types/openai'
import OpenAI from 'openai'

// OpenAI 모듈 모킹
jest.mock('openai')
const MockedOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>

describe('OpenAIClient', () => {
  let validConfig: OpenAIConfig
  let mockOpenAIInstance: jest.Mocked<OpenAI>

  beforeEach(() => {
    // 유효한 설정 객체
    validConfig = {
      apiKey: 'sk-test-key-12345',
      timeout: 30000,
      maxRetries: 3,
      models: {
        embedding: 'text-embedding-3-small',
        chat: 'gpt-3.5-turbo'
      }
    }

    // OpenAI 인스턴스 모킹
    mockOpenAIInstance = {
      models: {
        list: jest.fn().mockResolvedValue({ data: [] })
      }
    } as any

    MockedOpenAI.mockImplementation(() => mockOpenAIInstance)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('생성자', () => {
    test('유효한 설정으로 클라이언트 생성 성공', () => {
      const client = new OpenAIClient(validConfig)

      expect(client).toBeInstanceOf(OpenAIClient)
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: validConfig.apiKey,
        organization: undefined,
        timeout: validConfig.timeout,
        maxRetries: validConfig.maxRetries
      })
    })

    test('organization이 있는 설정으로 클라이언트 생성 성공', () => {
      const configWithOrg = {
        ...validConfig,
        organization: 'org-test123'
      }

      const client = new OpenAIClient(configWithOrg)

      expect(client).toBeInstanceOf(OpenAIClient)
      expect(MockedOpenAI).toHaveBeenCalledWith({
        apiKey: configWithOrg.apiKey,
        organization: configWithOrg.organization,
        timeout: configWithOrg.timeout,
        maxRetries: configWithOrg.maxRetries
      })
    })

    test('잘못된 API 키 형식으로 생성 실패', () => {
      const invalidConfig = {
        ...validConfig,
        apiKey: 'invalid-key'
      }

      expect(() => new OpenAIClient(invalidConfig)).toThrow('유효하지 않은 OpenAI API 키 형식입니다')
    })

    test('잘못된 타임아웃으로 생성 실패', () => {
      const invalidConfig = {
        ...validConfig,
        timeout: 500 // 1초 미만
      }

      expect(() => new OpenAIClient(invalidConfig)).toThrow('타임아웃은 1초에서 5분 사이여야 합니다')
    })

    test('잘못된 재시도 횟수로 생성 실패', () => {
      const invalidConfig = {
        ...validConfig,
        maxRetries: -1
      }

      expect(() => new OpenAIClient(invalidConfig)).toThrow('재시도 횟수는 0에서 10 사이여야 합니다')
    })
  })

  describe('초기 상태', () => {
    test('초기 상태는 연결되지 않음', () => {
      const client = new OpenAIClient(validConfig)
      const status = client.getStatus()

      expect(status.connected).toBe(false)
      expect(status.lastCheck).toBeNull()
      expect(status.modelsAvailable).toEqual([])
      expect(status.metadata?.currentModel).toBe(validConfig.models.embedding)
    })

    test('organization이 있는 경우 metadata에 포함', () => {
      const configWithOrg = {
        ...validConfig,
        organization: 'org-test123'
      }

      const client = new OpenAIClient(configWithOrg)
      const status = client.getStatus()

      expect(status.metadata?.organization).toBe('org-test123')
    })

    test('organization이 없는 경우 metadata에서 제외', () => {
      const client = new OpenAIClient(validConfig)
      const status = client.getStatus()

      expect(status.metadata?.organization).toBeUndefined()
    })
  })

  describe('checkConnection', () => {
    test('API 호출 성공 시 connected=true 반환', async () => {
      const mockModels = {
        data: [
          { id: 'gpt-3.5-turbo' },
          { id: 'text-embedding-3-small' },
          { id: 'gpt-4' }
        ]
      };

      (mockOpenAIInstance.models.list as jest.Mock).mockResolvedValueOnce(mockModels as any)

      const client = new OpenAIClient(validConfig)
      const result = await client.checkConnection()

      expect(result).toBe(true)

      const status = client.getStatus()
      expect(status.connected).toBe(true)
      expect(status.lastCheck).toBeInstanceOf(Date)
      expect(status.modelsAvailable).toEqual(['gpt-3.5-turbo', 'text-embedding-3-small', 'gpt-4'])
    })

    test('API 호출 실패 시 connected=false 반환', async () => {
      const error = new Error('API 호출 실패');
      (mockOpenAIInstance.models.list as jest.Mock).mockRejectedValueOnce(error)

      // console.error 모킹하여 에러 로그 숨김
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const client = new OpenAIClient(validConfig)
      const result = await client.checkConnection()

      expect(result).toBe(false)

      const status = client.getStatus()
      expect(status.connected).toBe(false)
      expect(status.lastCheck).toBeInstanceOf(Date)
      expect(status.modelsAvailable).toEqual([])

      consoleSpy.mockRestore()
    })

    test('네트워크 타임아웃 시 적절한 에러 처리', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      (mockOpenAIInstance.models.list as jest.Mock).mockRejectedValueOnce(timeoutError)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const client = new OpenAIClient(validConfig)
      const result = await client.checkConnection()

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('OpenAI API 연결 실패:', timeoutError)

      consoleSpy.mockRestore()
    })
  })

  describe('getStatus', () => {
    test('상태 객체 복사본 반환 (불변성)', () => {
      const client = new OpenAIClient(validConfig)
      const status1 = client.getStatus()
      const status2 = client.getStatus()

      // 다른 객체여야 함 (복사본)
      expect(status1).not.toBe(status2)
      expect(status1).toEqual(status2)
    })

    test('연결 후 상태 업데이트 확인', async () => {
      const mockModels = {
        data: [{ id: 'test-model' }]
      };

      (mockOpenAIInstance.models.list as jest.Mock).mockResolvedValueOnce(mockModels as any)

      const client = new OpenAIClient(validConfig)
      
      // 연결 전 상태
      const statusBefore = client.getStatus()
      expect(statusBefore.connected).toBe(false)
      expect(statusBefore.modelsAvailable).toEqual([])

      // 연결 후 상태
      await client.checkConnection()
      const statusAfter = client.getStatus()
      expect(statusAfter.connected).toBe(true)
      expect(statusAfter.modelsAvailable).toEqual(['test-model'])
    })
  })

  describe('getClient', () => {
    test('OpenAI 클라이언트 인스턴스 반환', () => {
      const client = new OpenAIClient(validConfig)
      const openaiInstance = client.getClient()

      expect(openaiInstance).toBe(mockOpenAIInstance)
    })
  })

  describe('getConfig', () => {
    test('설정 객체 복사본 반환 (불변성)', () => {
      const client = new OpenAIClient(validConfig)
      const config1 = client.getConfig()
      const config2 = client.getConfig()

      // 다른 객체여야 함 (복사본)
      expect(config1).not.toBe(config2)
      expect(config1).toEqual(config2)
      expect(config1).toEqual(validConfig)
    })

    test('설정 수정이 원본에 영향을 주지 않음', () => {
      const client = new OpenAIClient(validConfig)
      const config = client.getConfig()

      // 복사본 수정
      config.timeout = 999999

      // 원본은 변경되지 않음
      const originalConfig = client.getConfig()
      expect(originalConfig.timeout).toBe(validConfig.timeout)
    })
  })

  describe('initialize', () => {
    test('초기화 성공 시 로그 출력', async () => {
      const mockModels = { data: [{ id: 'test-model' }] };
      (mockOpenAIInstance.models.list as jest.Mock).mockResolvedValueOnce(mockModels as any)

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      const client = new OpenAIClient(validConfig)
      await client.initialize()

      expect(consoleSpy).toHaveBeenCalledWith('OpenAI 클라이언트 초기화 중...')
      expect(consoleSpy).toHaveBeenCalledWith('OpenAI 클라이언트 초기화 완료')

      consoleSpy.mockRestore()
    })

    test('초기화 실패 시 에러 발생', async () => {
      const error = new Error('연결 실패');
      (mockOpenAIInstance.models.list as jest.Mock).mockRejectedValueOnce(error)

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const client = new OpenAIClient(validConfig)
      
      await expect(client.initialize()).rejects.toThrow('OpenAI API 연결에 실패했습니다')

      consoleSpy.mockRestore()
    })
  })

  describe('에러 시나리오', () => {
    test('빈 API 키로 생성 시도', () => {
      const invalidConfig = {
        ...validConfig,
        apiKey: ''
      }

      expect(() => new OpenAIClient(invalidConfig)).toThrow('유효하지 않은 OpenAI API 키 형식입니다')
    })

    test('극단적으로 큰 타임아웃 값', () => {
      const invalidConfig = {
        ...validConfig,
        timeout: 999999999
      }

      expect(() => new OpenAIClient(invalidConfig)).toThrow('타임아웃은 1초에서 5분 사이여야 합니다')
    })

    test('극단적으로 큰 재시도 횟수', () => {
      const invalidConfig = {
        ...validConfig,
        maxRetries: 999
      }

      expect(() => new OpenAIClient(invalidConfig)).toThrow('재시도 횟수는 0에서 10 사이여야 합니다')
    })
  })
})