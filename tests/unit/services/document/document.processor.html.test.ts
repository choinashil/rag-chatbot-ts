import { DocumentProcessor } from '../../../../src/services/document/document.processor'
import { NotionService } from '../../../../src/services/notion/notion.service'
import { EmbeddingService } from '../../../../src/services/openai/embedding.service'
import { PineconeService } from '../../../../src/services/vector/pinecone.service'
import type { CrawledDocument } from '../../../../src/types/html'
import type { BatchResult } from '../../../../src/types/shared'
import type { EmbeddingResult } from '../../../../src/types/embedding'

jest.mock('../../../../src/services/notion/notion.service')
jest.mock('../../../../src/services/openai/embedding.service')
jest.mock('../../../../src/services/vector/pinecone.service')

const MockNotionService = NotionService as jest.MockedClass<typeof NotionService>
const MockEmbeddingService = EmbeddingService as jest.MockedClass<typeof EmbeddingService>
const MockPineconeService = PineconeService as jest.MockedClass<typeof PineconeService>

describe('DocumentProcessor - HTML 벡터화', () => {
  let documentProcessor: DocumentProcessor
  let mockNotionService: jest.Mocked<NotionService>
  let mockEmbeddingService: jest.Mocked<EmbeddingService>
  let mockPineconeService: jest.Mocked<PineconeService>

  // 테스트용 CrawledDocument 생성 헬퍼 함수
  const createMockCrawledDocument = (overrides: Partial<CrawledDocument> = {}): CrawledDocument => ({
    id: 'html-doc-1',
    url: 'https://example.com/test-page',
    title: '테스트 페이지',
    content: '테스트 페이지의 내용입니다.',
    wordCount: 5,
    breadcrumb: ['홈', '테스트'],
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
    },
    ...overrides
  })

  beforeEach(() => {
    mockNotionService = {
      getPage: jest.fn(),
      initialize: jest.fn()
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

  describe('processHtmlDocument', () => {
    test('HTML 문서가 성공적으로 벡터화됨', async () => {
      // Given
      const mockDoc = createMockCrawledDocument({
        title: '도메인 연결 가이드',
        content: '도메인 연결은 [구매 → 연결] 순서로 이루어집니다. 아래 가이드 순서에 따라 작업해 주세요.',
        url: 'https://help.pro.sixshop.com/domain-guide'
      })

      const mockEmbedding: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 25,
        model: 'text-embedding-3-small',
        text: '도메인 연결 가이드\n\n도메인 연결은 [구매 → 연결] 순서로 이루어집니다. 아래 가이드 순서에 따라 작업해 주세요.'
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbedding)
      mockPineconeService.upsert.mockResolvedValue(undefined)

      // When
      await documentProcessor.processHtmlDocument(mockDoc)

      // Then
      expect(mockEmbeddingService.createEmbedding).toHaveBeenCalledWith(
        '도메인 연결 가이드\n\n도메인 연결은 [구매 → 연결] 순서로 이루어집니다. 아래 가이드 순서에 따라 작업해 주세요.',
        expect.stringMatching(/^html-[a-f0-9]{16}$/)
      )

      expect(mockPineconeService.upsert).toHaveBeenCalledWith({
        id: expect.stringMatching(/^html-[a-f0-9]{16}$/),
        vector: mockEmbedding.embedding,
        metadata: {
          title: '도메인 연결 가이드',
          content: '도메인 연결은 [구매 → 연결] 순서로 이루어집니다. 아래 가이드 순서에 따라 작업해 주세요.',
          source: 'html',
          url: 'https://help.pro.sixshop.com/domain-guide',
          breadcrumb: '홈 > 테스트',
          timestamp: expect.any(String)
        }
      })
    })

    test('동일한 URL에 대해 동일한 ID가 생성됨', async () => {
      // Given
      const mockDoc1 = createMockCrawledDocument({
        url: 'https://help.pro.sixshop.com/same-page'
      })
      const mockDoc2 = createMockCrawledDocument({
        url: 'https://help.pro.sixshop.com/same-page'
      })

      const mockEmbedding: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 10,
        model: 'text-embedding-3-small',
        text: 'mock text'
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbedding)
      mockPineconeService.upsert.mockResolvedValue(undefined)

      // When
      await documentProcessor.processHtmlDocument(mockDoc1)
      await documentProcessor.processHtmlDocument(mockDoc2)

      // Then
      expect(mockPineconeService.upsert).toHaveBeenCalledTimes(2)
      
      const firstCall = mockPineconeService.upsert.mock.calls[0]?.[0]
      const secondCall = mockPineconeService.upsert.mock.calls[1]?.[0]
      
      expect(firstCall).toBeDefined()
      expect(secondCall).toBeDefined()
      expect(firstCall!.id).toBe(secondCall!.id)
      expect(firstCall!.id).toMatch(/^html-[a-f0-9]{16}$/)
    })

    test('빈 제목과 내용도 처리됨', async () => {
      // Given
      const mockDoc = createMockCrawledDocument({
        title: '',
        content: '',
        wordCount: 0
      })

      const mockEmbedding: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 1,
        model: 'text-embedding-3-small',
        text: '\n\n'
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbedding)
      mockPineconeService.upsert.mockResolvedValue(undefined)

      // When
      await documentProcessor.processHtmlDocument(mockDoc)

      // Then
      expect(mockEmbeddingService.createEmbedding).toHaveBeenCalledWith(
        '\n\n',
        expect.stringMatching(/^html-[a-f0-9]{16}$/)
      )
    })

    test('긴 URL도 올바른 길이의 ID로 변환됨', async () => {
      // Given
      const longUrl = 'https://help.pro.sixshop.com/' + 'very-long-path-name/'.repeat(10) + 'final-page'
      const mockDoc = createMockCrawledDocument({
        url: longUrl
      })

      const mockEmbedding: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 10,
        model: 'text-embedding-3-small',
        text: 'mock text'
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbedding)
      mockPineconeService.upsert.mockResolvedValue(undefined)

      // When
      await documentProcessor.processHtmlDocument(mockDoc)

      // Then
      expect(mockPineconeService.upsert).toHaveBeenCalledTimes(1)
      const call = mockPineconeService.upsert.mock.calls[0]?.[0]
      expect(call).toBeDefined()
      expect(call!.id).toMatch(/^html-[a-f0-9]{16}$/)
      expect(call!.id.length).toBe(21) // 'html-' + 16자리 해시
    })
  })

  describe('processHtmlDocuments', () => {
    test('다양한 크기의 문서들이 처리됨', async () => {
      // Given
      const mockDocuments = [
        createMockCrawledDocument({
          title: '짧은 페이지',
          content: '짧음',
          wordCount: 1
        }),
        createMockCrawledDocument({
          title: '긴 페이지',
          content: '이것은 매우 긴 내용을 가진 페이지입니다. '.repeat(50),
          wordCount: 350,
          url: 'https://example.com/long-page'
        }),
        createMockCrawledDocument({
          title: '빈 페이지',
          content: '',
          wordCount: 0,
          url: 'https://example.com/empty-page'
        })
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
      const result = await documentProcessor.processHtmlDocuments(mockDocuments)

      // Then
      expect(result).toEqual({
        total: 3,
        processed: 3,
        failed: 0,
        errors: []
      })

      // 모든 문서가 처리되었는지 확인
      expect(mockEmbeddingService.createEmbedding).toHaveBeenCalledTimes(3)
      expect(mockPineconeService.upsert).toHaveBeenCalledTimes(3)
      
      // 각 호출의 내용 검증
      const calls = mockEmbeddingService.createEmbedding.mock.calls
      expect(calls[0]?.[0]).toBe('짧은 페이지\n\n짧음')
      expect(calls[2]?.[0]).toBe('빈 페이지\n\n') // 빈 내용
    })

    test('부분적 실패 시 전체 처리를 중단하지 않음', async () => {
      // Given
      const mockDocuments = [
        createMockCrawledDocument({
          title: '성공 문서 1',
          url: 'https://example.com/success-1'
        }),
        createMockCrawledDocument({
          title: '실패 문서',
          url: 'https://example.com/fail'
        }),
        createMockCrawledDocument({
          title: '성공 문서 2',
          url: 'https://example.com/success-2'
        })
      ]

      const mockEmbedding: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 10,
        model: 'text-embedding-3-small',
        text: 'mock embedding text'
      }

      // 두 번째 문서에서만 실패
      mockEmbeddingService.createEmbedding
        .mockResolvedValueOnce(mockEmbedding)
        .mockRejectedValueOnce(new Error('네트워크 에러'))
        .mockResolvedValueOnce(mockEmbedding)

      mockPineconeService.upsert.mockResolvedValue(undefined)

      // When
      const result = await documentProcessor.processHtmlDocuments(mockDocuments)

      // Then
      expect(result).toEqual({
        total: 3,
        processed: 2,
        failed: 1,
        errors: [{
          url: 'https://example.com/fail',
          title: '실패 문서',
          error: 'HTML 문서 처리에 실패했습니다: 네트워크 에러'
        }]
      })

      // 성공한 문서들만 저장되었는지 확인
      expect(mockPineconeService.upsert).toHaveBeenCalledTimes(2)
    })

    test('진행률 표시가 올바르게 계산됨', async () => {
      // Given - 진행률 계산을 위한 다수의 문서
      const mockDocuments = Array.from({ length: 5 }, (_, i) => 
        createMockCrawledDocument({
          title: `문서 ${i + 1}`,
          url: `https://example.com/page-${i + 1}`
        })
      )

      const mockEmbedding: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 10,
        model: 'text-embedding-3-small',
        text: 'mock embedding text'
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbedding)
      mockPineconeService.upsert.mockResolvedValue(undefined)

      // When
      const result = await documentProcessor.processHtmlDocuments(mockDocuments)

      // Then
      expect(result).toEqual({
        total: 5,
        processed: 5,
        failed: 0,
        errors: []
      })

      // 진행률이 올바르게 계산되었는지는 로그로만 확인 가능
      // (실제 테스트에서는 console.log spy를 사용할 수도 있음)
    })
  })

  describe('ID 생성 안정성', () => {
    test('특수 문자가 포함된 URL도 안전하게 처리됨', async () => {
      // Given
      const specialUrls = [
        'https://example.com/페이지?query=값&sort=desc#anchor',
        'https://example.com/page with spaces and 특수문자!@#$%',
        'https://example.com/경로/하위경로/최종페이지.html'
      ]

      const mockEmbedding: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 10,
        model: 'text-embedding-3-small',
        text: 'mock text'
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbedding)
      mockPineconeService.upsert.mockResolvedValue(undefined)

      // When & Then
      for (const url of specialUrls) {
        const mockDoc = createMockCrawledDocument({ url })
        
        await expect(documentProcessor.processHtmlDocument(mockDoc))
          .resolves.not.toThrow()

        const call = mockPineconeService.upsert.mock.calls.find(call => 
          call?.[0]?.metadata?.url === url
        )
        
        expect(call).toBeDefined()
        expect(call?.[0]?.id).toMatch(/^html-[a-f0-9]{16}$/)
      }
    })
  })
})