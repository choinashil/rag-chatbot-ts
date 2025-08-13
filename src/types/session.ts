/**
 * 세션 관리 관련 타입 정의
 */

import { MessageRole } from './shared'

/**
 * 세션 데이터
 */
export interface SessionData {
  id?: string
  storeId: string
  userId: string
  metadata?: Record<string, any> | undefined
}

/**
 * 메시지 데이터
 */
export interface MessageData {
  sessionId: string
  role: MessageRole
  content: string
  tokenCount?: number | undefined
  responseTimeMs?: number | undefined
  langsmithTraceId?: string | undefined
  parentMessageId?: string | undefined
  metadata?: Record<string, any> | undefined
}