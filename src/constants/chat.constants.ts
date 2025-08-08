// 채팅 API 관련 상수 정의

export const CHAT_CONSTANTS = {
  MESSAGE_MIN_LENGTH: 1, // 최소 1자
  MESSAGE_MAX_LENGTH: 2000 // 최대 2000자 (사용자 경험 및 토큰 제한 고려)
} as const