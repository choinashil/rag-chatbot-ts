// EmbeddingService 단위 테스트
import { EmbeddingService } from '../../../../src/services/openai/embedding.service'
import { OpenAIClient } from '../../../../src/services/openai/openai.client'
import type { EmbeddingInput, EmbeddingServiceConfig } from '../../../../src/types/embedding'

// OpenAI 모듈 모킹
jest.mock('openai')

describe('EmbeddingService', () => {
  let mockOpenAIClient: jest.Mocked<OpenAIClient>
  let mockOpenAIInstance: any
  let embeddingService: EmbeddingService

  beforeEach(() => {
    // OpenAI API 응답 모킹
    mockOpenAIInstance = {
      embeddings: {
        create: jest.fn()
      }
    }

    // OpenAIClient 모킹
    mockOpenAIClient = {
      getClient: jest.fn().mockReturnValue(mockOpenAIInstance),
      checkConnection: jest.fn(),
      getStatus: jest.fn(),
      getConfig: jest.fn(),
      initialize: jest.fn()
    } as any

    // 테스트용 빠른 설정 (재시도 최소화)
    embeddingService = new EmbeddingService(mockOpenAIClient, {
      maxRetries: 1, // 재시도 1회로 줄임
      retryDelay: 100 // 100ms로 단축
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('생성자', () => {
    test('기본 설정으로 서비스 생성', () => {
      const service = new EmbeddingService(mockOpenAIClient)
      expect(service).toBeInstanceOf(EmbeddingService)
    })

    test('커스텀 설정으로 서비스 생성', () => {
      const config: Partial<EmbeddingServiceConfig> = {
        model: 'custom-model',
        maxTokensPerRequest: 1000,
        enableCache: false
      }

      const service = new EmbeddingService(mockOpenAIClient, config)
      expect(service).toBeInstanceOf(EmbeddingService)
    })
  })

  describe('createEmbedding', () => {
    test('단일 텍스트 임베딩 생성 성공', async () => {
      const mockResponse = {
        data: [{
          embedding: [0.1, 0.2, 0.3, 0.4, 0.5]
        }],
        model: 'text-embedding-3-small',
        usage: {
          total_tokens: 10
        }
      }

      mockOpenAIInstance.embeddings.create.mockResolvedValueOnce(mockResponse)

      const input: EmbeddingInput = {
        text: '테스트 텍스트입니다.',
        id: 'test-1'
      }

      const result = await embeddingService.createEmbedding(input)

      expect(result.embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5])
      expect(result.tokenCount).toBe(10)
      expect(result.model).toBe('text-embedding-3-small')
      expect(result.id).toBe('test-1')
      expect(result.text).toBe('테스트 텍스트입니다.')

      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: '테스트 텍스트입니다.',
        encoding_format: 'float'
      })
    })

    test('캐시된 임베딩 반환', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        model: 'text-embedding-3-small',
        usage: { total_tokens: 5 }
      }

      mockOpenAIInstance.embeddings.create.mockResolvedValueOnce(mockResponse)

      const input: EmbeddingInput = { text: '캐시 테스트' }

      // 첫 번째 호출 - API 호출
      const result1 = await embeddingService.createEmbedding(input)
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledTimes(1)

      // 두 번째 호출 - 캐시에서 반환
      const result2 = await embeddingService.createEmbedding(input)
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledTimes(1) // API 호출 안됨
      expect(result2).toEqual(result1)
    })

    test('토큰 제한 초과 시 에러 발생', async () => {
      // tiktoken에서 실제로 8191 토큰을 초과하는 텍스트 생성 (충분히 크게)
      const longText = 'This is a very long sentence that will be repeated many times to exceed the token limit. '.repeat(500)
      const input: EmbeddingInput = { text: longText }

      await expect(embeddingService.createEmbedding(input)).rejects.toThrow('토큰 제한')
    })

    test('API 호출 실패 시 에러 처리', async () => {
      const error = new Error('API 호출 실패')
      mockOpenAIInstance.embeddings.create.mockRejectedValueOnce(error)

      const input: EmbeddingInput = { text: '실패 테스트' }

      await expect(embeddingService.createEmbedding(input)).rejects.toThrow('임베딩 생성에 실패했습니다')
    })

    test('재시도 로직 동작', async () => {
      const retryableError = new Error('rate limit exceeded')
      const successResponse = {
        data: [{ embedding: [0.1, 0.2] }],
        model: 'test-model',
        usage: { total_tokens: 3 }
      }

      // 첫 번째 호출은 실패, 두 번째는 성공
      mockOpenAIInstance.embeddings.create
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce(successResponse)

      const input: EmbeddingInput = { text: '재시도 테스트' }

      const result = await embeddingService.createEmbedding(input)

      expect(result.embedding).toEqual([0.1, 0.2])
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledTimes(2)
    })
  })

  describe('createBatchEmbeddings', () => {
    test('여러 텍스트 배치 처리 성공', async () => {
      const mockResponse1 = {
        data: [{ embedding: [0.1, 0.2] }],
        model: 'test-model',
        usage: { total_tokens: 5 }
      }
      const mockResponse2 = {
        data: [{ embedding: [0.3, 0.4] }],
        model: 'test-model',
        usage: { total_tokens: 7 }
      }

      mockOpenAIInstance.embeddings.create
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2)

      const inputs: EmbeddingInput[] = [
        { text: '첫 번째 텍스트', id: 'batch-1' },
        { text: '두 번째 텍스트', id: 'batch-2' }
      ]

      const result = await embeddingService.createBatchEmbeddings({ texts: inputs })

      expect(result.results).toHaveLength(2)
      expect(result.totalTokens).toBe(12) // 5 + 7
      expect(result.requestCount).toBe(1)
      expect(result.errors).toHaveLength(0)

      expect(result.results[0]!.embedding).toEqual([0.1, 0.2])
      expect(result.results[1]!.embedding).toEqual([0.3, 0.4])
    })

    test('배치 처리 중 일부 실패', async () => {
      const successResponse = {
        data: [{ embedding: [0.1, 0.2] }],
        model: 'test-model',
        usage: { total_tokens: 5 }
      }
      const error = new Error('API 오류')

      mockOpenAIInstance.embeddings.create
        .mockResolvedValueOnce(successResponse)
        .mockRejectedValueOnce(error)

      const inputs: EmbeddingInput[] = [
        { text: '성공 텍스트', id: 'success' },
        { text: '실패 텍스트', id: 'fail' }
      ]

      const result = await embeddingService.createBatchEmbeddings({ texts: inputs })

      expect(result.results).toHaveLength(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.id).toBe('fail')
      expect(result.errors[0]!.code).toBe('EMBEDDING_FAILED')
    })

    test('빈 배열 입력 처리', async () => {
      const result = await embeddingService.createBatchEmbeddings({ texts: [] })

      expect(result.results).toHaveLength(0)
      expect(result.totalTokens).toBe(0)
      expect(result.requestCount).toBe(0)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('createEmbeddingForLongText', () => {
    test('긴 텍스트 청크 분할 처리', async () => {
      // 각 청크에 대한 모의 응답
      const mockResponse1 = {
        data: [{ embedding: [0.1, 0.2] }],
        model: 'test-model',
        usage: { total_tokens: 100 }
      }
      const mockResponse2 = {
        data: [{ embedding: [0.3, 0.4] }],
        model: 'test-model',
        usage: { total_tokens: 80 }
      }

      mockOpenAIInstance.embeddings.create
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2)

      // 긴 텍스트 생성 (여러 문장으로 구성)
      const longText = Array(100).fill('이것은 긴 텍스트의 한 문장입니다.').join(' ')

      const results = await embeddingService.createEmbeddingForLongText(longText, 'long-text')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.id).toMatch(/long-text_chunk_\d+/)
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledTimes(results.length)
    })
  })

  describe('사용량 추적', () => {
    test('사용량 정보 추적', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2] }],
        model: 'test-model',
        usage: { total_tokens: 15 }
      }

      mockOpenAIInstance.embeddings.create.mockResolvedValue(mockResponse)

      const input: EmbeddingInput = { text: '사용량 테스트' }

      // 여러 번 호출
      await embeddingService.createEmbedding(input)
      await embeddingService.createEmbedding({ text: '두 번째 테스트' })

      const usage = embeddingService.getUsage()

      expect(usage.totalTokens).toBe(30) // 15 + 15
      expect(usage.requestCount).toBe(2)
      expect(usage.estimatedCost).toBeGreaterThan(0)
      expect(usage.timestamp).toBeInstanceOf(Date)
    })
  })

  describe('캐시 관리', () => {
    test('캐시 통계 조회', () => {
      const stats = embeddingService.getCacheStats()

      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('maxSize')
      expect(stats).toHaveProperty('hitRate')
    })

    test('캐시 초기화', async () => {
      // 먼저 캐시에 데이터 추가
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2] }],
        model: 'test-model',
        usage: { total_tokens: 5 }
      }

      mockOpenAIInstance.embeddings.create.mockResolvedValue(mockResponse)

      await embeddingService.createEmbedding({ text: '캐시 테스트' })

      // 캐시 초기화
      embeddingService.clearCache()

      const stats = embeddingService.getCacheStats()
      expect(stats.size).toBe(0)
    })
  })

  describe('에러 상황 처리', () => {
    test('재시도 불가능한 에러는 즉시 실패', async () => {
      const nonRetryableError = new Error('invalid api key')
      mockOpenAIInstance.embeddings.create.mockRejectedValue(nonRetryableError)

      const input: EmbeddingInput = { text: '즉시 실패 테스트' }

      await expect(embeddingService.createEmbedding(input)).rejects.toThrow('임베딩 생성에 실패했습니다')
      
      // 재시도하지 않고 1번만 호출되어야 함
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledTimes(1)
    })

    test('최대 재시도 횟수 초과 시 실패', async () => {
      const retryableError = new Error('rate limit exceeded')
      mockOpenAIInstance.embeddings.create.mockRejectedValue(retryableError)

      const input: EmbeddingInput = { text: '최대 재시도 테스트' }

      await expect(embeddingService.createEmbedding(input)).rejects.toThrow('rate limit exceeded')
      
      // 수정된 설정 (1번 재시도) + 1번 = 총 2번 호출
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledTimes(2)
    }, 3000) // 3초로 단축
  })

  describe('설정별 동작', () => {
    test('캐시 비활성화 시 캐시 사용 안함', async () => {
      const serviceWithoutCache = new EmbeddingService(mockOpenAIClient, { enableCache: false })
      
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2] }],
        model: 'test-model',
        usage: { total_tokens: 5 }
      }

      mockOpenAIInstance.embeddings.create.mockResolvedValue(mockResponse)

      const input: EmbeddingInput = { text: '캐시 비활성화 테스트' }

      // 같은 입력으로 두 번 호출
      await serviceWithoutCache.createEmbedding(input)
      await serviceWithoutCache.createEmbedding(input)

      // 캐시를 사용하지 않으므로 두 번 모두 API 호출
      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledTimes(2)
    })

    test('커스텀 모델 사용', async () => {
      const serviceWithCustomModel = new EmbeddingService(mockOpenAIClient, { 
        model: 'text-embedding-3-large' 
      })

      const mockResponse = {
        data: [{ embedding: Array(3072).fill(0.1) }], // 3072 차원
        model: 'text-embedding-3-large',
        usage: { total_tokens: 10 }
      }

      mockOpenAIInstance.embeddings.create.mockResolvedValue(mockResponse)

      const input: EmbeddingInput = { text: '커스텀 모델 테스트' }
      await serviceWithCustomModel.createEmbedding(input)

      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-large',
        input: '커스텀 모델 테스트',
        encoding_format: 'float'
      })
    })
  })
})