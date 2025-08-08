// Notion 관련 타입 정의
export interface NotionConfig {
  integrationToken: string
  pageId?: string
  timeout: number
  retryAttempts: number
}

export interface NotionPage {
  id: string
  title: string
  content: string
  properties: NotionPageProperties
  createdAt: Date
  updatedAt: Date
  url: string
  publicUrl?: string
}

export interface NotionPageProperties {
  status?: string
  tags?: string[]
  category?: string
  priority?: number
  [key: string]: unknown
}

export interface NotionBlock {
  id: string
  type: string
  content: string
  children?: NotionBlock[]
}

export interface PageCollectionOptions {
  maxDepth?: number        // 재귀 깊이 제한 (기본값: 10)
  includeDatabase?: boolean // 하위 데이터베이스 수집 여부 (기본값: true)
  excludeEmpty?: boolean    // 빈 페이지 제외 (기본값: true)
  visitedPages?: Set<string> // 순환 참조 방지
  currentDepth?: number     // 현재 재귀 깊이
}

export interface PageCollectionResult {
  pages: NotionPage[]
  totalPages: number
  skippedPages: number
  discoveredDatabases: string[]
  maxDepthReached: boolean
}
