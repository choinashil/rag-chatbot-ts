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