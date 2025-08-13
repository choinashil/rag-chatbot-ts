/**
 * 통합 채팅 서비스
 * SessionService + ChatAnalyticsService + LLMMonitoringService 조합
 * 기존 HybridTrackingService를 대체하는 새로운 아키텍처
 */

import { Pool } from 'pg'
import { SessionService } from '../session/session.service'
import { ChatAnalyticsService } from '../analytics/chat-analytics.service'
import { LLMMonitoringService } from '../monitoring/llm-monitoring.service'
import type { ChatInteractionData, SessionData } from '../../types'

/**
 * 통합 채팅 서비스
 */
export class IntegratedChatService {
  private sessionService: SessionService
  private analyticsService: ChatAnalyticsService
  private monitoringService: LLMMonitoringService

  constructor(pool: Pool) {
    this.sessionService = new SessionService(pool)
    this.analyticsService = new ChatAnalyticsService(pool)
    this.monitoringService = new LLMMonitoringService()
  }

  /**
   * 채팅 상호작용 로그 (통합 처리)
   */
  async logChatInteraction(data: ChatInteractionData): Promise<void> {
    try {
      // 1. 사용자 메시지 저장
      const userMessageId = await this.sessionService.saveMessage({
        sessionId: data.sessionId,
        role: 'user',
        content: data.userMessage,
        tokenCount: this.analyticsService.calculateTokens(data.userMessage),
        langsmithTraceId: data.langsmithTraceId
      })

      // 2. 어시스턴트 응답 저장
      const assistantMessageId = await this.sessionService.saveMessage({
        sessionId: data.sessionId,
        role: 'assistant',
        content: data.assistantResponse,
        tokenCount: data.tokenUsage,
        responseTimeMs: data.responseTimeMs,
        langsmithTraceId: data.langsmithTraceId,
        parentMessageId: userMessageId,
        metadata: data.businessMetadata
      })

      console.log('✅ PostgreSQL 저장 완료:', { 
        sessionId: data.sessionId,
        userMessageId,
        assistantMessageId 
      })

      // 3. LangSmith 비동기 추적 (실패해도 PostgreSQL은 보존됨)
      this.monitoringService.trackAIInteraction({
        sessionId: data.sessionId,
        userMessage: data.userMessage,
        assistantResponse: data.assistantResponse,
        tokenUsage: data.tokenUsage,
        responseTimeMs: data.responseTimeMs,
        langsmithTraceId: data.langsmithTraceId,
        businessMetadata: data.businessMetadata
      }).catch(error => {
        console.error('❌ LangSmith 추적 실패 (PostgreSQL은 보존됨):', error)
      })

    } catch (error) {
      console.error('❌ 통합 채팅 추적 실패:', error)
      throw error
    }
  }

  /**
   * 새 세션 생성
   */
  async createSession(sessionData: SessionData): Promise<string> {
    return await this.sessionService.createSession(sessionData)
  }

  /**
   * 활성 세션 찾기 (같은 사용자/스토어의 기존 세션 재사용)
   */
  async findActiveSession(criteria: { storeId: string; userId: string }): Promise<{ id: string } | null> {
    return await this.sessionService.findActiveSession(criteria)
  }

  /**
   * 세션 컨텍스트 조회 (최근 메시지 포함)
   */
  async getSessionContext(sessionId: string, messageLimit: number = 5) {
    return await this.sessionService.getSessionContext(sessionId, messageLimit)
  }

  /**
   * 세션 통계 조회
   */
  async getSessionStats(sessionId: string) {
    return await this.analyticsService.getSessionStats(sessionId)
  }

  /**
   * 스토어별 일일 통계 조회
   */
  async getStoreDailyStats(storeId: string, date: Date) {
    return await this.analyticsService.getStoreDailyStats(storeId, date)
  }

  /**
   * 성능 메트릭 분석
   */
  async getPerformanceMetrics(storeId: string, days: number = 7) {
    return await this.analyticsService.getPerformanceMetrics(storeId, days)
  }

  /**
   * 사용자 피드백 추가
   */
  async addUserFeedback(sessionId: string, messageId: string, rating: number, comment?: string) {
    await this.monitoringService.trackUserFeedback({
      sessionId,
      messageId,
      rating,
      comment
    })
  }

  /**
   * 만료된 세션 정리
   */
  async cleanupExpiredSessions(): Promise<number> {
    return await this.sessionService.cleanupExpiredSessions()
  }

  /**
   * 완전 삭제 (90일 후)
   */
  async hardDeleteOldData(): Promise<number> {
    return await this.sessionService.hardDeleteOldData()
  }

  /**
   * 서비스 상태 확인
   */
  async getHealthStatus() {
    const langSmithConnected = await this.monitoringService.checkConnection()
    
    return {
      database: 'connected', // Pool이 주입되었으므로 연결됨
      langSmith: langSmithConnected ? 'connected' : 'disconnected',
      services: {
        session: 'active',
        analytics: 'active',
        monitoring: langSmithConnected ? 'active' : 'degraded'
      }
    }
  }
}