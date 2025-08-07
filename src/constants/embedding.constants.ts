// 임베딩 관련 상수 정의

// 토큰 및 제한 설정
export const EMBEDDING_LIMITS = {
  MAX_TOKENS_PER_REQUEST: 8191, // text-embedding-3-small 제한
  MAX_BATCH_SIZE: 100, // 한 번에 처리할 최대 텍스트 수
  MAX_TEXT_LENGTH: 32000, // 대략적인 최대 텍스트 길이 (문자 기준)
  ESTIMATED_TOKENS_PER_CHAR: 0.25 // 대략적인 토큰-문자 비율
} as const

// 재시도 및 타임아웃 설정
export const EMBEDDING_RETRY = {
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_RETRY_DELAY: 1000, // 1초
  RETRY_MULTIPLIER: 2, // 지수 백오프
  MAX_RETRY_DELAY: 10000 // 최대 10초
} as const

// 비용 계산 (USD, 1M 토큰 기준)
export const EMBEDDING_PRICING = {
  TEXT_EMBEDDING_3_SMALL: 0.00002, // $0.02/1M tokens
  TEXT_EMBEDDING_3_LARGE: 0.00013, // $0.13/1M tokens
  TEXT_EMBEDDING_ADA_002: 0.0001   // $0.10/1M tokens
} as const

// 캐싱 설정
export const EMBEDDING_CACHE = {
  DEFAULT_TTL: 24 * 60 * 60 * 1000, // 24시간 (ms)
  MAX_CACHE_SIZE: 10000, // 최대 캐시 항목 수
  HASH_ALGORITHM: 'sha256'
} as const

// 로깅 및 모니터링
export const EMBEDDING_LOGGING = {
  USAGE_LOG_INTERVAL: 100, // 100회마다 사용량 로그
  PERFORMANCE_THRESHOLD: 5000, // 5초 이상 걸리면 성능 경고
  ERROR_RATE_THRESHOLD: 0.1 // 10% 이상 에러율이면 경고
} as const