import { EmbeddingService } from '../../../../src/services/embedding/embedding.service'
import { OpenAIEmbeddings } from '@langchain/openai'

// LangChain OpenAIEmbeddings 모킹
jest.mock('@langchain/openai')
const MockOpenAIEmbeddings = OpenAIEmbeddings as jest.MockedClass<typeof OpenAIEmbeddings>

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService
  let mockEmbeddings: jest.Mocked<OpenAIEmbeddings>
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.OPENAI_API_KEY = 'test-api-key'

    // OpenAIEmbeddings 인스턴스 모킹
    mockEmbeddings = {
      embedDocuments: jest.fn()
    } as any

    MockOpenAIEmbeddings.mockImplementation(() => mockEmbeddings)

    embeddingService = new EmbeddingService()
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createEmbedding', () => {
    test('텍스트 임베딩 생성 성공', async () => {
      // LangChain 방식: embedDocuments는 number[][] 반환
      const mockEmbeddingResult = [[0.1, 0.2, 0.3, 0.4, 0.5]]
      mockEmbeddings.embedDocuments.mockResolvedValueOnce(mockEmbeddingResult)

      const result = await embeddingService.createEmbedding('테스트 텍스트입니다', 'test-1')

      expect(result.embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5])
      expect(result.tokenCount).toBeGreaterThan(0) // 추정값이므로 대략 확인
      expect(result.model).toBe('text-embedding-3-small')
      expect(result.id).toBe('test-1')
      expect(result.text).toBe('테스트 텍스트입니다')

      expect(mockEmbeddings.embedDocuments).toHaveBeenCalledWith(['테스트 텍스트입니다'])
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
      const error = new Error('LangChain API 호출 실패')
      mockEmbeddings.embedDocuments.mockRejectedValueOnce(error)

      await expect(embeddingService.createEmbedding('실패 테스트')).rejects.toThrow('임베딩 생성에 실패했습니다')
    })

    test('빈 임베딩 결과 에러 처리', async () => {
      mockEmbeddings.embedDocuments.mockResolvedValueOnce([])

      await expect(embeddingService.createEmbedding('테스트')).rejects.toThrow('임베딩 생성 결과가 비어있습니다')
    })
  })

  describe('healthCheck', () => {
    test('헬스체크 성공', async () => {
      mockEmbeddings.embedDocuments.mockResolvedValueOnce([[0.1, 0.2, 0.3]])
      const result = await embeddingService.healthCheck()
      expect(result).toBe(true)
    })

    test('헬스체크 실패', async () => {
      mockEmbeddings.embedDocuments.mockRejectedValueOnce(new Error('연결 실패'))
      const result = await embeddingService.healthCheck()
      expect(result).toBe(false)
    })
  })

  describe('환경변수 처리', () => {
    test('OPENAI_API_KEY가 없으면 에러를 던져야 함', () => {
      delete process.env.OPENAI_API_KEY
      
      expect(() => new EmbeddingService()).toThrow('OPENAI_API_KEY 환경변수가 설정되지 않았습니다')
    })
  })
})