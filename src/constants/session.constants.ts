/**
 * 세션 관련 상수 정의
 */

export const SESSION_CONSTANTS = {
  // 메시지 제한
  DEFAULT_MESSAGE_LIMIT: 10,
  MAX_MESSAGE_LIMIT: 50,
  MIN_MESSAGE_LIMIT: 1,
  
  // 세션 만료 시간
  DEFAULT_EXPIRY_HOURS: 24,
  
  // 데이터 보관 정책
  SOFT_DELETE_RETENTION_DAYS: 90,
  
  // 성능 메트릭
  DEFAULT_ANALYTICS_DAYS: 7,
  MAX_ANALYTICS_DAYS: 30
} as const