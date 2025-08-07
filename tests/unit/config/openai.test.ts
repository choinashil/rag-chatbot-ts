// OpenAI 설정 함수 단위 테스트
import { createOpenAIConfig, validateOpenAIConfig } from '../../../src/config/openai'

describe('OpenAI Config', () => {
  // 각 테스트 전에 환경변수 초기화
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_ORGANIZATION
    delete process.env.OPENAI_TIMEOUT
    delete process.env.OPENAI_MAX_RETRIES
    delete process.env.OPENAI_EMBEDDING_MODEL
    delete process.env.OPENAI_CHAT_MODEL
  })

  describe('createOpenAIConfig', () => {
    test('필수 API 키가 있을 때 기본 설정 생성', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key-12345'

      const config = createOpenAIConfig()

      expect(config.apiKey).toBe('sk-test-key-12345')
      expect(config.timeout).toBe(30000) // 기본값
      expect(config.maxRetries).toBe(3) // 기본값
      expect(config.models.embedding).toBe('text-embedding-3-small') // 기본값
      expect(config.models.chat).toBe('gpt-3.5-turbo') // 기본값
      expect(config.organization).toBeUndefined()
    })

    test('모든 환경변수가 설정된 경우', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key-12345'
      process.env.OPENAI_ORGANIZATION = 'org-test123'
      process.env.OPENAI_TIMEOUT = '45000'
      process.env.OPENAI_MAX_RETRIES = '5'
      process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-large'
      process.env.OPENAI_CHAT_MODEL = 'gpt-4'

      const config = createOpenAIConfig()

      expect(config.apiKey).toBe('sk-test-key-12345')
      expect(config.organization).toBe('org-test123')
      expect(config.timeout).toBe(45000)
      expect(config.maxRetries).toBe(5)
      expect(config.models.embedding).toBe('text-embedding-3-large')
      expect(config.models.chat).toBe('gpt-4')
    })

    test('organization이 빈 문자열인 경우 설정되지 않음', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key-12345'
      process.env.OPENAI_ORGANIZATION = ''

      const config = createOpenAIConfig()

      expect(config.organization).toBeUndefined()
    })

    test('숫자 환경변수가 문자열인 경우 정수로 변환', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key-12345'
      process.env.OPENAI_TIMEOUT = '60000'
      process.env.OPENAI_MAX_RETRIES = '1'

      const config = createOpenAIConfig()

      expect(config.timeout).toBe(60000)
      expect(config.maxRetries).toBe(1)
      expect(typeof config.timeout).toBe('number')
      expect(typeof config.maxRetries).toBe('number')
    })

    test('잘못된 숫자 형식의 환경변수는 기본값 사용', () => {
      process.env.OPENAI_API_KEY = 'sk-test-key-12345'
      process.env.OPENAI_TIMEOUT = 'invalid-number'
      process.env.OPENAI_MAX_RETRIES = 'also-invalid'

      const config = createOpenAIConfig()

      expect(config.timeout).toBe(30000) // 기본값
      expect(config.maxRetries).toBe(3) // 기본값
    })

    test('API 키가 없으면 에러 발생', () => {
      expect(() => createOpenAIConfig()).toThrow('OPENAI_API_KEY 환경변수가 설정되지 않았습니다')
    })

    test('API 키가 빈 문자열이면 에러 발생', () => {
      process.env.OPENAI_API_KEY = ''

      expect(() => createOpenAIConfig()).toThrow('OPENAI_API_KEY 환경변수가 설정되지 않았습니다')
    })
  })

  describe('validateOpenAIConfig', () => {
    const validConfig = {
      apiKey: 'sk-test-key-12345',
      timeout: 30000,
      maxRetries: 3,
      models: {
        embedding: 'text-embedding-3-small',
        chat: 'gpt-3.5-turbo'
      }
    }

    test('유효한 설정은 true 반환', () => {
      expect(validateOpenAIConfig(validConfig)).toBe(true)
    })

    test('organization이 있는 유효한 설정', () => {
      const configWithOrg = {
        ...validConfig,
        organization: 'org-test123'
      }

      expect(validateOpenAIConfig(configWithOrg)).toBe(true)
    })

    describe('API 키 검증', () => {
      test('sk-로 시작하지 않는 API 키는 에러', () => {
        const invalidConfig = {
          ...validConfig,
          apiKey: 'invalid-key-format'
        }

        expect(() => validateOpenAIConfig(invalidConfig)).toThrow('유효하지 않은 OpenAI API 키 형식입니다')
      })

      test('빈 API 키는 에러', () => {
        const invalidConfig = {
          ...validConfig,
          apiKey: ''
        }

        expect(() => validateOpenAIConfig(invalidConfig)).toThrow('유효하지 않은 OpenAI API 키 형식입니다')
      })

      test('null API 키는 에러', () => {
        const invalidConfig = {
          ...validConfig,
          apiKey: null as any
        }

        expect(() => validateOpenAIConfig(invalidConfig)).toThrow('유효하지 않은 OpenAI API 키 형식입니다')
      })
    })

    describe('타임아웃 검증', () => {
      test('1초 미만 타임아웃은 에러', () => {
        const invalidConfig = {
          ...validConfig,
          timeout: 500
        }

        expect(() => validateOpenAIConfig(invalidConfig)).toThrow('타임아웃은 1초에서 5분 사이여야 합니다')
      })

      test('5분 초과 타임아웃은 에러', () => {
        const invalidConfig = {
          ...validConfig,
          timeout: 400000 // 6분 40초
        }

        expect(() => validateOpenAIConfig(invalidConfig)).toThrow('타임아웃은 1초에서 5분 사이여야 합니다')
      })

      test('경계값 테스트 - 1초는 유효', () => {
        const configWithMinTimeout = {
          ...validConfig,
          timeout: 1000
        }

        expect(validateOpenAIConfig(configWithMinTimeout)).toBe(true)
      })

      test('경계값 테스트 - 5분은 유효', () => {
        const configWithMaxTimeout = {
          ...validConfig,
          timeout: 300000
        }

        expect(validateOpenAIConfig(configWithMaxTimeout)).toBe(true)
      })
    })

    describe('재시도 횟수 검증', () => {
      test('음수 재시도 횟수는 에러', () => {
        const invalidConfig = {
          ...validConfig,
          maxRetries: -1
        }

        expect(() => validateOpenAIConfig(invalidConfig)).toThrow('재시도 횟수는 0에서 10 사이여야 합니다')
      })

      test('10회 초과 재시도는 에러', () => {
        const invalidConfig = {
          ...validConfig,
          maxRetries: 15
        }

        expect(() => validateOpenAIConfig(invalidConfig)).toThrow('재시도 횟수는 0에서 10 사이여야 합니다')
      })

      test('경계값 테스트 - 0회는 유효', () => {
        const configWithZeroRetries = {
          ...validConfig,
          maxRetries: 0
        }

        expect(validateOpenAIConfig(configWithZeroRetries)).toBe(true)
      })

      test('경계값 테스트 - 10회는 유효', () => {
        const configWithMaxRetries = {
          ...validConfig,
          maxRetries: 10
        }

        expect(validateOpenAIConfig(configWithMaxRetries)).toBe(true)
      })
    })
  })

  describe('통합 테스트', () => {
    test('실제 환경변수로 설정 생성 후 검증 통과', () => {
      process.env.OPENAI_API_KEY = 'sk-test-comprehensive-key'
      process.env.OPENAI_ORGANIZATION = 'org-comprehensive'
      process.env.OPENAI_TIMEOUT = '25000'
      process.env.OPENAI_MAX_RETRIES = '2'
      process.env.OPENAI_EMBEDDING_MODEL = 'custom-embedding-model'
      process.env.OPENAI_CHAT_MODEL = 'custom-chat-model'

      const config = createOpenAIConfig()
      const isValid = validateOpenAIConfig(config)

      expect(isValid).toBe(true)
      expect(config).toEqual({
        apiKey: 'sk-test-comprehensive-key',
        organization: 'org-comprehensive',
        timeout: 25000,
        maxRetries: 2,
        models: {
          embedding: 'custom-embedding-model',
          chat: 'custom-chat-model'
        }
      })
    })
  })
})