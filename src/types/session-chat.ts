/**
 * 세션 기반 채팅 API 타입 정의
 */

import { StreamingChatRequest } from './index'
import { MessageRole } from './shared'

/**
 * 세션 생성 요청
 */
export interface CreateSessionRequest {
  storeId: string
  userId: string
  metadata?: Record<string, any>
}

/**
 * 세션 채팅 요청
 */
export interface SessionChatRequest extends StreamingChatRequest {
  sessionId: string
  businessMetadata?: {
    inquiryCategory?: string
    priority?: string
    topicTags?: string[]
  }
}

/**
 * 세션 응답 데이터
 */
export interface SessionResponse {
  sessionId: string
  message: string
}

/**
 * 세션 컨텍스트
 */
export interface SessionContext {
  session: {
    id: string
    store_id: string
    user_id: string
    created_at: string
    metadata: Record<string, any>
  }
  recentMessages: Array<{
    id: string
    role: MessageRole
    content: string
    token_count?: number
    response_time_ms?: number
    sequence_number: number
    created_at: string
    metadata?: Record<string, any>
  }>
}

// SessionStats는 types/analytics.ts에서 정의됨