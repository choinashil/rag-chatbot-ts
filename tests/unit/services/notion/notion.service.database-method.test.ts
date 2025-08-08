import { NotionService } from '../../../../src/services/notion/notion.service'
import type { NotionConfig, PageCollectionOptions } from '../../../../src/types/notion'

describe('NotionService - 데이터베이스 방식 개선', () => {
  let notionService: NotionService
  const mockConfig: NotionConfig = {
    integrationToken: 'test-token',
    databaseId: 'test-database-id',
    timeout: 5000,
    retryAttempts: 3,
  }

  beforeEach(() => {
    notionService = new NotionService(mockConfig)
  })

  describe('getPagesFromDatabase', () => {
    test('지정된 데이터베이스에서 직접 페이지를 조회해야 한다', async () => {
      const specificDatabaseId = 'specific-database-id'
      const mockPages = [
        {
          id: 'page-1',
          object: 'page',
          properties: { title: { type: 'title', title: [{ plain_text: 'Page 1' }] } },
          created_time: '2025-01-08T12:00:00.000Z',
          last_edited_time: '2025-01-08T12:00:00.000Z',
          url: 'https://notion.so/page-1'
        }
      ]

      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) },
        databases: {
          query: jest.fn().mockResolvedValue({
            results: mockPages
          })
        }
      }

      ;(notionService as any).client = mockClient
      await notionService.initialize()

      const pages = await notionService.getPagesFromDatabase(specificDatabaseId)

      expect(mockClient.databases.query).toHaveBeenCalledWith({
        database_id: specificDatabaseId,
        page_size: 100
      })
      expect(pages).toHaveLength(1)
      expect(pages[0]?.id).toBe('page-1')
      expect(pages[0]?.title).toBe('Page 1')
    })

    test('필터와 페이지 크기 옵션을 올바르게 전달해야 한다', async () => {
      const specificDatabaseId = 'specific-database-id'
      const options = {
        filter: { property: 'Status', select: { equals: 'Published' } },
        pageSize: 50
      }

      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) },
        databases: {
          query: jest.fn().mockResolvedValue({ results: [] })
        }
      }

      ;(notionService as any).client = mockClient
      await notionService.initialize()

      await notionService.getPagesFromDatabase(specificDatabaseId, options)

      expect(mockClient.databases.query).toHaveBeenCalledWith({
        database_id: specificDatabaseId,
        page_size: 50,
        filter: options.filter
      })
    })

    test('기존 getPages 메서드는 설정된 데이터베이스 ID를 사용해야 한다', async () => {
      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) },
        databases: {
          query: jest.fn().mockResolvedValue({ results: [] })
        }
      }

      ;(notionService as any).client = mockClient
      await notionService.initialize()

      await notionService.getPages()

      expect(mockClient.databases.query).toHaveBeenCalledWith({
        database_id: mockConfig.databaseId,
        page_size: 100
      })
    })
  })

  describe('collectDatabasePages - 설정 변경 없는 개선된 방식', () => {
    test('지정된 데이터베이스에서 설정 변경 없이 페이지를 수집해야 한다', async () => {
      // Given
      const targetDatabaseId = 'target-database-id'
      const options: Required<PageCollectionOptions> = {
        maxDepth: 2,
        includeDatabase: true,
        excludeEmpty: true,
        visitedPages: new Set<string>(),
        currentDepth: 1
      }

      const mockPages = [
        {
          id: 'db-page-1',
          title: 'DB Page 1',
          content: 'Content of database page 1',
          properties: {},
          createdAt: new Date('2025-01-08T12:00:00Z'),
          updatedAt: new Date('2025-01-08T12:00:00Z'),
          url: 'https://notion.so/db-page-1'
        }
      ]

      const mockResult = {
        pages: [],
        totalPages: 0,
        skippedPages: 0,
        discoveredDatabases: [],
        errors: []
      }

      // getPagesFromDatabase 메서드 모킹
      jest.spyOn(notionService, 'getPagesFromDatabase').mockResolvedValue(mockPages)
      jest.spyOn(notionService, 'getPage').mockResolvedValue(mockPages[0]!)
      jest.spyOn(notionService, 'getChildPages').mockResolvedValue(['child-page-1'])

      // collectPagesRecursively 메서드 모킹 (private이므로 spy 불가능, 결과로 확인)
      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) }
      }
      ;(notionService as any).client = mockClient
      await notionService.initialize()

      // When
      await (notionService as any).collectDatabasePages(targetDatabaseId, options, mockResult)

      // Then
      expect(notionService.getPagesFromDatabase).toHaveBeenCalledWith(targetDatabaseId)
      expect(notionService.getPage).toHaveBeenCalledWith('db-page-1')
      
      // 원래 설정이 변경되지 않았는지 확인
      expect((notionService as any).config.databaseId).toBe(mockConfig.databaseId)
    })

    test('빈 페이지는 excludeEmpty 옵션에 따라 필터링되어야 한다', async () => {
      // Given
      const targetDatabaseId = 'target-database-id'
      const options: Required<PageCollectionOptions> = {
        maxDepth: 1,
        includeDatabase: false,
        excludeEmpty: true,
        visitedPages: new Set<string>(),
        currentDepth: 0
      }

      const mockPages = [
        {
          id: 'empty-page',
          title: 'Empty Page',
          content: '',
          properties: {},
          createdAt: new Date('2025-01-08T12:00:00Z'),
          updatedAt: new Date('2025-01-08T12:00:00Z'),
          url: 'https://notion.so/empty-page'
        },
        {
          id: 'content-page',
          title: 'Content Page',
          content: 'This has content',
          properties: {},
          createdAt: new Date('2025-01-08T12:00:00Z'),
          updatedAt: new Date('2025-01-08T12:00:00Z'),
          url: 'https://notion.so/content-page'
        }
      ]

      const mockResult = {
        pages: [] as any[],
        totalPages: 0,
        skippedPages: 0,
        discoveredDatabases: [],
        errors: []
      }

      jest.spyOn(notionService, 'getPagesFromDatabase').mockResolvedValue(mockPages)
      jest.spyOn(notionService, 'getPage')
        .mockResolvedValueOnce(mockPages[0]!) // 빈 페이지
        .mockResolvedValueOnce(mockPages[1]!) // 내용 있는 페이지
      jest.spyOn(notionService, 'getChildPages').mockResolvedValue([])

      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) }
      }
      ;(notionService as any).client = mockClient
      await notionService.initialize()

      // When
      await (notionService as any).collectDatabasePages(targetDatabaseId, options, mockResult)

      // Then
      // 빈 페이지는 제외되고 내용 있는 페이지만 포함되어야 함
      expect(mockResult.totalPages).toBe(1)
      expect(mockResult.pages[0]?.id).toBe('content-page')
    })

    test('이미 방문한 페이지는 건너뛰어야 한다', async () => {
      // Given
      const targetDatabaseId = 'target-database-id'
      const visitedPageId = 'already-visited-page'
      const options: Required<PageCollectionOptions> = {
        maxDepth: 2,
        includeDatabase: false,
        excludeEmpty: false,
        visitedPages: new Set<string>([visitedPageId]),
        currentDepth: 0
      }

      const mockPages = [
        {
          id: visitedPageId,
          title: 'Already Visited',
          content: 'Some content',
          properties: {},
          createdAt: new Date('2025-01-08T12:00:00Z'),
          updatedAt: new Date('2025-01-08T12:00:00Z'),
          url: 'https://notion.so/already-visited'
        }
      ]

      const mockResult = {
        pages: [],
        totalPages: 0,
        skippedPages: 0,
        discoveredDatabases: [],
        errors: []
      }

      jest.spyOn(notionService, 'getPagesFromDatabase').mockResolvedValue(mockPages)
      jest.spyOn(notionService, 'getPage').mockResolvedValue(mockPages[0]!)

      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) }
      }
      ;(notionService as any).client = mockClient
      await notionService.initialize()

      // When
      await (notionService as any).collectDatabasePages(targetDatabaseId, options, mockResult)

      // Then
      // 이미 방문한 페이지이므로 getPage가 호출되지 않아야 함
      expect(notionService.getPage).not.toHaveBeenCalled()
      expect(mockResult.totalPages).toBe(0)
      expect(mockResult.pages).toHaveLength(0)
    })

    test('API 오류 시 적절하게 처리해야 한다', async () => {
      // Given
      const targetDatabaseId = 'invalid-database-id'
      const options: Required<PageCollectionOptions> = {
        maxDepth: 1,
        includeDatabase: false,
        excludeEmpty: false,
        visitedPages: new Set<string>(),
        currentDepth: 0
      }

      const mockResult = {
        pages: [],
        totalPages: 0,
        skippedPages: 0,
        discoveredDatabases: [],
        errors: []
      }

      jest.spyOn(notionService, 'getPagesFromDatabase')
        .mockRejectedValue(new Error('Database not found'))

      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) }
      }
      ;(notionService as any).client = mockClient
      await notionService.initialize()

      // When & Then
      await expect((notionService as any).collectDatabasePages(targetDatabaseId, options, mockResult))
        .resolves.not.toThrow() // 에러를 던지지 않고 gracefully 처리해야 함

      // 결과 상태는 변경되지 않아야 함
      expect(mockResult.totalPages).toBe(0)
      expect(mockResult.pages).toHaveLength(0)
    })
  })
})