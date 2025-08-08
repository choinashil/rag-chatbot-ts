import { Client } from '@notionhq/client'
import type { NotionConfig, NotionPage, PageCollectionOptions, PageCollectionResult } from '@/types/notion'
import type { ServiceStatus } from '@/types/api'
import { MAX_NOTION_PAGE_SIZE, PAGE_COLLECTION_DEFAULTS } from './notion.constants'
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

  async getPages(options?: { filter?: any; pageSize?: number }): Promise<NotionPage[]> {
    return this.getPagesFromDatabase(this.config.databaseId, options)
  }

  /**
   * 특정 데이터베이스에서 페이지 조회 (설정 변경 없이)
   */
  async getPagesFromDatabase(databaseId: string, options?: { filter?: any; pageSize?: number }): Promise<NotionPage[]> {
    if (!this.isInitialized) {
      throw new Error('노션 서비스가 초기화되지 않았습니다')
    }

    try {
      const { filter, pageSize } = options || {}
      const logMessage = filter ? '    🔍 노션 데이터베이스 필터링 조회' : '    📊 노션 데이터베이스 전체 조회'
      console.log(`${logMessage}: ${databaseId}`)
      
      const queryParams: any = {
        database_id: databaseId,
        page_size: pageSize || MAX_NOTION_PAGE_SIZE,
      }
      
      // filter가 제공된 경우에만 추가
      if (filter) {
        queryParams.filter = filter
      }
      
      const response = await this.client.databases.query(queryParams)

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

      console.log(`    ✅ ${pages.length}개 페이지 조회 완료`)
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
      console.log(`      📖 페이지 내용 조회: ${pageId}`)
      
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

      console.log(`      ✅ 페이지 내용 조회 완료: ${notionPage.title}`)
      return notionPage
    } catch (error) {
      console.error('노션 페이지 상세 조회 실패:', error)
      throw new Error(`노션 페이지 내용을 조회할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }


  async collectFromPage(
    rootPageId: string, 
    options: PageCollectionOptions = {}
  ): Promise<PageCollectionResult> {
    if (!this.isInitialized) {
      throw new Error('노션 서비스가 초기화되지 않았습니다')
    }

    const defaultOptions: Required<PageCollectionOptions> = {
      maxDepth: PAGE_COLLECTION_DEFAULTS.MAX_DEPTH,
      includeDatabase: PAGE_COLLECTION_DEFAULTS.INCLUDE_DATABASE,
      excludeEmpty: PAGE_COLLECTION_DEFAULTS.EXCLUDE_EMPTY,
      visitedPages: new Set<string>(),
      currentDepth: PAGE_COLLECTION_DEFAULTS.INITIAL_DEPTH
    }

    const mergedOptions = { ...defaultOptions, ...options }
    
    console.log(`    🔄 페이지 기반 수집: ${rootPageId} (최대 깊이: ${mergedOptions.maxDepth})`)
    
    const result: PageCollectionResult = {
      pages: [],
      totalPages: 0,
      skippedPages: 0,
      discoveredDatabases: [],
      maxDepthReached: false
    }

    await this.collectPagesRecursively(rootPageId, mergedOptions, result)
    
    console.log(`페이지 수집 완료: ${result.totalPages}개 수집, ${result.skippedPages}개 건너뜀`)
    return result
  }

  async getChildPages(pageId: string): Promise<string[]> {
    if (!this.isInitialized) {
      throw new Error('노션 서비스가 초기화되지 않았습니다')
    }

    try {
      const blocks = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: MAX_NOTION_PAGE_SIZE,
      })

      const childPageIds: string[] = []
      
      for (const block of blocks.results) {
        if ('type' in block) {
          // child_page 타입 블록에서 페이지 ID 추출
          if (block.type === 'child_page' && 'child_page' in block) {
            childPageIds.push(block.id)
          }
          // link_to_page 타입에서도 페이지 ID 추출 가능
          if (block.type === 'link_to_page' && 'link_to_page' in block) {
            const linkToPage = block.link_to_page as any
            if (linkToPage.type === 'page_id') {
              childPageIds.push(linkToPage.page_id)
            }
          }
        }
      }

      return childPageIds
    } catch (error) {
      console.warn(`하위 페이지 조회 실패 (${pageId}):`, error)
      return []
    }
  }

  async findDatabasesInPage(pageId: string): Promise<string[]> {
    if (!this.isInitialized) {
      throw new Error('노션 서비스가 초기화되지 않았습니다')
    }

    try {
      const blocks = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: MAX_NOTION_PAGE_SIZE,
      })

      const databaseIds: string[] = []
      
      for (const block of blocks.results) {
        if ('type' in block) {
          // 인라인 데이터베이스
          if (block.type === 'child_database' && 'child_database' in block) {
            databaseIds.push(block.id)
          }
          // 링크된 데이터베이스 뷰
          if (block.type === 'link_to_page' && 'link_to_page' in block) {
            const linkToPage = block.link_to_page as any
            if (linkToPage.type === 'database_id') {
              databaseIds.push(linkToPage.database_id)
            }
          }
        }
      }

      return databaseIds
    } catch (error) {
      console.warn(`데이터베이스 탐지 실패 (${pageId}):`, error)
      return []
    }
  }

  /**
   * 페이지의 블록 내용 조회 (공개 메서드)
   */
  async getPageBlocks(pageId: string): Promise<any[]> {
    if (!this.isInitialized) {
      throw new Error('노션 서비스가 초기화되지 않았습니다')
    }

    try {
      console.log(`        📄 페이지 블록 조회: ${pageId}`)
      
      const response = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: MAX_NOTION_PAGE_SIZE
      })

      return response.results || []
    } catch (error) {
      console.warn(`페이지 블록 조회 실패: ${pageId}`, error)
      return []
    }
  }

  private async collectPagesRecursively(
    pageId: string, 
    options: Required<PageCollectionOptions>, 
    result: PageCollectionResult
  ): Promise<void> {
    // 순환 참조 방지
    if (options.visitedPages.has(pageId)) {
      console.log(`이미 방문한 페이지 건너뜀: ${pageId}`)
      result.skippedPages++
      return
    }

    // 최대 깊이 확인
    if (options.currentDepth >= options.maxDepth) {
      console.log(`최대 깊이 도달로 페이지 건너뜀: ${pageId} (깊이: ${options.currentDepth})`)
      result.maxDepthReached = true
      result.skippedPages++
      return
    }

    // 방문 표시
    options.visitedPages.add(pageId)

    try {
      // 현재 페이지 수집
      console.log(`페이지 수집 중: ${pageId} (깊이: ${options.currentDepth})`)
      const page = await this.getPage(pageId)
      
      // 빈 페이지 제외 옵션 확인
      if (options.excludeEmpty && (!page.content || page.content.trim().length === 0)) {
        console.log(`빈 페이지 건너뜀: ${page.title}`)
        result.skippedPages++
      } else {
        result.pages.push(page)
        result.totalPages++
        console.log(`페이지 수집 완료: ${page.title}`)
      }

      // 하위 데이터베이스 탐지 및 수집
      if (options.includeDatabase) {
        const databaseIds = await this.findDatabasesInPage(pageId)
        for (const databaseId of databaseIds) {
          if (!result.discoveredDatabases.includes(databaseId)) {
            result.discoveredDatabases.push(databaseId)
            console.log(`하위 데이터베이스 발견: ${databaseId}`)
            
            // 데이터베이스의 페이지들 수집
            await this.collectDatabasePages(databaseId, options, result)
          }
        }
      }

      // 하위 페이지 재귀 수집
      const childPageIds = await this.getChildPages(pageId)
      for (const childPageId of childPageIds) {
        const childOptions = {
          ...options,
          currentDepth: options.currentDepth + 1
        }
        
        await this.collectPagesRecursively(childPageId, childOptions, result)
      }

    } catch (error) {
      console.error(`페이지 수집 실패: ${pageId}`, error)
      result.skippedPages++
    }
  }

  private async collectDatabasePages(
    databaseId: string, 
    options: Required<PageCollectionOptions>, 
    result: PageCollectionResult
  ): Promise<void> {
    try {
      console.log(`데이터베이스 페이지 수집 시작: ${databaseId}`)
      
      // 지정된 데이터베이스에서 직접 페이지 조회 (설정 변경 없이)
      const pages = await this.getPagesFromDatabase(databaseId)
      
      for (const page of pages) {
        // 이미 방문한 페이지가 아니면 상세 내용 수집
        if (!options.visitedPages.has(page.id)) {
          const fullPage = await this.getPage(page.id)
          
          if (!options.excludeEmpty || (fullPage.content && fullPage.content.trim().length > 0)) {
            result.pages.push(fullPage)
            result.totalPages++
            console.log(`데이터베이스 페이지 수집 완료: ${fullPage.title}`)
          }
          
          options.visitedPages.add(page.id)
          
          // 데이터베이스 페이지의 하위 페이지도 재귀 수집
          if (options.currentDepth + 1 < options.maxDepth) {
            const childOptions = {
              ...options,
              currentDepth: options.currentDepth + 1
            }
            
            const childPageIds = await this.getChildPages(page.id)
            for (const childPageId of childPageIds) {
              await this.collectPagesRecursively(childPageId, childOptions, result)
            }
          }
        }
      }
      
    } catch (error) {
      console.error(`데이터베이스 페이지 수집 실패: ${databaseId}`, error)
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

}