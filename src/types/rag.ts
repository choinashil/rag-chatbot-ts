// RAG 관련 타입 정의

export interface RAGRequest {
  question: string
  maxResults?: number
  scoreThreshold?: number
}

export interface RAGResponse {
  answer: string
  sources: RAGSource[]
  metadata: RAGMetadata
}

export interface RAGSource {
  id: string
  title: string
  content: string
  score: number
  url?: string
}

export interface RAGMetadata {
  totalSources: number
  processingTime: number
  model: string
  timestamp: string
  tokenCount?: number
}

export interface RAGContext {
  sources: RAGSource[]
  combinedContent: string
}