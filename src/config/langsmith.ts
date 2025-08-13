/**
 * LangSmith 설정 및 추적 시스템
 * Stage 1: 세션 기반 모니터링 인프라 구축
 */

import { Client as LangSmithClient } from 'langsmith'
import { RunTree } from 'langsmith'

/**
 * LangSmith 클라이언트 설정
 */
export const createLangSmithClient = (): LangSmithClient => {
  const apiKey = process.env.LANGSMITH_API_KEY
  if (!apiKey) {
    throw new Error('LANGSMITH_API_KEY가 설정되지 않았습니다')
  }

  const client = new LangSmithClient({
    apiKey,
    apiUrl: process.env.LANGSMITH_ENDPOINT || 'https://api.smith.langchain.com'
  })

  console.log('✅ LangSmith 클라이언트 초기화 완료:', {
    project: process.env.LANGSMITH_PROJECT_NAME,
    endpoint: process.env.LANGSMITH_ENDPOINT
  })

  return client
}

/**
 * LangSmith 연결 상태 확인
 */
export const checkLangSmithConnection = async (client: LangSmithClient): Promise<boolean> => {
  try {
    const projectName = process.env.LANGSMITH_PROJECT_NAME
    if (!projectName) {
      throw new Error('LANGSMITH_PROJECT_NAME이 설정되지 않았습니다')
    }
    
    // 프로젝트 존재 확인
    await client.readProject({ projectName })
    console.log('✅ LangSmith 연결 성공')
    return true
  } catch (error) {
    console.error('❌ LangSmith 연결 실패:', error)
    return false
  }
}

/**
 * 세션 기반 RunTree 생성
 * 세션별 추적을 위한 메타데이터 포함
 */
export const createSessionRunTree = (sessionId: string, operation: string): RunTree => {
  const projectName = process.env.LANGSMITH_PROJECT_NAME
  if (!projectName) {
    throw new Error('LANGSMITH_PROJECT_NAME이 설정되지 않았습니다')
  }

  return new RunTree({
    name: operation,
    run_type: 'chain',
    project_name: projectName,
    extra: {
      metadata: {
        session_id: sessionId,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      }
    }
  })
}

/**
 * 에러 추적용 RunTree 생성
 */
export const createErrorRunTree = (sessionId: string, error: Error): RunTree => {
  const projectName = process.env.LANGSMITH_PROJECT_NAME
  if (!projectName) {
    throw new Error('LANGSMITH_PROJECT_NAME이 설정되지 않았습니다')
  }

  return new RunTree({
    name: 'error_tracking',
    run_type: 'chain',
    project_name: projectName,
    extra: {
      metadata: {
        session_id: sessionId,
        error_name: error.name,
        error_message: error.message,
        error_stack: error.stack || '',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      }
    }
  })
}

/**
 * RAG 응답 품질 메트릭 추적
 */
export interface RAGMetrics {
  question: string
  retrievedDocsCount: number
  responseTimeMs: number
  tokenUsage: number
  relevanceScore?: number | undefined
  satisfactionScore?: number | undefined
}

export const trackRAGMetrics = async (
  client: LangSmithClient,
  sessionId: string,
  metrics: RAGMetrics
): Promise<void> => {
  try {
    const runTree = createSessionRunTree(sessionId, 'rag_response')
    
    await runTree.end({
      inputs: { question: metrics.question },
      outputs: { 
        retrieved_docs_count: metrics.retrievedDocsCount,
        response_time_ms: metrics.responseTimeMs,
        token_usage: metrics.tokenUsage,
        relevance_score: metrics.relevanceScore,
        satisfaction_score: metrics.satisfactionScore
      }
    })

    console.log('📊 RAG 메트릭 추적 완료:', { sessionId, responseTime: metrics.responseTimeMs })
  } catch (error) {
    console.error('❌ RAG 메트릭 추적 실패:', error)
    // LangSmith 실패가 RAG 서비스를 중단시키면 안 됨
  }
}

/**
 * 사용자 피드백 추적
 */
export interface UserFeedback {
  sessionId: string
  messageId: string
  rating: number // 1-5
  comment?: string | undefined
  category?: string | undefined
}

export const trackUserFeedback = async (
  client: LangSmithClient,
  feedback: UserFeedback
): Promise<void> => {
  try {
    const runTree = createSessionRunTree(feedback.sessionId, 'user_feedback')
    
    await runTree.end({
      inputs: { message_id: feedback.messageId },
      outputs: { 
        rating: feedback.rating,
        comment: feedback.comment,
        category: feedback.category
      }
    })

    console.log('💬 사용자 피드백 추적 완료:', { 
      sessionId: feedback.sessionId, 
      rating: feedback.rating 
    })
  } catch (error) {
    console.error('❌ 사용자 피드백 추적 실패:', error)
  }
}

/**
 * LangSmith 설정 검증
 */
export const validateLangSmithConfig = (): boolean => {
  const requiredEnvVars = [
    'LANGSMITH_API_KEY',
    'LANGSMITH_PROJECT_NAME'
  ]

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

  if (missingVars.length > 0) {
    console.error('❌ LangSmith 설정 누락:', missingVars)
    return false
  }

  console.log('✅ LangSmith 설정 검증 완료')
  return true
}

// 기본 LangSmith 클라이언트 인스턴스 (지연 초기화)
let _langSmithClient: LangSmithClient | null = null

export const getLangSmithClient = (): LangSmithClient => {
  if (!_langSmithClient) {
    _langSmithClient = createLangSmithClient()
  }
  return _langSmithClient
}