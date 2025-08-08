// 시스템 레벨 상수 정의

// 서버 설정 관련 상수
export const SERVER_CONFIG = {
  RATE_LIMIT_MAX_REQUESTS: 100, // 분당 최대 요청 수
  TIMEOUT_CONFIG: {
    MIN_TIMEOUT: 1000,  // 최소 타임아웃 (1초)
    MAX_TIMEOUT: 300000 // 최대 타임아웃 (5분)
  },
  RETRY_CONFIG: {
    MIN_RETRIES: 0,
    MAX_RETRIES: 10
  }
} as const