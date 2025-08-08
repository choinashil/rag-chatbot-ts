import { NotionService } from '../../../../src/services/notion/notion.service'
import type { NotionConfig } from '../../../../src/types/notion'

describe('NotionService - 페이지 기반 수집', () => {
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

  describe('collectFromPage', () => {
    test('기본 옵션으로 페이지 수집을 시도해야 한다', async () => {
      const mockPageId = 'test-page-id'
      
      const mockClient = {
        users: {
          me: jest.fn().mockResolvedValue({ id: 'user-id' })
        },
        pages: {
          retrieve: jest.fn().mockResolvedValue({
            id: mockPageId,
            properties: { title: { title: [{ plain_text: 'Test Page' }] } },
            created_time: '2025-08-08T12:00:00.000Z',
            last_edited_time: '2025-08-08T12:00:00.000Z',
            url: 'https://notion.so/test-page'
          })
        },
        blocks: {
          children: {
            list: jest.fn().mockResolvedValue({ results: [] })
          }
        }
      }

      ;(notionService as any).client = mockClient
      await notionService.initialize()

      await expect(notionService.collectFromPage(mockPageId)).resolves.toBeDefined()
    })
  })

  describe('getChildPages', () => {
    test('child_page 블록에서 하위 페이지 ID를 추출해야 한다', async () => {
      const mockPageId = 'parent-page-id'
      const mockChildPageId = 'child-page-id'
      
      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) },
        blocks: {
          children: {
            list: jest.fn().mockResolvedValue({
              results: [
                {
                  type: 'child_page',
                  id: mockChildPageId,
                  child_page: { title: 'Child Page' }
                }
              ]
            })
          }
        }
      }

      ;(notionService as any).client = mockClient
      await notionService.initialize()

      const childPages = await notionService.getChildPages(mockPageId)

      expect(childPages).toContain(mockChildPageId)
      expect(mockClient.blocks.children.list).toHaveBeenCalledWith({
        block_id: mockPageId,
        page_size: expect.any(Number)
      })
    })

    test('링크된 페이지에서도 페이지 ID를 추출해야 한다', async () => {
      const mockPageId = 'parent-page-id'
      const mockLinkedPageId = 'linked-page-id'
      
      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) },
        blocks: {
          children: {
            list: jest.fn().mockResolvedValue({
              results: [
                {
                  type: 'link_to_page',
                  link_to_page: {
                    type: 'page_id',
                    page_id: mockLinkedPageId
                  }
                }
              ]
            })
          }
        }
      }

      ;(notionService as any).client = mockClient
      await notionService.initialize()

      const childPages = await notionService.getChildPages(mockPageId)

      expect(childPages).toContain(mockLinkedPageId)
    })
  })

  describe('findDatabasesInPage', () => {
    test('인라인 데이터베이스를 탐지해야 한다', async () => {
      const mockPageId = 'page-with-database'
      const mockDatabaseId = 'inline-database-id'
      
      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) },
        blocks: {
          children: {
            list: jest.fn().mockResolvedValue({
              results: [
                {
                  type: 'child_database',
                  id: mockDatabaseId,
                  child_database: { title: 'Inline Database' }
                }
              ]
            })
          }
        }
      }

      ;(notionService as any).client = mockClient
      await notionService.initialize()

      const databases = await notionService.findDatabasesInPage(mockPageId)

      expect(databases).toContain(mockDatabaseId)
    })

    test('링크된 데이터베이스를 탐지해야 한다', async () => {
      const mockPageId = 'page-with-linked-database'
      const mockDatabaseId = 'linked-database-id'
      
      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) },
        blocks: {
          children: {
            list: jest.fn().mockResolvedValue({
              results: [
                {
                  type: 'link_to_page',
                  link_to_page: {
                    type: 'database_id',
                    database_id: mockDatabaseId
                  }
                }
              ]
            })
          }
        }
      }

      ;(notionService as any).client = mockClient
      await notionService.initialize()

      const databases = await notionService.findDatabasesInPage(mockPageId)

      expect(databases).toContain(mockDatabaseId)
    })
  })

  describe('에러 처리', () => {
    test('API 에러 시 빈 배열을 반환해야 한다', async () => {
      const mockPageId = 'invalid-page-id'
      
      const mockClient = {
        users: { me: jest.fn().mockResolvedValue({ id: 'user-id' }) },
        blocks: {
          children: {
            list: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      }

      ;(notionService as any).client = mockClient
      await notionService.initialize()

      const childPages = await notionService.getChildPages(mockPageId)
      const databases = await notionService.findDatabasesInPage(mockPageId)

      expect(childPages).toEqual([])
      expect(databases).toEqual([])
    })
  })
})