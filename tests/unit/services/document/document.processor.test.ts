import { DocumentProcessor } from '../../../../src/services/document/document.processor'
import { NotionService } from '../../../../src/services/notion/notion.service'
import { EmbeddingService } from '../../../../src/services/openai/embedding.service'
import { PineconeService } from '../../../../src/services/vector/pinecone.service'
import type { NotionPage } from '../../../../src/types/notion'
import type { EmbeddingResult } from '../../../../src/types/embedding'
import type { SearchResult } from '../../../../src/types/pinecone'
import type { CrawledDocument } from '../../../../src/types/html'
import type { BatchResult } from '../../../../src/types/shared'

jest.mock('../../../../src/services/notion/notion.service')
jest.mock('../../../../src/services/openai/embedding.service')
jest.mock('../../../../src/services/vector/pinecone.service')

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
        '테스트 문서\n\n이것은 테스트 문서입니다.',
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

  describe('HTML 문서 벡터화', () => {
    describe('processHtmlDocument', () => {
      test('HTML 문서가 성공적으로 벡터화됨', async () => {
        // Given
        const mockCrawledDoc: CrawledDocument = {
          id: 'html-doc-1',
          url: 'https://example.com/test-page',
          title: '테스트 페이지',
          content: '테스트 페이지의 내용입니다. 이것은 HTML에서 추출된 텍스트입니다.',
          wordCount: 15,
          breadcrumb: ['홈', '테스트'],
          timestamp: '2025-08-10T13:00:00.000Z',
          depth: 1,
          discoveredAt: '2025-08-10T12:00:00.000Z',
          links: [],
          crawlMetadata: {
            crawlId: 'crawl-123',
            sessionId: 'session-123',
            discoveryMethod: 'link',
            processingTime: 1000,
            errorCount: 0
          }
        }

        const mockEmbedding: EmbeddingResult = {
          embedding: new Array(1536).fill(0.1),
          tokenCount: 20,
          model: 'text-embedding-3-small',
          text: '테스트 페이지\n\n테스트 페이지의 내용입니다. 이것은 HTML에서 추출된 텍스트입니다.'
        }

        mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbedding)
        mockPineconeService.upsert.mockResolvedValue(undefined)

        // When
        await documentProcessor.processHtmlDocument(mockCrawledDoc)

        // Then
        expect(mockEmbeddingService.createEmbedding).toHaveBeenCalledWith(
          '테스트 페이지\n\n테스트 페이지의 내용입니다. 이것은 HTML에서 추출된 텍스트입니다.',
          expect.stringMatching(/^html-[a-f0-9]{16}$/)
        )

        expect(mockPineconeService.upsert).toHaveBeenCalledWith({
          id: expect.stringMatching(/^html-[a-f0-9]{16}$/),
          vector: mockEmbedding.embedding,
          metadata: {
            title: '테스트 페이지',
            content: '테스트 페이지의 내용입니다. 이것은 HTML에서 추출된 텍스트입니다.',
            source: 'html',
            url: 'https://example.com/test-page',
            breadcrumb: '홈 > 테스트',
            timestamp: expect.any(String)
          }
        })
      })

      test('임베딩 생성 실패 시 에러가 발생함', async () => {
        // Given
        const mockCrawledDoc: CrawledDocument = {
          id: 'html-doc-1',
          url: 'https://example.com/test-page',
          title: '테스트 페이지',
          content: '테스트 내용',
          wordCount: 2,
          breadcrumb: ['홈'],
          timestamp: '2025-08-10T13:00:00.000Z',
          depth: 1,
          discoveredAt: '2025-08-10T12:00:00.000Z',
          links: [],
          crawlMetadata: {
            crawlId: 'crawl-123',
            sessionId: 'session-123',
            discoveryMethod: 'initial',
            processingTime: 500,
            errorCount: 0
          }
        }

        mockEmbeddingService.createEmbedding.mockRejectedValue(new Error('임베딩 생성 실패'))

        // When & Then
        await expect(documentProcessor.processHtmlDocument(mockCrawledDoc))
          .rejects.toThrow('HTML 문서 처리에 실패했습니다: 임베딩 생성 실패')

        expect(mockPineconeService.upsert).not.toHaveBeenCalled()
      })

      test('Pinecone 저장 실패 시 에러가 발생함', async () => {
        // Given
        const mockCrawledDoc: CrawledDocument = {
          id: 'html-doc-1',
          url: 'https://example.com/test-page',
          title: '테스트 페이지',
          content: '테스트 내용',
          wordCount: 2,
          breadcrumb: ['홈'],
          timestamp: '2025-08-10T13:00:00.000Z',
          depth: 1,
          discoveredAt: '2025-08-10T12:00:00.000Z',
          links: [],
          crawlMetadata: {
            crawlId: 'crawl-123',
            sessionId: 'session-123',
            discoveryMethod: 'initial',
            processingTime: 500,
            errorCount: 0
          }
        }

        const mockEmbedding: EmbeddingResult = {
          embedding: new Array(1536).fill(0.1),
          tokenCount: 5,
          model: 'text-embedding-3-small',
          text: '테스트 페이지\n\n테스트 내용'
        }

        mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbedding)
        mockPineconeService.upsert.mockRejectedValue(new Error('벡터 저장 실패'))

        // When & Then
        await expect(documentProcessor.processHtmlDocument(mockCrawledDoc))
          .rejects.toThrow('HTML 문서 처리에 실패했습니다: 벡터 저장 실패')
      })
    })

    describe('processHtmlDocuments', () => {
      test('여러 HTML 문서가 순차적으로 벡터화됨', async () => {
        // Given
        const mockDocuments: CrawledDocument[] = [
          {
            id: 'html-doc-1',
            url: 'https://example.com/page-1',
            title: '페이지 1',
            content: '첫 번째 페이지 내용',
            wordCount: 4,
            breadcrumb: ['홈'],
            timestamp: '2025-08-10T13:00:00.000Z',
            depth: 1,
            discoveredAt: '2025-08-10T12:00:00.000Z',
            links: [],
            crawlMetadata: {
              crawlId: 'crawl-123',
              sessionId: 'session-123',
              discoveryMethod: 'initial',
              processingTime: 500,
              errorCount: 0
            }
          },
          {
            id: 'html-doc-2',
            url: 'https://example.com/page-2',
            title: '페이지 2',
            content: '두 번째 페이지 내용',
            wordCount: 4,
            breadcrumb: ['홈'],
            timestamp: '2025-08-10T13:01:00.000Z',
            depth: 1,
            discoveredAt: '2025-08-10T12:01:00.000Z',
            links: [],
            crawlMetadata: {
              crawlId: 'crawl-123',
              sessionId: 'session-123',
              discoveryMethod: 'link',
              processingTime: 600,
              errorCount: 0
            }
          }
        ]

        const mockEmbedding: EmbeddingResult = {
          embedding: new Array(1536).fill(0.1),
          tokenCount: 10,
          model: 'text-embedding-3-small',
          text: 'mock embedding text'
        }

        mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbedding)
        mockPineconeService.upsert.mockResolvedValue(undefined)

        // When
        const result: BatchResult = await documentProcessor.processHtmlDocuments(mockDocuments)

        // Then
        expect(result).toEqual({
          total: 2,
          processed: 2,
          failed: 0,
          errors: []
        })

        expect(mockEmbeddingService.createEmbedding).toHaveBeenCalledTimes(2)
        expect(mockPineconeService.upsert).toHaveBeenCalledTimes(2)
      })

      test('일부 문서 처리 실패 시 에러가 기록됨', async () => {
        // Given
        const mockDocuments: CrawledDocument[] = [
          {
            id: 'html-doc-1',
            url: 'https://example.com/success-page',
            title: '성공 페이지',
            content: '성공적으로 처리될 내용',
            wordCount: 4,
            breadcrumb: ['홈'],
            timestamp: '2025-08-10T13:00:00.000Z',
            depth: 1,
            discoveredAt: '2025-08-10T12:00:00.000Z',
            links: [],
            crawlMetadata: {
              crawlId: 'crawl-123',
              sessionId: 'session-123',
              discoveryMethod: 'initial',
              processingTime: 500,
              errorCount: 0
            }
          },
          {
            id: 'html-doc-2',
            url: 'https://example.com/fail-page',
            title: '실패 페이지',
            content: '실패할 내용',
            wordCount: 3,
            breadcrumb: ['홈'],
            timestamp: '2025-08-10T13:01:00.000Z',
            depth: 1,
            discoveredAt: '2025-08-10T12:01:00.000Z',
            links: [],
            crawlMetadata: {
              crawlId: 'crawl-123',
              sessionId: 'session-123',
              discoveryMethod: 'link',
              processingTime: 600,
              errorCount: 0
            }
          }
        ]

        const mockEmbedding: EmbeddingResult = {
          embedding: new Array(1536).fill(0.1),
          tokenCount: 10,
          model: 'text-embedding-3-small',
          text: 'mock embedding text'
        }

        // 첫 번째 호출은 성공, 두 번째 호출은 실패
        mockEmbeddingService.createEmbedding
          .mockResolvedValueOnce(mockEmbedding)
          .mockRejectedValueOnce(new Error('임베딩 실패'))

        mockPineconeService.upsert.mockResolvedValue(undefined)

        // When
        const result: BatchResult = await documentProcessor.processHtmlDocuments(mockDocuments)

        // Then
        expect(result).toEqual({
          total: 2,
          processed: 1,
          failed: 1,
          errors: [{
            url: 'https://example.com/fail-page',
            title: '실패 페이지',
            error: 'HTML 문서 처리에 실패했습니다: 임베딩 실패'
          }]
        })

        expect(mockEmbeddingService.createEmbedding).toHaveBeenCalledTimes(2)
        expect(mockPineconeService.upsert).toHaveBeenCalledTimes(1) // 성공한 것만 저장
      })

      test('빈 문서 배열 처리', async () => {
        // Given
        const mockDocuments: CrawledDocument[] = []

        // When
        const result: BatchResult = await documentProcessor.processHtmlDocuments(mockDocuments)

        // Then
        expect(result).toEqual({
          total: 0,
          processed: 0,
          failed: 0,
          errors: []
        })

        expect(mockEmbeddingService.createEmbedding).not.toHaveBeenCalled()
        expect(mockPineconeService.upsert).not.toHaveBeenCalled()
      })
    })
  })
})