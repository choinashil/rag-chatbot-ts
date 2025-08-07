// 임베딩 생성 서비스 - 간단한 기본 구현
import type { EmbeddingResult } from '../../types/embedding'
import { OpenAIClient } from './openai.client'
import { EMBEDDING_MODEL, MAX_TEXT_LENGTH } from '../../constants/embedding.constants'

/**
 * 임베딩 생성을 담당하는 서비스 클래스 (간단한 기본 구현)
 */
export class EmbeddingService {
  private openaiClient: OpenAIClient
  private model = EMBEDDING_MODEL
  private maxTextLength = MAX_TEXT_LENGTH

  constructor(openaiClient: OpenAIClient) {
    this.openaiClient = openaiClient
  }

  /**
   * 텍스트를 임베딩 벡터로 변환
   */
  async createEmbedding(text: string, id?: string): Promise<EmbeddingResult> {
    // 간단한 길이 체크 (문자 수 기반)
    if (text.length > this.maxTextLength) {
      throw new Error(`텍스트가 너무 깁니다 (${text.length}자). 최대 ${this.maxTextLength}자까지 지원됩니다.`)
    }

    if (!text.trim()) {
      throw new Error('빈 텍스트는 임베딩할 수 없습니다')
    }

    try {
      const client = this.openaiClient.getClient()
      const response = await client.embeddings.create({
        model: this.model,
        input: text,
        encoding_format: 'float'
      })

      const result: EmbeddingResult = {
        embedding: response.data[0]!.embedding,
        tokenCount: response.usage?.total_tokens || 0,
        model: response.model,
        text,
        ...(id && { id })
      }

      console.log(`임베딩 생성 완료: ${result.tokenCount} 토큰, 모델: ${result.model}`)
      return result
    } catch (error) {
      console.error('임베딩 생성 실패:', error)
      throw new Error(`임베딩 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  /**
   * 서비스 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    return this.openaiClient.checkConnection()
  }
}