import { Client } from '@notionhq/client'
import type { NotionConfig, NotionPage } from '@/types/notion'
import type { ServiceStatus } from '@/types/api'
import { MAX_NOTION_PAGE_SIZE } from './notion.constants'
import { NotionMapper } from './notion.mapper'

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

  async getPages(filter?: any): Promise<NotionPage[]> {
    if (!this.isInitialized) {
      throw new Error('노션 서비스가 초기화되지 않았습니다')
    }

    try {
      const logMessage = filter ? '노션 데이터베이스 필터링 조회 시작' : '노션 데이터베이스 전체 조회 시작'
      console.log(`${logMessage}: ${this.config.databaseId}`)
      
      const response = await this.client.databases.query({
        database_id: this.config.databaseId,
        filter: filter,
        page_size: MAX_NOTION_PAGE_SIZE,
      })

      const pages = response.results
        .filter((page) => 'properties' in page && page.object === 'page')
        .map((page: any) => ({
          id: page.id,
          title: NotionMapper.extractTitle(page.properties),
          content: '', // 기본 조회에서는 내용 제외
          properties: {},
          createdAt: new Date(page.created_time),
          updatedAt: new Date(page.last_edited_time),
          url: page.url,
        }))

      console.log(`노션 페이지 ${pages.length}개 조회 완료`)
      return pages
    } catch (error) {
      console.error('노션 페이지 조회 실패:', error)
      throw new Error(`노션 페이지를 조회할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  async getPage(pageId: string): Promise<NotionPage> {
    if (!this.isInitialized) {
      throw new Error('노션 서비스가 초기화되지 않았습니다')
    }

    try {
      console.log(`노션 페이지 상세 조회 시작: ${pageId}`)
      
      // 페이지 기본 정보 조회
      const page = await this.client.pages.retrieve({ page_id: pageId })
      
      if (!('properties' in page)) {
        throw new Error('페이지 정보를 읽을 수 없습니다')
      }

      // 페이지 블록 내용 조회
      const blocks = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: MAX_NOTION_PAGE_SIZE,
      })

      // 블록 내용을 마크다운으로 변환 (NotionMapper 사용)
      const content = NotionMapper.blocksToMarkdown(blocks.results)

      const notionPage: NotionPage = {
        id: page.id,
        title: NotionMapper.extractTitle(page.properties),
        content: content,
        properties: {},
        createdAt: new Date(page.created_time),
        updatedAt: new Date(page.last_edited_time),
        url: page.url,
      }

      console.log(`노션 페이지 상세 조회 완료: ${notionPage.title}`)
      return notionPage
    } catch (error) {
      console.error('노션 페이지 상세 조회 실패:', error)
      throw new Error(`노션 페이지 내용을 조회할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
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