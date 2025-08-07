// OpenAI 설정 관리
import { OpenAIConfig } from '../types/openai'
import { OPENAI_MODELS, OPENAI_DEFAULTS } from '../constants/openai.constants'

/**
 * OpenAI 설정 객체 생성
 * 환경변수에서 값을 읽어와서 설정 객체를 생성합니다.
 */
export function createOpenAIConfig(): OpenAIConfig {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다')
  }

  // 숫자 파싱 함수 (잘못된 값이면 기본값 사용)
  const parseIntWithDefault = (value: string | undefined, defaultValue: number): number => {
    if (!value) return defaultValue
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? defaultValue : parsed
  }

  const config: OpenAIConfig = {
    apiKey,
    timeout: parseIntWithDefault(process.env.OPENAI_TIMEOUT, OPENAI_DEFAULTS.TIMEOUT),
    maxRetries: parseIntWithDefault(process.env.OPENAI_MAX_RETRIES, OPENAI_DEFAULTS.MAX_RETRIES),
    models: {
      embedding: process.env.OPENAI_EMBEDDING_MODEL || OPENAI_MODELS.EMBEDDING,
      chat: process.env.OPENAI_CHAT_MODEL || OPENAI_MODELS.CHAT
    }
  }

  // organization은 선택적 속성이므로 값이 있을 때만 추가
  if (process.env.OPENAI_ORGANIZATION) {
    config.organization = process.env.OPENAI_ORGANIZATION
  }

  return config
}

/**
 * OpenAI 설정 검증
 * 설정값들이 올바른 형식인지 검증합니다.
 */
export function validateOpenAIConfig(config: OpenAIConfig): boolean {
  // API 키 형식 검증 (sk-로 시작하는 문자열)
  if (!config.apiKey || !config.apiKey.startsWith('sk-')) {
    throw new Error('유효하지 않은 OpenAI API 키 형식입니다')
  }

  // 타임아웃 값 검증
  if (config.timeout < 1000 || config.timeout > 300000) {
    throw new Error('타임아웃은 1초에서 5분 사이여야 합니다')
  }

  // 재시도 횟수 검증
  if (config.maxRetries < 0 || config.maxRetries > 10) {
    throw new Error('재시도 횟수는 0에서 10 사이여야 합니다')
  }

  return true
}