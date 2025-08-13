/**
 * 모니터링 서비스
 * AI/LLM 시스템의 관찰 가능성 및 성능 모니터링
 */

export class MonitoringService {
  private isInitialized: boolean = false

  constructor() {
    this.initializeTracking()
  }

  /**
   * 모니터링 시스템 초기화 확인
   * 
   * 주의: LangSmith 서비스를 사용하지만 환경변수는 LANGCHAIN_XX 형식 사용
   * LangChain의 자동 LangSmith 통합 기능이 해당 변수명을 요구하기 때문
   */
  private initializeTracking(): void {
    const tracingEnabled = process.env.LANGCHAIN_TRACING_V2
    const apiKey = process.env.LANGCHAIN_API_KEY
    const project = process.env.LANGCHAIN_PROJECT

    this.isInitialized = tracingEnabled === 'true' && !!apiKey && !!project

    if (this.isInitialized) {
      console.log('✅ AI 모니터링 활성화됨')
    } else {
      console.log('⚠️  AI 모니터링 비활성화됨')
    }
  }

  /**
   * 모니터링 활성화 여부 확인
   */
  public isMonitoringEnabled(): boolean {
    return this.isInitialized
  }

  /**
   * 모니터링 설정 정보 반환
   */
  public getMonitoringConfig() {
    return {
      enabled: this.isInitialized,
      project: process.env.LANGCHAIN_PROJECT,
      endpoint: process.env.LANGCHAIN_ENDPOINT || 'https://api.smith.langchain.com'
    }
  }

  /**
   * AI 상호작용 추적
   */
  public async trackAIInteraction(data: any): Promise<void> {
    if (!this.isInitialized) {
      return // 모니터링 비활성화 시 무시
    }

    try {
      // LangSmith는 LangChain 체인 실행 시 자동으로 추적됨
      // 여기서는 추가적인 메타데이터나 커스텀 추적만 처리
      console.log('📊 AI 상호작용 추적:', {
        sessionId: data.sessionId,
        responseTime: `${data.responseTimeMs}ms`,
        tokenUsage: data.tokenUsage
      })
    } catch (error) {
      console.error('모니터링 추적 실패:', error)
    }
  }

  /**
   * 사용자 피드백 추적
   */
  public async trackUserFeedback(data: {
    sessionId: string;
    messageId: string;
    rating: number;
    comment?: string | undefined;
  }): Promise<void> {
    if (!this.isInitialized) {
      return // 모니터링 비활성화 시 무시
    }

    try {
      console.log('📝 사용자 피드백 추적:', {
        sessionId: data.sessionId,
        rating: data.rating,
        hasComment: !!data.comment
      })
    } catch (error) {
      console.error('피드백 추적 실패:', error)
    }
  }

  /**
   * 모니터링 연결 상태 확인
   */
  public async checkConnection(): Promise<boolean> {
    if (!this.isInitialized) {
      return false
    }

    try {
      // LangSmith 연결 상태 확인
      // 실제 구현에서는 API 호출로 연결 상태를 확인할 수 있음
      return true
    } catch (error) {
      console.error('모니터링 연결 확인 실패:', error)
      return false
    }
  }
}