// 문서 관련 타입 정의

// 수집 방식 타입
export type CollectionMethod = 'database' | 'page'

export interface Document {
  readonly id: string
  title: string
  content: string
  source: DocumentSource
  metadata: DocumentMetadata
  createdAt: Date
  updatedAt: Date
}

export interface DocumentSource {
  type: 'notion' | 'file' | 'url'
  sourceId: string
  url?: string
  publicUrl?: string
}

export interface DocumentMetadata {
  filename: string
  filesize?: number
  tags?: string[]
  author?: string
  lastModified?: Date
  version?: string
  // 페이지 기반 수집용 메타데이터
  pageUrl?: string        // 노션 페이지 URL
  pageTitle?: string      // 페이지 제목
  collectionMethod?: CollectionMethod // 수집 방식
  parentPageId?: string   // 상위 페이지 ID
  depthLevel?: number     // 재귀 깊이
  links?: Array<{text: string, url: string}> // 페이지 내 링크 정보
}

// 문서 처리 결과 타입
export interface ProcessingResult {
  processedPages: number
  skippedPages: number
  totalVectors: number
  errors: Array<{
    pageId: string
    title: string
    error: string
  }>
  discoveredDatabases: string[]
}