// OpenAI 관련 상수 정의

// 지원 모델
export const OPENAI_MODELS = {
  EMBEDDING: 'text-embedding-3-small',
  CHAT: 'gpt-3.5-turbo'
} as const

// 기본 설정값
export const OPENAI_DEFAULTS = {
  TIMEOUT: 30000, // 30초
  MAX_RETRIES: 3,
  EMBEDDING_DIMENSIONS: 1536,
  MAX_TOKENS_EMBEDDING: 8191
} as const

// 토큰 제한
export const OPENAI_LIMITS = {
  MAX_TOKENS_PER_REQUEST: 8191,
  MAX_BATCH_SIZE: 100,
  RATE_LIMIT_PER_MINUTE: 1000
} as const

// 에러 타입
export const OPENAI_ERROR_TYPES = {
  API_ERROR: 'api_error',
  RATE_LIMIT: 'rate_limit', 
  INVALID_REQUEST: 'invalid_request',
  AUTHENTICATION: 'authentication'
} as const

// 임베딩 관련 상수
export const EMBEDDING_CONFIG = {
  MODEL: OPENAI_MODELS.EMBEDDING,
  DIMENSIONS: OPENAI_DEFAULTS.EMBEDDING_DIMENSIONS,
  ENCODING_FORMAT: 'float',
  MAX_INPUT_TOKENS: OPENAI_DEFAULTS.MAX_TOKENS_EMBEDDING
} as const