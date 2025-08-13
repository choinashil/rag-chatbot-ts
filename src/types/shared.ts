/**
 * 여러 모듈에서 공유되는 공통 타입 정의
 * 순환 종속성을 방지하기 위해 별도 파일로 분리
 */

// HTML 문서 배치 처리 결과 타입
export interface BatchResult {
  total: number
  processed: number
  failed: number
  errors: BatchError[]
}

// 문서 수집 방식 타입
export type CollectionMethod = 'database' | 'page'

// 처리 결과에서 공통으로 사용되는 에러 타입
export interface ProcessingError {
  pageId: string
  title: string
  error: string
}

// HTML 크롤링용 에러 타입 (BatchResult에서 사용)
export interface BatchError {
  url: string
  title: string
  error: string
}

/**
 * 메시지 역할 타입
 */
export type MessageRole = 'user' | 'assistant' | 'system'

/**
 * 비즈니스 메타데이터 (공통)
 */
export interface BusinessMetadata {
  inquiryCategory?: string | undefined      // "배송문의", "환불문의"
  satisfactionScore?: number | undefined    // 1-5 만족도
  resolutionStatus?: string | undefined     // "해결됨", "미해결"
  storeTier?: string | undefined           // "프리미엄", "베이직"
  topicTags?: string[] | undefined         // ["결제", "배송", "환불"]
  priority?: string | undefined            // "긴급", "보통", "낮음"
  retrievedDocsCount?: number | undefined  // 검색된 문서 수
  relevanceScore?: number | undefined      // 검색 관련성 점수
}

/**
 * 기본 채팅 상호작용 데이터
 */
export interface BaseChatInteraction {
  sessionId: string
  userMessage: string
  assistantResponse: string
  tokenUsage?: number | undefined
  responseTimeMs?: number | undefined
  langsmithTraceId?: string | undefined
}
