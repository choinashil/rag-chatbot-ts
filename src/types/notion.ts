// Notion 관련 타입 정의
export interface NotionConfig {
  integrationToken: string
  databaseId: string
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
  title?: string
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

export interface NotionQueryResult {
  pages: NotionPage[]
  hasMore: boolean
  nextCursor?: string
  totalCount: number
}