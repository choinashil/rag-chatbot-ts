/**
 * LLM 모니터링 서비스
 * LangSmith 연동 및 AI 워크플로우 추적 (권장 방법 사용)
 * 
 * 주의: LangChain 자동 추적을 사용하는 경우 이 서비스는 불필요할 수 있습니다.
 * LangChain의 자동 LangSmith 통합이 대부분의 추적을 처리합니다.
 */

import { traceable } from 'langsmith/traceable'
import { Client } from 'langsmith'
import type { UserFeedback } from '../../config/langsmith'
import type { AIMonitoringData } from '../../types/analytics'

// LangSmith 클라이언트 인스턴스 (수동 추적용)
// 주의: LANGCHAIN_XX 환경변수를 사용 (LangChain 통합과 일관성 유지)
const getLangSmithClient = (): Client | null => {
  if (process.env.LANGCHAIN_TRACING_V2 !== 'true' || !process.env.LANGCHAIN_API_KEY) {
    return null
  }
  
  return new Client({
    apiKey: process.env.LANGCHAIN_API_KEY,
  })
}

interface RAGMetrics {
  question: string
  retrievedDocsCount: number
  responseTimeMs: number
  tokenUsage: number
  relevanceScore?: number
  satisfactionScore?: number
}


export class LLMMonitoringService {
  /**
   * AI 상호작용 추적 (LangSmith - 권장 방법)
   */
  trackAIInteraction = traceable(
    async (data: AIMonitoringData): Promise<void> => {
      try {
        if (!data.businessMetadata) {
          console.log('⚠️ 비즈니스 메타데이터 없음 - LangSmith 추적 건너뜀')
          return
        }

        const client = getLangSmithClient()
        if (!client) {
          console.log('⚠️ LangSmith 클라이언트 없음 - 추적 건너뜀')
          return
        }

        // 메트릭 정보를 LangSmith에 전송 (자동으로 현재 trace에 추가됨)
        console.log('✅ LangSmith AI 추적 완료:', { 
          sessionId: data.sessionId, 
          responseTime: data.responseTimeMs,
          tokenUsage: data.tokenUsage,
          retrievedDocs: data.businessMetadata.retrievedDocsCount
        })

      } catch (error) {
        // LangSmith 실패는 전체 서비스를 중단시키지 않음
        console.error('❌ LangSmith AI 추적 실패:', error)
      }
    },
    {
      name: 'track_ai_interaction',
      run_type: 'tool'
    }
  )

  /**
   * 사용자 피드백 추적 (권장 방법)
   */
  trackUserFeedback = traceable(
    async (feedback: UserFeedback): Promise<void> => {
      try {
        const client = getLangSmithClient()
        if (!client) {
          console.log('⚠️ LangSmith 클라이언트 없음 - 피드백 추적 건너뜀')
          return
        }

        // 피드백 정보는 자동으로 현재 trace에 추가됨
        console.log('✅ 사용자 피드백 추적 완료:', { 
          sessionId: feedback.sessionId, 
          rating: feedback.rating 
        })

      } catch (error) {
        console.error('❌ 사용자 피드백 추적 실패:', error)
      }
    },
    {
      name: 'track_user_feedback',
      run_type: 'tool'
    }
  )

  /**
   * 에러 추적 (권장 방법)
   */
  trackError = traceable(
    async (sessionId: string, error: Error, context?: Record<string, any>): Promise<void> => {
      try {
        const client = getLangSmithClient()
        if (!client) {
          console.log('⚠️ LangSmith 클라이언트 없음 - 에러 추적 건너뜀')
          return
        }

        // 에러 정보는 자동으로 현재 trace에 추가됨
        // @traceable이 자동으로 에러를 캐치하고 trace에 기록함
        throw error // 에러를 다시 던져서 LangSmith가 자동으로 추적하도록 함

      } catch (trackingError) {
        console.error('❌ 에러 추적 완료:', { sessionId, error: error.message, context })
        throw trackingError // 원본 에러를 유지
      }
    },
    {
      name: 'track_error',
      run_type: 'tool'
    }
  )

  /**
   * 배치 메트릭 전송 (권장 방법)
   */
  trackBatchInteractions = traceable(
    async (interactions: AIMonitoringData[]): Promise<void> => {
      const promises = interactions.map(data => 
        this.trackAIInteraction(data).catch(error => {
          console.error('배치 추적 중 개별 실패:', { sessionId: data.sessionId, error })
          return null // 개별 실패는 무시하고 계속 진행
        })
      )

      await Promise.allSettled(promises)
      console.log(`📊 배치 AI 추적 완료: ${interactions.length}개 상호작용`)
    },
    {
      name: 'track_batch_interactions',
      run_type: 'tool'
    }
  )

  /**
   * LangSmith 연결 상태 확인
   */
  async checkConnection(): Promise<boolean> {
    try {
      const client = getLangSmithClient()
      if (!client) {
        return false
      }
      
      // 간단한 API 호출로 연결 상태 확인
      await client.readProject({ projectName: process.env.LANGCHAIN_PROJECT || 'default' })
      return true
      
    } catch (error) {
      console.error('❌ LangSmith 연결 확인 실패:', error)
      return false
    }
  }
}