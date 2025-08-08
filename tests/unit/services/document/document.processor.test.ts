import { DocumentProcessor } from '../../../../src/services/document/document.processor'
import { NotionService } from '../../../../src/services/notion/notion.service'
import { EmbeddingService } from '../../../../src/services/openai/embedding.service'
import { PineconeService } from '../../../../src/services/pinecone/pinecone.service'
import type { NotionPage } from '../../../../src/types/notion'
import type { EmbeddingResult } from '../../../../src/types/embedding'
import type { SearchResult } from '../../../../src/types/pinecone'

jest.mock('../../../../src/services/notion/notion.service')
jest.mock('../../../../src/services/openai/embedding.service')
jest.mock('../../../../src/services/pinecone/pinecone.service')

const MockNotionService = NotionService as jest.MockedClass<typeof NotionService>
const MockEmbeddingService = EmbeddingService as jest.MockedClass<typeof EmbeddingService>
const MockPineconeService = PineconeService as jest.MockedClass<typeof PineconeService>

describe('DocumentProcessor', () => {
  let documentProcessor: DocumentProcessor
  let mockNotionService: jest.Mocked<NotionService>
  let mockEmbeddingService: jest.Mocked<EmbeddingService>
  let mockPineconeService: jest.Mocked<PineconeService>

  beforeEach(() => {
    mockNotionService = {
      getPage: jest.fn()
    } as any

    mockEmbeddingService = {
      createEmbedding: jest.fn()
    } as any

    mockPineconeService = {
      upsert: jest.fn(),
      query: jest.fn()
    } as any

    MockNotionService.mockImplementation(() => mockNotionService)
    MockEmbeddingService.mockImplementation(() => mockEmbeddingService)
    MockPineconeService.mockImplementation(() => mockPineconeService)

    documentProcessor = new DocumentProcessor(
      mockNotionService,
      mockEmbeddingService,
      mockPineconeService
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('processDocument', () => {
    test('문서 처리 파이프라인이 성공적으로 실행됨', async () => {
      const mockNotionPage: NotionPage = {
        id: 'page-123',
        title: '테스트 문서',
        content: '이것은 테스트 문서입니다.',
        properties: {} as any,
        createdAt: new Date('2025-08-08T09:00:00Z'),
        updatedAt: new Date('2025-08-08T09:00:00Z'),
        url: 'https://notion.so/page-123'
      }

      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 10,
        model: 'text-embedding-3-small',
        text: '이것은 테스트 문서입니다.'
      }

      mockNotionService.getPage.mockResolvedValue(mockNotionPage)
      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.upsert.mockResolvedValue(undefined)

      await documentProcessor.processDocument('page-123')
      expect(mockNotionService.getPage).toHaveBeenCalledWith('page-123')
      expect(mockEmbeddingService.createEmbedding).toHaveBeenCalledWith(
        '이것은 테스트 문서입니다.',
        'notion-page-123'
      )
      expect(mockPineconeService.upsert).toHaveBeenCalledWith({
        id: 'notion-page-123',
        vector: mockEmbeddingResult.embedding,
        metadata: {
          title: '테스트 문서',
          content: '이것은 테스트 문서입니다.',
          source: 'notion',
          timestamp: expect.any(String)
        }
      })
    })

    test('노션 페이지 조회 실패 시 에러가 발생함', async () => {
      mockNotionService.getPage.mockRejectedValue(new Error('페이지를 찾을 수 없습니다'))

      await expect(documentProcessor.processDocument('invalid-page')).rejects.toThrow(
        '문서 처리에 실패했습니다: 페이지를 찾을 수 없습니다'
      )

      expect(mockEmbeddingService.createEmbedding).not.toHaveBeenCalled()
      expect(mockPineconeService.upsert).not.toHaveBeenCalled()
    })

    test('임베딩 생성 실패 시 에러가 발생함', async () => {
      const mockNotionPage: NotionPage = {
        id: 'page-123',
        title: '테스트 문서',
        content: '테스트 내용',
        properties: {} as any,
        createdAt: new Date('2025-08-08T09:00:00Z'),
        updatedAt: new Date('2025-08-08T09:00:00Z'),
        url: 'https://notion.so/page-123'
      }

      mockNotionService.getPage.mockResolvedValue(mockNotionPage)
      mockEmbeddingService.createEmbedding.mockRejectedValue(new Error('임베딩 생성 실패'))

      await expect(documentProcessor.processDocument('page-123')).rejects.toThrow(
        '문서 처리에 실패했습니다: 임베딩 생성 실패'
      )

      expect(mockPineconeService.upsert).not.toHaveBeenCalled()
    })

    test('Pinecone 저장 실패 시 에러가 발생함', async () => {
      const mockNotionPage: NotionPage = {
        id: 'page-123',
        title: '테스트 문서',
        content: '테스트 내용',
        properties: {} as any,
        createdAt: new Date('2025-08-08T09:00:00Z'),
        updatedAt: new Date('2025-08-08T09:00:00Z'),
        url: 'https://notion.so/page-123'
      }

      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 10,
        model: 'text-embedding-3-small',
        text: '테스트 내용'
      }

      mockNotionService.getPage.mockResolvedValue(mockNotionPage)
      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.upsert.mockRejectedValue(new Error('벡터 저장 실패'))

      await expect(documentProcessor.processDocument('page-123')).rejects.toThrow(
        '문서 처리에 실패했습니다: 벡터 저장 실패'
      )
    })
  })

  describe('testPipeline', () => {
    test('파이프라인 테스트가 성공적으로 실행됨', async () => {
      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 5,
        model: 'text-embedding-3-small',
        text: '테스트 질문'
      }

      const mockSearchResults: SearchResult[] = [
        {
          id: 'notion-page-1',
          score: 0.95,
          metadata: {
            title: '관련 문서 1',
            content: '관련 내용 1',
            source: 'notion',
            timestamp: '2025-08-08T09:00:00Z'
          }
        }
      ]

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.query.mockResolvedValue(mockSearchResults)

      const result = await documentProcessor.testPipeline('테스트 질문')

      expect(result).toEqual({
        query: '테스트 질문',
        results: mockSearchResults
      })

      expect(mockEmbeddingService.createEmbedding).toHaveBeenCalledWith('테스트 질문')
      expect(mockPineconeService.query).toHaveBeenCalledWith(
        mockEmbeddingResult.embedding,
        {
          topK: 3,
          scoreThreshold: 0.7
        }
      )
    })

    test('검색 결과가 없어도 정상적으로 처리됨', async () => {
      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 5,
        model: 'text-embedding-3-small',
        text: '관련 없는 질문'
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.query.mockResolvedValue([])

      const result = await documentProcessor.testPipeline('관련 없는 질문')

      expect(result).toEqual({
        query: '관련 없는 질문',
        results: []
      })
    })

    test('임베딩 생성 실패 시 에러가 전파됨', async () => {
      mockEmbeddingService.createEmbedding.mockRejectedValue(new Error('임베딩 실패'))

      await expect(documentProcessor.testPipeline('테스트 질문')).rejects.toThrow('임베딩 실패')

      expect(mockPineconeService.query).not.toHaveBeenCalled()
    })

    test('검색 실패 시 에러가 전파됨', async () => {
      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 5,
        model: 'text-embedding-3-small',
        text: '테스트 질문'
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.query.mockRejectedValue(new Error('검색 실패'))

      await expect(documentProcessor.testPipeline('테스트 질문')).rejects.toThrow('검색 실패')
    })
  })
})