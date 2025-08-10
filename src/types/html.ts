export interface SimpleDocument {
  url: string
  title: string
  content: string
  wordCount: number
  breadcrumb: string[]
  timestamp: string
}

export interface HtmlFetchOptions {
  timeout?: number
  retryCount?: number
  userAgent?: string
}

export interface HtmlParsingOptions {
  contentSeparator?: string
  unnecessaryTags?: string
  includeTitle?: boolean
}

// 3단계: 다중 페이지 수집을 위한 확장 타입들
export interface CrawledDocument extends SimpleDocument {
  id: string
  parentUrl?: string | undefined
  depth: number
  discoveredAt: string
  links: PageLink[]
  crawlMetadata: CrawlMetadata
}

export interface PageLink {
  url: string
  text: string
  type: 'internal' | 'external'
  discovered: boolean
}

export interface CrawlMetadata {
  crawlId: string
  sessionId: string
  discoveryMethod: 'initial' | 'link' | 'sitemap'
  processingTime: number
  errorCount: number
}

export interface CrawlOptions {
  maxDepth: number
  maxPages: number
  domainRestriction?: string[]
  includeExternal: boolean
  respectRobotsTxt: boolean
  crawlDelay: number
  concurrency: number
  includeParentPages: boolean  // 시작 페이지보다 상위 레벨 페이지 크롤링 여부
}

export interface CrawlSession {
  id: string
  startUrl: string
  options: CrawlOptions
  startTime: string
  status: 'running' | 'completed' | 'error' | 'stopped'
  statistics: CrawlStatistics
}

export interface CrawlStatistics {
  totalPages: number
  processedPages: number
  skippedPages: number
  errorPages: number
  duplicatePages: number
  averageProcessingTime: number
}