import { EmbeddingService } from '../../../../src/services/openai/embedding.service'
import { OpenAIClient } from '../../../../src/services/openai/openai.client'

jest.mock('openai')

describe('EmbeddingService', () => {
  let mockOpenAIClient: jest.Mocked<OpenAIClient>
  let mockOpenAIInstance: any
  let embeddingService: EmbeddingService

  beforeEach(() => {
    mockOpenAIInstance = {
      embeddings: {
        create: jest.fn()
      }
    }

    mockOpenAIClient = {
      getClient: jest.fn().mockReturnValue(mockOpenAIInstance),
      checkConnection: jest.fn().mockResolvedValue(true),
      getStatus: jest.fn(),
      getConfig: jest.fn(),
      initialize: jest.fn()
    } as any

    embeddingService = new EmbeddingService(mockOpenAIClient)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createEmbedding', () => {
    test('텍스트 임베딩 생성 성공', async () => {
      const mockResponse = {
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
        model: 'text-embedding-3-small',
        usage: { total_tokens: 10 }
      }

      mockOpenAIInstance.embeddings.create.mockResolvedValueOnce(mockResponse)

      const result = await embeddingService.createEmbedding('테스트 텍스트입니다', 'test-1')

      expect(result.embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5])
      expect(result.tokenCount).toBe(10)
      expect(result.model).toBe('text-embedding-3-small')
      expect(result.id).toBe('test-1')
      expect(result.text).toBe('테스트 텍스트입니다')

      expect(mockOpenAIInstance.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: '테스트 텍스트입니다',
        encoding_format: 'float'
      })
    })

    test('빈 텍스트 에러 처리', async () => {
      await expect(embeddingService.createEmbedding('')).rejects.toThrow('빈 텍스트는 임베딩할 수 없습니다')
      await expect(embeddingService.createEmbedding('   ')).rejects.toThrow('빈 텍스트는 임베딩할 수 없습니다')
    })

    test('긴 텍스트 에러 처리', async () => {
      const longText = 'A'.repeat(32001)
      await expect(embeddingService.createEmbedding(longText)).rejects.toThrow('텍스트가 너무 깁니다')
    })

    test('API 호출 실패 에러 처리', async () => {
      const error = new Error('API 호출 실패')
      mockOpenAIInstance.embeddings.create.mockRejectedValueOnce(error)

      await expect(embeddingService.createEmbedding('실패 테스트')).rejects.toThrow('임베딩 생성에 실패했습니다')
    })
  })

  describe('healthCheck', () => {
    test('헬스체크 성공', async () => {
      mockOpenAIClient.checkConnection.mockResolvedValueOnce(true)
      const result = await embeddingService.healthCheck()
      expect(result).toBe(true)
    })

    test('헬스체크 실패', async () => {
      mockOpenAIClient.checkConnection.mockResolvedValueOnce(false)
      const result = await embeddingService.healthCheck()
      expect(result).toBe(false)
    })
  })
})