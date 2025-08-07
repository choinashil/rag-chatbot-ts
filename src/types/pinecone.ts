// Pinecone 벡터 DB 관련 타입 정의

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