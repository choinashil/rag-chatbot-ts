// 임베딩 관련 타입 정의

export interface EmbeddingInput {
  text: string
  id?: string // 텍스트 식별자 (캐싱용)
}

export interface EmbeddingResult {
  embedding: number[]
  tokenCount: number
  model: string
  id?: string
  text: string // 원본 텍스트 (디버깅용)
}

export interface BatchEmbeddingInput {
  texts: EmbeddingInput[]
  batchSize?: number
}

export interface BatchEmbeddingResult {
  results: EmbeddingResult[]
  totalTokens: number
  requestCount: number
  errors: EmbeddingError[]
}

export interface EmbeddingError {
  text: string
  id?: string
  error: string
  code: string
  retryable: boolean
}

export interface EmbeddingServiceConfig {
  model: string
  maxTokensPerRequest: number
  maxRetries: number
  retryDelay: number
  enableCache: boolean
  logUsage: boolean
}

export interface TokenUsage {
  totalTokens: number
  requestCount: number
  estimatedCost: number // USD
  timestamp: Date
}