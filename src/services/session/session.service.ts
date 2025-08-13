/**
 * 세션 관리 서비스
 * 채팅 세션의 CRUD 및 생명주기 관리
 */

import { Pool, PoolClient } from 'pg'
import { v4 as uuidv4 } from 'uuid'
import { withTransaction } from '../../config/database'
import type { SessionData, MessageData } from '../../types/session'

export class SessionService {
  constructor(private pool: Pool) {}

  /**
   * 새 세션 생성
   */
  async createSession(sessionData: SessionData): Promise<string> {
    const sessionId = uuidv4()
    
    await withTransaction(this.pool, async (client: PoolClient) => {
      await client.query(`
        INSERT INTO chat_sessions (
          id, store_id, user_id, metadata
        ) VALUES ($1, $2, $3, $4)
      `, [
        sessionId,
        sessionData.storeId,
        sessionData.userId,
        JSON.stringify(sessionData.metadata || {})
      ])
    })

    console.log('✅ 새 세션 생성:', { sessionId, storeId: sessionData.storeId })
    return sessionId
  }

  /**
   * 활성 세션 찾기 (같은 사용자/스토어의 최근 세션)
   */
  async findActiveSession(criteria: { storeId: string; userId: string }): Promise<{ id: string } | null> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(`
        SELECT id
        FROM chat_sessions 
        WHERE store_id = $1 AND user_id = $2 
          AND is_active = true AND deleted_at IS NULL
        ORDER BY last_active_at DESC
        LIMIT 1
      `, [criteria.storeId, criteria.userId])

      return result.rows.length > 0 ? { id: result.rows[0].id } : null
    } finally {
      client.release()
    }
  }

  /**
   * 세션 컨텍스트 조회 (최근 메시지 포함)
   */
  async getSessionContext(sessionId: string, messageLimit: number = 5): Promise<{
    session: any
    recentMessages: any[]
  }> {
    const client = await this.pool.connect()
    
    try {
      // 세션 정보 조회
      const sessionResult = await client.query(`
        SELECT id, store_id, user_id, created_at, metadata
        FROM chat_sessions 
        WHERE id = $1 AND is_active = true AND deleted_at IS NULL
      `, [sessionId])

      if (sessionResult.rows.length === 0) {
        throw new Error(`세션을 찾을 수 없습니다: ${sessionId}`)
      }

      // 최근 메시지 조회 (sequence_number 순서로)
      const messagesResult = await client.query(`
        SELECT id, role, content, token_count, response_time_ms, 
                sequence_number, created_at, metadata
        FROM chat_messages 
        WHERE session_id = $1 AND is_deleted = false
        ORDER BY sequence_number DESC
        LIMIT $2
      `, [sessionId, messageLimit])

      return {
        session: sessionResult.rows[0],
        recentMessages: messagesResult.rows.reverse() // 시간순 정렬
      }
    } finally {
      client.release()
    }
  }

  /**
   * 메시지 저장 (sequence_number 자동 생성)
   */
  async saveMessage(messageData: MessageData): Promise<string> {
    const messageId = uuidv4()
    
    return await withTransaction(this.pool, async (client: PoolClient) => {
      // 세션 활성화 시간 업데이트
      await this.updateSessionActivity(client, messageData.sessionId)

      // 메시지 저장
      const result = await client.query(`
        INSERT INTO chat_messages (
          id, session_id, role, content, token_count, response_time_ms,
          langsmith_trace_id, parent_message_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        messageId,
        messageData.sessionId,
        messageData.role,
        messageData.content,
        messageData.tokenCount,
        messageData.responseTimeMs,
        messageData.langsmithTraceId,
        messageData.parentMessageId,
        JSON.stringify(messageData.metadata || {})
      ])

      return result.rows[0].id
    })
  }

  /**
   * 세션 활성화 시간 업데이트
   */
  private async updateSessionActivity(client: PoolClient, sessionId: string): Promise<void> {
    await client.query(`
      UPDATE chat_sessions 
      SET last_active_at = NOW() 
      WHERE id = $1
    `, [sessionId])
  }

  /**
   * 만료된 세션 정리
   */
  async cleanupExpiredSessions(): Promise<number> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(`
        SELECT cleanup_expired_sessions() as cleaned_count
      `)
      
      const cleanedCount = result.rows[0].cleaned_count
      console.log(`🧹 만료된 세션 정리 완료: ${cleanedCount}개`)
      
      return cleanedCount
    } finally {
      client.release()
    }
  }

  /**
   * 완전 삭제 (90일 후)
   */
  async hardDeleteOldData(): Promise<number> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(`
        SELECT hard_delete_old_data() as deleted_count
      `)
      
      const deletedCount = result.rows[0].deleted_count
      console.log(`🗑️ 오래된 데이터 완전 삭제: ${deletedCount}개`)
      
      return deletedCount
    } finally {
      client.release()
    }
  }
}