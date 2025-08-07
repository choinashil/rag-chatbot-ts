// NotionService 단위 테스트
import { NotionService } from '../../../../src/services/notion/notion.service'
import { mockNotionConfig, invalidNotionConfig } from '../../../fixtures/notion-config'

// 노션 클라이언트 모킹
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
    // 모든 모킹된 함수들 리셋
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
      
      expect(status.metadata?.databaseId).toBe(mockNotionConfig.databaseId)
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
      // 노션 클라이언트 모킹 - 성공 케이스
      mockNotionClient.users.me.mockResolvedValue({ id: 'test-user' })

      notionService = new NotionService(mockNotionConfig)
      await notionService.initialize()
      
      const status = notionService.getStatus()
      expect(status.connected).toBe(true)
    })

    test('초기화 실패 시 에러 발생', async () => {
      // 노션 클라이언트 모킹 - 실패 케이스
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
      await expect(notionService.getPages()).rejects.toThrow('노션 서비스가 초기화되지 않았습니다')
    })

    test('getPage() 호출 시 에러 발생', async () => {
      await expect(notionService.getPage('test-id')).rejects.toThrow('노션 서비스가 초기화되지 않았습니다')
    })
  })
})