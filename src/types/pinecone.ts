// Pinecone 벡터 DB 관련 타입 정의
import type { CollectionMethod } from './document'

export interface PineconeConfig {
  apiKey: string
  indexName: string
  timeout?: number
}

export interface VectorData {
  id: string
  vector: number[]
  metadata: VectorMetadata
}

export interface VectorMetadata {
  title: string
  content: string
  source: string
  timestamp?: string
  url?: string
  breadcrumb?: string
  // 페이지 기반 수집용 메타데이터
  pageUrl?: string
  pageTitle?: string
  collectionMethod?: CollectionMethod
  parentPageId?: string
  depthLevel?: number
  links?: string
}

export interface SearchResult {
  id: string
  score: number
  metadata: VectorMetadata
}

export interface PineconeServiceStatus {
  connected: boolean
  indexName?: string
  vectorCount?: number
  error?: string
}

export interface QueryOptions {
  topK?: number
  scoreThreshold?: number
}