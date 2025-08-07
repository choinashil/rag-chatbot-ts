import { Client } from '@notionhq/client'
import type { NotionConfig, NotionPage, NotionQueryResult } from '@/types/notion'
import type { ServiceStatus } from '@/types/api'

export class NotionService {
  private client: Client
  private config: NotionConfig
  private isInitialized = false

  constructor(config: NotionConfig) {
    this.config = config
    this.client = new Client({
      auth: config.integrationToken,
    })
  }

  async initialize(): Promise<void> {
    try {
      // Notion 연결 테스트
      await this.testConnection()
      this.isInitialized = true
      console.log('노션 서비스가 성공적으로 초기화되었습니다')
    } catch (error) {
      console.error('노션 서비스 초기화 실패:', error)
      throw new Error('노션 서비스를 초기화할 수 없습니다')
    }
  }

  async getPages(): Promise<NotionPage[]> {
    if (!this.isInitialized) {
      throw new Error('노션 서비스가 초기화되지 않았습니다')
    }

    // TODO: 노션 데이터베이스에서 페이지 목록 조회
    throw new Error('구현 필요')
  }

  async getPageContent(pageId: string): Promise<NotionPage> {
    if (!this.isInitialized) {
      throw new Error('노션 서비스가 초기화되지 않았습니다')
    }

    // TODO: 특정 페이지 내용 조회
    throw new Error('구현 필요')
  }

  async queryDatabase(): Promise<NotionQueryResult> {
    if (!this.isInitialized) {
      throw new Error('노션 서비스가 초기화되지 않았습니다')
    }

    // TODO: 데이터베이스 쿼리 실행
    throw new Error('구현 필요')
  }

  getStatus(): ServiceStatus {
    return {
      connected: this.isInitialized,
      lastCheck: new Date().toISOString(),
      metadata: {
        databaseId: this.config.databaseId,
        timeout: this.config.timeout,
      }
    }
  }

  private async testConnection(): Promise<void> {
    try {
      // 기본 연결 테스트 - 사용자 정보 조회
      await this.client.users.me({})
    } catch (error) {
      throw new Error(`노션 API 연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }
}