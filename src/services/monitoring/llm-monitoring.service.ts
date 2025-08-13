/**
 * LLM 모니터링 서비스
 * LangSmith 연동 및 AI 워크플로우 추적
 */

import { getLangSmithClient, trackRAGMetrics, trackUserFeedback, RAGMetrics, UserFeedback } from '../../config/langsmith'
import type { AIMonitoringData } from '../../types/analytics'

export class LLMMonitoringService {
  /**
   * AI 상호작용 추적 (LangSmith)
   */
  async trackAIInteraction(data: AIMonitoringData): Promise<void> {
    try {
      if (!data.businessMetadata) {
        console.log('⚠️ 비즈니스 메타데이터 없음 - LangSmith 추적 건너뜀')
        return
      }

      const ragMetrics: RAGMetrics = {
        question: data.userMessage,
        retrievedDocsCount: data.businessMetadata.retrievedDocsCount || 0,
        responseTimeMs: data.responseTimeMs || 0,
        tokenUsage: data.tokenUsage || 0,
        relevanceScore: data.businessMetadata.relevanceScore || undefined,
        satisfactionScore: data.businessMetadata.satisfactionScore || undefined
      }

      await trackRAGMetrics(getLangSmithClient(), data.sessionId, ragMetrics)
      console.log('✅ LangSmith AI 추적 완료:', { 
        sessionId: data.sessionId, 
        responseTime: data.responseTimeMs 
      })

    } catch (error) {
      // LangSmith 실패는 전체 서비스를 중단시키지 않음
      console.error('❌ LangSmith AI 추적 실패:', error)
    }
  }

  /**
   * 사용자 피드백 추적
   */
  async trackUserFeedback(feedback: UserFeedback): Promise<void> {
    try {
      await trackUserFeedback(getLangSmithClient(), feedback)
      console.log('✅ 사용자 피드백 추적 완료:', { 
        sessionId: feedback.sessionId, 
        rating: feedback.rating 
      })

    } catch (error) {
      console.error('❌ 사용자 피드백 추적 실패:', error)
    }
  }

  /**
   * 에러 추적 (LangSmith)
   */
  async trackError(sessionId: string, error: Error, context?: Record<string, any>): Promise<void> {
    try {
      const { createErrorRunTree } = await import('../../config/langsmith')
      const runTree = createErrorRunTree(sessionId, error)
      
      if (context) {
        runTree.extra = { 
          ...runTree.extra, 
          context 
        }
      }

      await runTree.end()
      console.log('✅ 에러 추적 완료:', { sessionId, error: error.message })

    } catch (trackingError) {
      console.error('❌ 에러 추적 실패:', trackingError)
    }
  }

  /**
   * 배치 메트릭 전송 (여러 상호작용을 한 번에)
   */
  async trackBatchInteractions(interactions: AIMonitoringData[]): Promise<void> {
    const promises = interactions.map(data => 
      this.trackAIInteraction(data).catch(error => {
        console.error('배치 추적 중 개별 실패:', { sessionId: data.sessionId, error })
        return null // 개별 실패는 무시하고 계속 진행
      })
    )

    await Promise.allSettled(promises)
    console.log(`📊 배치 AI 추적 완료: ${interactions.length}개 상호작용`)
  }

  /**
   * LangSmith 연결 상태 확인
   */
  async checkConnection(): Promise<boolean> {
    try {
      const { checkLangSmithConnection } = await import('../../config/langsmith')
      return await checkLangSmithConnection(getLangSmithClient())
    } catch (error) {
      console.error('❌ LangSmith 연결 확인 실패:', error)
      return false
    }
  }
}