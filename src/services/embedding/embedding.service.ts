// 임베딩 생성 서비스 - LangChain OpenAIEmbeddings 기반 구현
import { OpenAIEmbeddings } from '@langchain/openai'
import type { EmbeddingResult } from '../../types/embedding'
import { EMBEDDING_MODEL, MAX_TEXT_LENGTH } from '../../constants/embedding.constants'
import { createOpenAIConfig } from '../../config/openai'

/**
 * 임베딩 생성을 담당하는 서비스 클래스 (LangChain 기반)
 * 기존 인터페이스를 유지하면서 내부적으로 LangChain OpenAIEmbeddings 사용
 */
export class EmbeddingService {
  private embeddings: OpenAIEmbeddings
  private model = EMBEDDING_MODEL
  private maxTextLength = MAX_TEXT_LENGTH

  constructor() {
    const openaiConfig = createOpenAIConfig()

    this.embeddings = new OpenAIEmbeddings({
      apiKey: openaiConfig.apiKey,
      model: openaiConfig.models.embedding,
      batchSize: 512, // OpenAI API 기본값
      stripNewLines: true, // 줄바꿈 문자 제거
    })
  }

  /**
   * 텍스트를 임베딩 벡터로 변환
   * 기존 EmbeddingResult 인터페이스를 유지하는 어댑터 패턴
   */
  async createEmbedding(text: string, id?: string): Promise<EmbeddingResult> {
    // 입력 유효성 검사
    if (text.length > this.maxTextLength) {
      throw new Error(`텍스트가 너무 깁니다 (${text.length}자). 최대 ${this.maxTextLength}자까지 지원됩니다.`)
    }

    if (!text.trim()) {
      throw new Error('빈 텍스트는 임베딩할 수 없습니다')
    }

    try {
      // LangChain OpenAIEmbeddings 사용
      const embeddings = await this.embeddings.embedDocuments([text])
      const embedding = embeddings[0]

      if (!embedding) {
        throw new Error('임베딩 생성 결과가 비어있습니다')
      }

      // 토큰 수 추정 (정확한 값은 LangChain에서 제공하지 않음)
      const estimatedTokenCount = Math.ceil(text.length / 4) // 대략적 추정

      const result: EmbeddingResult = {
        embedding,
        tokenCount: estimatedTokenCount,
        model: this.model,
        text,
        ...(id && { id })
      }

      console.log(`        🧠 임베딩 생성 완료: ${result.tokenCount} 토큰`)
      return result
    } catch (error) {
      console.error('임베딩 생성 실패:', error)
      throw new Error(`임베딩 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  /**
   * 서비스 상태 확인
   * LangChain에는 직접적인 연결 확인 메서드가 없으므로 테스트 임베딩으로 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.embeddings.embedDocuments(['test'])
      return true
    } catch (error) {
      console.error('임베딩 서비스 상태 확인 실패:', error)
      return false
    }
  }
}