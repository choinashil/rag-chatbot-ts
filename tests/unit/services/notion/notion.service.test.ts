import { NotionService } from '../../../../src/services/notion/notion.service'
import { mockNotionConfig, invalidNotionConfig } from '../../../fixtures/notion-config'
const mockNotionClient = {
  users: {
    me: jest.fn()
  },
  databases: {
    query: jest.fn()
  },
  pages: {
    retrieve: jest.fn()
  },
  blocks: {
    children: {
      list: jest.fn()
    }
  }
}

jest.mock('@notionhq/client', () => ({
  Client: jest.fn(() => mockNotionClient)
}))

describe('NotionService', () => {
  let notionService: NotionService

  beforeEach(() => {
    jest.clearAllMocks()
    mockNotionClient.users.me.mockReset()
    mockNotionClient.databases.query.mockReset()
    mockNotionClient.pages.retrieve.mockReset()
    mockNotionClient.blocks.children.list.mockReset()
  })

  describe('생성자', () => {
    test('유효한 설정으로 인스턴스 생성', () => {
      notionService = new NotionService(mockNotionConfig)
      
      expect(notionService).toBeInstanceOf(NotionService)
    })

    test('설정값이 올바르게 저장됨', () => {
      notionService = new NotionService(mockNotionConfig)
      const status = notionService.getStatus()
      
      expect(status.metadata?.timeout).toBe(mockNotionConfig.timeout)
    })
  })

  describe('초기화', () => {
    test('초기 상태는 연결되지 않음', () => {
      notionService = new NotionService(mockNotionConfig)
      const status = notionService.getStatus()
      
      expect(status.connected).toBe(false)
    })

    test('초기화 성공 시 연결 상태로 변경', async () => {
      mockNotionClient.users.me.mockResolvedValue({ id: 'test-user' })

      notionService = new NotionService(mockNotionConfig)
      await notionService.initialize()
      
      const status = notionService.getStatus()
      expect(status.connected).toBe(true)
    })

    test('초기화 실패 시 에러 발생', async () => {
      mockNotionClient.users.me.mockRejectedValue(new Error('API 연결 실패'))

      notionService = new NotionService(invalidNotionConfig)
      
      await expect(notionService.initialize()).rejects.toThrow('노션 서비스를 초기화할 수 없습니다')
    })
  })

  describe('상태 확인', () => {
    test('getStatus() 기본 구조 확인', () => {
      notionService = new NotionService(mockNotionConfig)
      const status = notionService.getStatus()
      
      expect(status).toHaveProperty('connected')
      expect(status).toHaveProperty('lastCheck')
      expect(status).toHaveProperty('metadata')
      expect(typeof status.connected).toBe('boolean')
      expect(typeof status.lastCheck).toBe('string')
    })

    test('lastCheck가 현재 시간에 가까움', () => {
      notionService = new NotionService(mockNotionConfig)
      const beforeTime = new Date().getTime()
      const status = notionService.getStatus()
      const afterTime = new Date().getTime()
      
      const checkTime = new Date(status.lastCheck).getTime()
      expect(checkTime).toBeGreaterThanOrEqual(beforeTime)
      expect(checkTime).toBeLessThanOrEqual(afterTime)
    })
  })

  describe('메서드 호출 - 미초기화 상태', () => {
    beforeEach(() => {
      notionService = new NotionService(mockNotionConfig)
    })

    test('getPages() 호출 시 에러 발생', async () => {
      await expect(notionService.getPages('test-db-id')).rejects.toThrow('노션 서비스가 초기화되지 않았습니다')
    })

    test('getPage() 호출 시 에러 발생', async () => {
      await expect(notionService.getPage('test-id')).rejects.toThrow('노션 서비스가 초기화되지 않았습니다')
    })
  })

  describe('메서드 실제 동작 테스트', () => {
    let initializedService: NotionService

    beforeEach(async () => {
      mockNotionClient.users.me.mockResolvedValue({ id: 'test-user' })
      initializedService = new NotionService(mockNotionConfig)
      await initializedService.initialize()
    })

    describe('getPages() 동작', () => {
      const mockDatabaseResponse = {
        results: [
          {
            id: 'page-1',
            object: 'page',
            properties: {
              title: {
                type: 'title',
                title: [{ plain_text: 'Test Page 1' }]
              }
            },
            created_time: '2023-01-01T00:00:00.000Z',
            last_edited_time: '2023-01-02T00:00:00.000Z',
            url: 'https://notion.so/page-1'
          },
          {
            id: 'page-2', 
            object: 'page',
            properties: {
              title: {
                type: 'title',
                title: [{ plain_text: 'Test Page 2' }]
              }
            },
            created_time: '2023-01-03T00:00:00.000Z',
            last_edited_time: '2023-01-04T00:00:00.000Z',
            url: 'https://notion.so/page-2'
          }
        ],
        has_more: false,
        next_cursor: null
      }

      test('전체 페이지 조회 성공', async () => {
        mockNotionClient.databases.query.mockResolvedValue(mockDatabaseResponse)

        const pages = await initializedService.getPages('test-database-id')

        expect(pages).toHaveLength(2)
        expect(pages[0]).toMatchObject({
          id: 'page-1',
          title: 'Test Page 1',
          content: '',
          url: 'https://notion.so/page-1'
        })
        expect(pages[1]).toMatchObject({
          id: 'page-2', 
          title: 'Test Page 2',
          content: '',
          url: 'https://notion.so/page-2'
        })
        
        expect(mockNotionClient.databases.query).toHaveBeenCalledWith({
          database_id: 'test-database-id',
          filter: undefined,
          page_size: 100
        })
      })

      test('필터링 조회 성공', async () => {
        const filter = { property: 'Status', select: { equals: 'Published' } }
        mockNotionClient.databases.query.mockResolvedValue({
          ...mockDatabaseResponse,
          results: [mockDatabaseResponse.results[0]]
        })

        const pages = await initializedService.getPages('test-database-id', { filter })

        expect(pages).toHaveLength(1)
        expect(mockNotionClient.databases.query).toHaveBeenCalledWith({
          database_id: 'test-database-id',
          filter: filter,
          page_size: 100
        })
      })

      test('빈 결과 처리', async () => {
        mockNotionClient.databases.query.mockResolvedValue({
          results: [],
          has_more: false,
          next_cursor: null
        })

        const pages = await initializedService.getPages('test-database-id')

        expect(pages).toHaveLength(0)
        expect(pages).toEqual([])
      })

      test('API 에러 처리', async () => {
        mockNotionClient.databases.query.mockRejectedValue(new Error('Database not found'))

        await expect(initializedService.getPages('test-database-id')).rejects.toThrow('노션 페이지를 조회할 수 없습니다')
      })
    })

    describe('getPage() 동작', () => {
      const mockPageResponse = {
        id: 'page-1',
        object: 'page',
        properties: {
          title: {
            type: 'title',
            title: [{ plain_text: 'Test Page Detail' }]
          }
        },
        created_time: '2023-01-01T00:00:00.000Z',
        last_edited_time: '2023-01-02T00:00:00.000Z',
        url: 'https://notion.so/page-1'
      }

      const mockBlocksResponse = {
        results: [
          {
            id: 'block-1',
            type: 'paragraph',
            has_children: false,
            paragraph: {
              rich_text: [{ plain_text: 'This is a test paragraph.' }]
            }
          },
          {
            id: 'block-2', 
            type: 'heading_1',
            has_children: false,
            heading_1: {
              rich_text: [{ plain_text: 'Main Heading' }]
            }
          }
        ]
      }

      test('페이지 상세 조회 성공', async () => {
        mockNotionClient.pages.retrieve.mockResolvedValue(mockPageResponse)
        mockNotionClient.blocks.children.list.mockResolvedValue(mockBlocksResponse)

        const page = await initializedService.getPage('page-1')

        expect(page).toMatchObject({
          id: 'page-1',
          title: 'Test Page Detail',
          url: 'https://notion.so/page-1'
        })
        expect(page.content).toContain('This is a test paragraph.')
        expect(page.content).toContain('# Main Heading')
        
        expect(mockNotionClient.pages.retrieve).toHaveBeenCalledWith({ page_id: 'page-1' })
        expect(mockNotionClient.blocks.children.list).toHaveBeenCalledWith({
          block_id: 'page-1',
          page_size: 100
        })
      })

      test('페이지 조회 API 에러 처리', async () => {
        mockNotionClient.pages.retrieve.mockRejectedValue(new Error('Page not found'))

        await expect(initializedService.getPage('invalid-id')).rejects.toThrow('노션 페이지 내용을 조회할 수 없습니다')
      })

      test('블록 조회 에러 처리', async () => {
        mockNotionClient.pages.retrieve.mockResolvedValue(mockPageResponse)
        mockNotionClient.blocks.children.list.mockRejectedValue(new Error('Blocks not accessible'))

        await expect(initializedService.getPage('page-1')).rejects.toThrow('노션 페이지 내용을 조회할 수 없습니다')
      })
    })
  })
})