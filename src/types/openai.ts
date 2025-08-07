// OpenAI 관련 타입 정의

export interface OpenAIConfig {
  apiKey: string
  organization?: string
  timeout: number
  maxRetries: number
  models: {
    embedding: string
    chat: string
  }
}

export interface EmbeddingRequest {
  text: string
  model?: string
}

export interface EmbeddingResponse {
  embedding: number[]
  tokenCount: number
  model: string
}

export interface OpenAIError {
  code: string
  message: string
  type: 'api_error' | 'rate_limit' | 'invalid_request' | 'authentication'
}

export interface OpenAIServiceStatus {
  connected: boolean
  lastCheck: Date | null
  modelsAvailable: string[]
  metadata?: {
    organization?: string
    currentModel: string
  }
}
