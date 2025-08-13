/**
 * 채팅 분석 서비스
 * 메시지 통계, 성능 메트릭, 비즈니스 분석
 */

import { Pool } from 'pg'
import type { SessionStats, ChatAnalyticsData, StoreDailyStats, PerformanceMetrics } from '../../types/analytics'

export class ChatAnalyticsService {
  constructor(private pool: Pool) {}

  /**
   * 세션 통계 조회
   */
  async getSessionStats(sessionId: string): Promise<SessionStats> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(`
        SELECT 
          COUNT(*) as message_count,
          SUM(token_count) as total_tokens,
          AVG(response_time_ms) as avg_response_time,
          s.last_active_at
        FROM chat_messages m
        JOIN chat_sessions s ON m.session_id = s.id
        WHERE m.session_id = $1 AND m.is_deleted = false
        GROUP BY s.last_active_at
      `, [sessionId])

      if (result.rows.length === 0) {
        return {
          messageCount: 0,
          totalTokens: 0,
          avgResponseTime: 0,
          lastActiveAt: new Date()
        }
      }

      const stats = result.rows[0]
      return {
        messageCount: parseInt(stats.message_count),
        totalTokens: parseInt(stats.total_tokens) || 0,
        avgResponseTime: parseFloat(stats.avg_response_time) || 0,
        lastActiveAt: stats.last_active_at
      }
    } finally {
      client.release()
    }
  }

  /**
   * 스토어별 일일 통계 조회
   */
  async getStoreDailyStats(storeId: string, date: Date): Promise<StoreDailyStats> {
    const client = await this.pool.connect()
    
    try {
      // 기본 통계
      const statsResult = await client.query(`
        SELECT 
          COUNT(DISTINCT s.id) as session_count,
          COUNT(m.id) as message_count,
          SUM(m.token_count) as total_tokens,
          AVG(m.response_time_ms) as avg_response_time
        FROM chat_sessions s
        LEFT JOIN chat_messages m ON s.id = m.session_id AND m.is_deleted = false
        WHERE s.store_id = $1 
          AND DATE(s.created_at) = DATE($2)
          AND s.deleted_at IS NULL
      `, [storeId, date])

      // 카테고리별 집계 (메타데이터 분석)
      const categoryResult = await client.query(`
        SELECT 
          metadata->>'inquiryCategory' as category,
          COUNT(*) as count
        FROM chat_messages m
        JOIN chat_sessions s ON m.session_id = s.id
        WHERE s.store_id = $1 
          AND DATE(m.created_at) = DATE($2)
          AND m.is_deleted = false
          AND m.metadata->>'inquiryCategory' IS NOT NULL
        GROUP BY metadata->>'inquiryCategory'
        ORDER BY count DESC
        LIMIT 10
      `, [storeId, date])

      const stats = statsResult.rows[0]
      return {
        sessionCount: parseInt(stats.session_count) || 0,
        messageCount: parseInt(stats.message_count) || 0,
        totalTokens: parseInt(stats.total_tokens) || 0,
        avgResponseTime: parseFloat(stats.avg_response_time) || 0,
        topCategories: categoryResult.rows.map(row => ({
          category: row.category,
          count: parseInt(row.count)
        }))
      }
    } finally {
      client.release()
    }
  }

  /**
   * 성능 메트릭 분석
   */
  async getPerformanceMetrics(storeId: string, days: number = 7): Promise<PerformanceMetrics> {
    const client = await this.pool.connect()
    
    try {
      const result = await client.query(`
        SELECT 
          AVG(m.response_time_ms) as avg_response_time,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m.response_time_ms) as p50_response_time,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.response_time_ms) as p95_response_time,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY m.response_time_ms) as p99_response_time,
          AVG(m.token_count) as avg_tokens,
          SUM(m.token_count) as total_tokens,
          COUNT(CASE WHEN m.metadata->>'error' IS NOT NULL THEN 1 END) as error_count,
          COUNT(*) as total_messages
        FROM chat_messages m
        JOIN chat_sessions s ON m.session_id = s.id
        WHERE s.store_id = $1 
          AND m.created_at >= NOW() - INTERVAL '$2 days'
          AND m.is_deleted = false
          AND s.deleted_at IS NULL
      `, [storeId, days])

      const stats = result.rows[0]
      const totalMessages = parseInt(stats.total_messages) || 1
      const errorCount = parseInt(stats.error_count) || 0

      return {
        avgResponseTime: parseFloat(stats.avg_response_time) || 0,
        responseTimePercentiles: {
          p50: parseFloat(stats.p50_response_time) || 0,
          p95: parseFloat(stats.p95_response_time) || 0,
          p99: parseFloat(stats.p99_response_time) || 0
        },
        tokenUsageStats: {
          avg: parseFloat(stats.avg_tokens) || 0,
          total: parseInt(stats.total_tokens) || 0
        },
        errorRate: (errorCount / totalMessages) * 100
      }
    } finally {
      client.release()
    }
  }

  /**
   * 간단한 토큰 계산 (OpenAI API 응답이 없을 때 사용)
   */
  calculateTokens(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0
    }
    // 대략적인 토큰 계산 (단어 수 * 1.3)
    return Math.ceil(text.split(/\s+/).length * 1.3)
  }
}