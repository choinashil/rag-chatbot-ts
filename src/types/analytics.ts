/**
 * 채팅 분석 관련 타입 정의
 */

import { BaseChatInteraction, BusinessMetadata } from './shared'

/**
 * 세션 통계
 */
export interface SessionStats {
  messageCount: number
  totalTokens: number
  avgResponseTime: number
  lastActiveAt: Date
}

/**
 * 채팅 상호작용 분석 데이터
 */
export interface ChatAnalyticsData extends BaseChatInteraction {
  businessMetadata?: BusinessMetadata | undefined
}

/**
 * 스토어별 일일 통계
 */
export interface StoreDailyStats {
  sessionCount: number
  messageCount: number
  totalTokens: number
  avgResponseTime: number
  topCategories: Array<{category: string, count: number}>
}

/**
 * 성능 메트릭
 */
export interface PerformanceMetrics {
  avgResponseTime: number
  responseTimePercentiles: { p50: number, p95: number, p99: number }
  tokenUsageStats: { avg: number, total: number }
  errorRate: number
}

/**
 * 채팅 상호작용 로그 데이터 (통합 인터페이스)
 */
export interface ChatInteractionData extends BaseChatInteraction {
  businessMetadata?: BusinessMetadata | undefined
}

/**
 * AI 모니터링 데이터
 */
export interface AIMonitoringData extends BaseChatInteraction {
  businessMetadata?: BusinessMetadata | undefined
}