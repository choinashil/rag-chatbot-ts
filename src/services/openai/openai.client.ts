// OpenAI 클라이언트 래퍼
import OpenAI from 'openai'
import type { OpenAIConfig, OpenAIServiceStatus } from '../../types/openai'
import { validateOpenAIConfig } from '../../config/openai'

/**
 * OpenAI 클라이언트 래퍼 클래스
 * OpenAI API 연결 및 기본 기능을 관리합니다.
 */
export class OpenAIClient {
  private client: OpenAI
  private config: OpenAIConfig
  private status: OpenAIServiceStatus

  constructor(config: OpenAIConfig) {
    validateOpenAIConfig(config)
    
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey,
      organization: config.organization,
      timeout: config.timeout,
      maxRetries: config.maxRetries
    })

    this.status = {
      connected: false,
      lastCheck: null,
      modelsAvailable: [],
      metadata: {
        currentModel: config.models.embedding
      }
    }

    // organization은 선택적 속성이므로 값이 있을 때만 추가
    if (config.organization) {
      this.status.metadata!.organization = config.organization
    }
  }

  /**
   * OpenAI API 연결 상태 확인
   */
  async checkConnection(): Promise<boolean> {
    try {
      // 간단한 API 호출로 연결 상태 확인
      const models = await this.client.models.list()
      
      this.status.connected = true
      this.status.lastCheck = new Date()
      this.status.modelsAvailable = models.data.map(model => model.id)

      console.log('OpenAI API 연결 성공')
      return true

    } catch (error) {
      this.status.connected = false
      this.status.lastCheck = new Date()
      this.status.modelsAvailable = []

      console.error('OpenAI API 연결 실패:', error)
      return false
    }
  }

  /**
   * 현재 연결 상태 반환
   */
  getStatus(): OpenAIServiceStatus {
    return { ...this.status }
  }

  /**
   * OpenAI 클라이언트 인스턴스 반환
   */
  getClient(): OpenAI {
    return this.client
  }

  /**
   * 설정 정보 반환
   */
  getConfig(): OpenAIConfig {
    return { ...this.config }
  }

  /**
   * 초기화 메서드
   */
  async initialize(): Promise<void> {
    console.log('OpenAI 클라이언트 초기화 중...')
    
    const isConnected = await this.checkConnection()
    if (!isConnected) {
      throw new Error('OpenAI API 연결에 실패했습니다')
    }

    console.log('OpenAI 클라이언트 초기화 완료')
  }
}