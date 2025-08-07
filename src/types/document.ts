// 문서 관련 타입 정의
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
}