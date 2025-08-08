import { DocumentProcessor } from '../../../../src/services/document/document.processor'
import type { NotionService } from '../../../../src/services/notion/notion.service'
import type { EmbeddingService } from '../../../../src/services/openai/embedding.service'
import type { PineconeService } from '../../../../src/services/pinecone/pinecone.service'
import type { NotionPage, PageCollectionOptions } from '../../../../src/types/notion'
import type { VectorData } from '../../../../src/types/pinecone'

describe('DocumentProcessor - 페이지 기반 수집', () => {
  let documentProcessor: DocumentProcessor
  let mockNotionService: jest.Mocked<NotionService>
  let mockEmbeddingService: jest.Mocked<EmbeddingService>
  let mockPineconeService: jest.Mocked<PineconeService>

  const mockPage: NotionPage = {
    id: 'test-page-id',
    title: 'Test Page',
    content: 'Test content with some text',
    properties: {},
    createdAt: new Date('2025-01-08T12:00:00Z'),
    updatedAt: new Date('2025-01-08T12:00:00Z'),
    url: 'https://notion.so/test-page-id'
  }

  const mockBlocks = [
    {
      id: 'block-1',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { plain_text: 'Visit our ', href: null },
          { plain_text: 'website', href: 'https://example.com' },
          { plain_text: ' for more info', href: null }
        ]
      }
    },
    {
      id: 'block-2', 
      type: 'heading_1',
      heading_1: {
        rich_text: [
          { plain_text: 'Important ', href: null },
          { plain_text: 'documentation', href: 'https://docs.example.com' }
        ]
      }
    }
  ]

  const mockEmbeddingResult = {
    embedding: new Array(1536).fill(0.1),
    tokenCount: 10,
    model: 'text-embedding-3-small',
    text: 'Test content with some text'
  }

  beforeEach(() => {
    mockNotionService = {
      collectFromPage: jest.fn(),
      getPageBlocks: jest.fn(),
      getPage: jest.fn(),
      getPages: jest.fn(),
      getPagesFromDatabase: jest.fn()
    } as any

    mockEmbeddingService = {
      createEmbedding: jest.fn()
    } as any

    mockPineconeService = {
      upsert: jest.fn()
    } as any

    documentProcessor = new DocumentProcessor(
      mockNotionService,
      mockEmbeddingService,
      mockPineconeService
    )
  })

  describe('processPageRecursively', () => {
    test('페이지 기반 재귀 수집을 수행해야 한다', async () => {
      const rootPageId = 'root-page-id'
      const options: PageCollectionOptions = {
        maxDepth: 2,
        includeDatabase: true,
        excludeEmpty: true
      }

      const mockCollectionResult = {
        pages: [mockPage],
        totalPages: 1,
        skippedPages: 0,
        discoveredDatabases: ['db-1'],
        errors: [],
        maxDepthReached: false
      }

      mockNotionService.collectFromPage.mockResolvedValue(mockCollectionResult)
      mockNotionService.getPageBlocks.mockResolvedValue(mockBlocks)
      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.upsert.mockResolvedValue()

      const result = await documentProcessor.processPageRecursively(rootPageId, options)

      expect(mockNotionService.collectFromPage).toHaveBeenCalledWith(rootPageId, options)
      expect(result.processedPages).toBe(1)
      expect(result.skippedPages).toBe(0)
      expect(result.totalVectors).toBe(1)
      expect(result.discoveredDatabases).toEqual(['db-1'])
    })

    test('페이지 처리 중 오류가 발생해도 다른 페이지는 계속 처리해야 한다', async () => {
      const rootPageId = 'root-page-id'
      const failingPage = { ...mockPage, id: 'failing-page-id', title: 'Failing Page' }
      
      const mockCollectionResult = {
        pages: [mockPage, failingPage],
        totalPages: 2,
        skippedPages: 0,
        discoveredDatabases: [],
        errors: [],
        maxDepthReached: false
      }

      mockNotionService.collectFromPage.mockResolvedValue(mockCollectionResult)
      mockNotionService.getPageBlocks
        .mockResolvedValueOnce(mockBlocks)
        .mockRejectedValueOnce(new Error('Block retrieval failed'))
      
      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.upsert.mockResolvedValue()

      const result = await documentProcessor.processPageRecursively(rootPageId)

      expect(result.processedPages).toBe(1)
      expect(result.skippedPages).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.pageId).toBe('failing-page-id')
      expect(result.errors[0]?.title).toBe('Failing Page')
    })

    test('빈 페이지 컬렉션 결과도 올바르게 처리해야 한다', async () => {
      const rootPageId = 'empty-root-page-id'
      
      const mockCollectionResult = {
        pages: [],
        totalPages: 0,
        skippedPages: 0,
        discoveredDatabases: [],
        errors: [],
        maxDepthReached: false
      }

      mockNotionService.collectFromPage.mockResolvedValue(mockCollectionResult)

      const result = await documentProcessor.processPageRecursively(rootPageId)

      expect(result.processedPages).toBe(0)
      expect(result.skippedPages).toBe(0)
      expect(result.totalVectors).toBe(0)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('processCollectionMethod', () => {
    test('페이지 방식 선택 시 processPageRecursively를 호출해야 한다', async () => {
      const pageId = 'test-page-id'
      const options: PageCollectionOptions = { maxDepth: 3 }

      const mockCollectionResult = {
        pages: [mockPage],
        totalPages: 1,
        skippedPages: 0,
        discoveredDatabases: [],
        errors: [],
        maxDepthReached: false
      }

      mockNotionService.collectFromPage.mockResolvedValue(mockCollectionResult)
      mockNotionService.getPageBlocks.mockResolvedValue(mockBlocks)
      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.upsert.mockResolvedValue()

      const result = await documentProcessor.processCollectionMethod('page', pageId, options)

      expect(mockNotionService.collectFromPage).toHaveBeenCalledWith(pageId, options)
      expect(result.processedPages).toBe(1)
    })

    test('데이터베이스 방식 선택 시 processDatabaseMethod를 호출해야 한다', async () => {
      const databaseId = 'test-database-id'
      
      mockNotionService.getPagesFromDatabase.mockResolvedValue([mockPage])
      mockNotionService.getPage.mockResolvedValue(mockPage)
      mockNotionService.getPageBlocks.mockResolvedValue(mockBlocks)
      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.upsert.mockResolvedValue()

      const result = await documentProcessor.processCollectionMethod('database', databaseId)

      expect(mockNotionService.getPagesFromDatabase).toHaveBeenCalledWith(databaseId)
      expect(mockNotionService.getPage).toHaveBeenCalledWith(mockPage.id)
      expect(result.processedPages).toBe(1)
      expect(result.discoveredDatabases).toEqual([databaseId])
    })
  })

  describe('processPageWithMetadata - 링크 추출 및 메타데이터', () => {
    test('페이지 블록에서 링크를 추출하여 메타데이터에 포함해야 한다', async () => {
      const collectionMethod = 'page'
      const depthLevel = 2
      const parentPageId = 'parent-page-id'

      mockNotionService.getPageBlocks.mockResolvedValue(mockBlocks)
      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      
      let capturedVectorData: VectorData | undefined
      mockPineconeService.upsert.mockImplementation((vectorData: VectorData) => {
        capturedVectorData = vectorData
        return Promise.resolve()
      })

      await (documentProcessor as any).processPageWithMetadata(
        mockPage, 
        collectionMethod,
        depthLevel,
        parentPageId
      )

      expect(mockNotionService.getPageBlocks).toHaveBeenCalledWith(mockPage.id)
      expect(capturedVectorData).toBeDefined()
      expect(capturedVectorData!.metadata.collectionMethod).toBe(collectionMethod)
      expect(capturedVectorData!.metadata.depthLevel).toBe(depthLevel)
      expect(capturedVectorData!.metadata.parentPageId).toBe(parentPageId)
      expect(capturedVectorData!.metadata.pageUrl).toBe(mockPage.url)
      expect(capturedVectorData!.metadata.links).toBeDefined()
      expect(capturedVectorData!.metadata.links).toContain('website: https://example.com')
      expect(capturedVectorData!.metadata.links).toContain('documentation: https://docs.example.com')
    })

    test('parentPageId가 없는 경우 메타데이터에 포함하지 않아야 한다', async () => {
      const collectionMethod = 'database'
      const depthLevel = 0

      mockNotionService.getPageBlocks.mockResolvedValue([])
      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      
      let capturedVectorData: VectorData | undefined
      mockPineconeService.upsert.mockImplementation((vectorData: VectorData) => {
        capturedVectorData = vectorData
        return Promise.resolve()
      })

      await (documentProcessor as any).processPageWithMetadata(
        mockPage, 
        collectionMethod,
        depthLevel
      )

      expect(capturedVectorData!.metadata.parentPageId).toBeUndefined()
      expect(capturedVectorData!.metadata.collectionMethod).toBe(collectionMethod)
      expect(capturedVectorData!.metadata.depthLevel).toBe(depthLevel)
    })

    test('링크가 없는 페이지의 경우 links 메타데이터를 포함하지 않아야 한다', async () => {
      const blocksWithoutLinks = [
        {
          id: 'block-1',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { plain_text: 'Simple text without links', href: null }
            ]
          }
        }
      ]

      mockNotionService.getPageBlocks.mockResolvedValue(blocksWithoutLinks)
      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      
      let capturedVectorData: VectorData | undefined
      mockPineconeService.upsert.mockImplementation((vectorData: VectorData) => {
        capturedVectorData = vectorData
        return Promise.resolve()
      })

      await (documentProcessor as any).processPageWithMetadata(mockPage, 'page', 1)

      expect(capturedVectorData!.metadata.links).toBeUndefined()
    })
  })

  describe('에러 처리', () => {
    test('Notion API 오류 시 적절한 에러를 던져야 한다', async () => {
      const rootPageId = 'invalid-page-id'
      mockNotionService.collectFromPage.mockRejectedValue(new Error('Notion API Error'))

      await expect(documentProcessor.processPageRecursively(rootPageId))
        .rejects.toThrow('페이지 기반 처리에 실패했습니다: Notion API Error')
    })

    test('임베딩 생성 실패 시 해당 페이지를 건너뛰고 계속 진행해야 한다', async () => {
      const mockCollectionResult = {
        pages: [mockPage],
        totalPages: 1,
        skippedPages: 0,
        discoveredDatabases: [],
        errors: [],
        maxDepthReached: false
      }

      mockNotionService.collectFromPage.mockResolvedValue(mockCollectionResult)
      mockNotionService.getPageBlocks.mockResolvedValue(mockBlocks)
      mockEmbeddingService.createEmbedding.mockRejectedValue(new Error('Embedding failed'))

      const result = await documentProcessor.processPageRecursively('test-page-id')

      expect(result.processedPages).toBe(0)
      expect(result.skippedPages).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]?.error).toContain('Embedding failed')
    })
  })
})