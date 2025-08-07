// 임베딩 생성 서비스
import crypto from 'crypto'
import type { 
  EmbeddingInput, 
  EmbeddingResult, 
  BatchEmbeddingInput, 
  BatchEmbeddingResult,
  EmbeddingServiceConfig,
  EmbeddingError,
  TokenUsage 
} from '../../types/embedding'
import { OpenAIClient } from './openai.client'
import { 
  EMBEDDING_LIMITS, 
  EMBEDDING_RETRY, 
  EMBEDDING_PRICING, 
  EMBEDDING_CACHE,
  EMBEDDING_LOGGING 
} from '../../constants/embedding.constants'
import { 
  estimateTokenCount, 
  isTokenLimitExceeded, 
  splitTextIntoChunks,
  splitIntoBatches 
} from '../../utils/token.utils'

/**
 * 임베딩 생성을 담당하는 서비스 클래스
 */
export class EmbeddingService {
  private openaiClient: OpenAIClient
  private config: EmbeddingServiceConfig
  private cache: Map<string, EmbeddingResult> = new Map()
  private usage: TokenUsage = {
    totalTokens: 0,
    requestCount: 0,
    estimatedCost: 0,
    timestamp: new Date()
  }

  constructor(openaiClient: OpenAIClient, config?: Partial<EmbeddingServiceConfig>) {
    this.openaiClient = openaiClient
    this.config = {
      model: 'text-embedding-3-small',
      maxTokensPerRequest: EMBEDDING_LIMITS.MAX_TOKENS_PER_REQUEST,
      maxRetries: EMBEDDING_RETRY.DEFAULT_MAX_RETRIES,
      retryDelay: EMBEDDING_RETRY.DEFAULT_RETRY_DELAY,
      enableCache: true,
      logUsage: true,
      ...config
    }
  }

  /**
   * 단일 텍스트의 임베딩을 생성합니다
   */
  async createEmbedding(input: EmbeddingInput): Promise<EmbeddingResult> {
    console.log(`임베딩 생성 시작: ${input.text.substring(0, 50)}...`)
    
    // 캐시 확인
    if (this.config.enableCache) {
      const cached = this.getCachedEmbedding(input.text)
      if (cached) {
        console.log('캐시에서 임베딩 반환')
        return cached
      }
    }

    // 토큰 제한 확인
    if (isTokenLimitExceeded(input.text, this.config.maxTokensPerRequest)) {
      throw new Error(`텍스트가 토큰 제한(${this.config.maxTokensPerRequest})을 초과합니다`)
    }

    try {
      const client = this.openaiClient.getClient()
      const response = await this.withRetry(async () => {
        return await client.embeddings.create({
          model: this.config.model,
          input: input.text,
          encoding_format: 'float'
        })
      })

      const result: EmbeddingResult = {
        embedding: response.data[0]!.embedding,
        tokenCount: response.usage.total_tokens,
        model: response.model,
        ...(input.id && { id: input.id }),
        text: input.text
      }

      // 캐시 저장
      if (this.config.enableCache) {
        this.setCachedEmbedding(input.text, result)
      }

      // 사용량 추적
      this.updateUsage(result.tokenCount)

      console.log(`임베딩 생성 완료: ${result.embedding.length}차원, ${result.tokenCount}토큰`)
      return result

    } catch (error) {
      console.error('임베딩 생성 실패:', error)
      throw new Error(`임베딩 생성에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  /**
   * 여러 텍스트의 임베딩을 배치로 생성합니다
   */
  async createBatchEmbeddings(input: BatchEmbeddingInput): Promise<BatchEmbeddingResult> {
    console.log(`배치 임베딩 생성 시작: ${input.texts.length}개 텍스트`)

    const results: EmbeddingResult[] = []
    const errors: EmbeddingError[] = []
    let totalTokens = 0
    let requestCount = 0

    // 배치 크기로 분할
    const batchSize = input.batchSize || EMBEDDING_LIMITS.MAX_BATCH_SIZE
    const batches = splitIntoBatches(input.texts, batchSize)

    console.log(`${batches.length}개 배치로 분할하여 처리`)

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!
      console.log(`배치 ${i + 1}/${batches.length} 처리 중 (${batch.length}개 텍스트)`)

      try {
        // 배치 내에서 개별 처리 (OpenAI API는 배치를 지원하지만 에러 처리를 위해 개별 처리)
        const batchPromises = batch.map(async (textInput) => {
          try {
            const result = await this.createEmbedding(textInput)
            return { success: true, result }
          } catch (error) {
            const embeddingError: EmbeddingError = {
              text: textInput.text,
              ...(textInput.id && { id: textInput.id }),
              error: error instanceof Error ? error.message : '알 수 없는 오류',
              code: 'EMBEDDING_FAILED',
              retryable: true
            }
            return { success: false, error: embeddingError }
          }
        })

        const batchResults = await Promise.allSettled(batchPromises)
        
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              results.push(result.value.result!)
              totalTokens += result.value.result!.tokenCount
            } else {
              errors.push(result.value.error!)
            }
          } else {
            errors.push({
              text: 'Unknown',
              error: result.reason,
              code: 'BATCH_FAILED',
              retryable: false
            })
          }
        })

        requestCount++

        // 배치 간 지연 (Rate Limit 방지)
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

      } catch (error) {
        console.error(`배치 ${i + 1} 처리 실패:`, error)
        // 배치 전체 실패 시 개별 에러로 기록
        batch!.forEach(textInput => {
          errors.push({
            text: textInput.text,
            ...(textInput.id && { id: textInput.id }),
            error: error instanceof Error ? error.message : '배치 처리 실패',
            code: 'BATCH_ERROR',
            retryable: true
          })
        })
      }
    }

    const finalResult: BatchEmbeddingResult = {
      results,
      totalTokens,
      requestCount,
      errors
    }

    console.log(`배치 임베딩 완료: 성공 ${results.length}개, 실패 ${errors.length}개, 총 ${totalTokens}토큰`)

    return finalResult
  }

  /**
   * 긴 텍스트를 청크로 나누어 임베딩 생성
   */
  async createEmbeddingForLongText(
    text: string, 
    id?: string,
    overlapTokens: number = 200
  ): Promise<EmbeddingResult[]> {
    console.log(`긴 텍스트 임베딩 생성 시작: ${text.length}자`)

    // 텍스트 분할
    const chunks = splitTextIntoChunks(text, this.config.maxTokensPerRequest, overlapTokens)
    console.log(`${chunks.length}개 청크로 분할`)

    // 각 청크에 ID 부여
    const inputs: EmbeddingInput[] = chunks.map((chunk, index) => ({
      text: chunk,
      id: id ? `${id}_chunk_${index}` : `chunk_${index}`
    }))

    // 배치로 처리
    const batchResult = await this.createBatchEmbeddings({ texts: inputs })

    if (batchResult.errors.length > 0) {
      console.warn(`긴 텍스트 처리 중 ${batchResult.errors.length}개 청크에서 오류 발생`)
    }

    return batchResult.results
  }

  /**
   * 재시도 로직이 포함된 API 호출
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined = undefined
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('알 수 없는 오류')
        
        if (attempt === this.config.maxRetries) {
          break // 마지막 시도에서 실패하면 에러 던지기
        }

        // Rate limit이나 서버 오류인 경우에만 재시도
        if (this.isRetryableError(lastError)) {
          const delay = this.config.retryDelay * Math.pow(EMBEDDING_RETRY.RETRY_MULTIPLIER, attempt)
          const maxDelay = Math.min(delay, EMBEDDING_RETRY.MAX_RETRY_DELAY)
          
          console.warn(`임베딩 API 호출 실패 (시도 ${attempt + 1}/${this.config.maxRetries + 1}), ${maxDelay}ms 후 재시도:`, lastError.message)
          await new Promise(resolve => setTimeout(resolve, maxDelay))
        } else {
          // 재시도 불가능한 오류는 즉시 던지기
          throw lastError
        }
      }
    }
    
    throw lastError!
  }

  /**
   * 재시도 가능한 오류인지 판단
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return (
      message.includes('rate limit') ||
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    )
  }

  /**
   * 캐시에서 임베딩 조회
   */
  private getCachedEmbedding(text: string): EmbeddingResult | null {
    const hash = this.getTextHash(text)
    return this.cache.get(hash) || null
  }

  /**
   * 캐시에 임베딩 저장
   */
  private setCachedEmbedding(text: string, result: EmbeddingResult): void {
    const hash = this.getTextHash(text)
    
    // 캐시 크기 제한
    if (this.cache.size >= EMBEDDING_CACHE.MAX_CACHE_SIZE) {
      // 가장 오래된 항목 삭제 (LRU 방식은 아니지만 간단한 구현)
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.set(hash, result)
  }

  /**
   * 텍스트 해시 생성
   */
  private getTextHash(text: string): string {
    return crypto
      .createHash(EMBEDDING_CACHE.HASH_ALGORITHM)
      .update(text + this.config.model) // 모델도 포함하여 모델별로 캐시 구분
      .digest('hex')
  }

  /**
   * 사용량 추적 업데이트
   */
  private updateUsage(tokens: number): void {
    this.usage.totalTokens += tokens
    this.usage.requestCount += 1
    this.usage.estimatedCost = (this.usage.totalTokens / 1000000) * EMBEDDING_PRICING.TEXT_EMBEDDING_3_SMALL
    this.usage.timestamp = new Date()

    // 주기적 로깅
    if (this.config.logUsage && this.usage.requestCount % EMBEDDING_LOGGING.USAGE_LOG_INTERVAL === 0) {
      console.log(`임베딩 사용량: ${this.usage.requestCount}회 요청, ${this.usage.totalTokens}토큰, 예상 비용: $${this.usage.estimatedCost.toFixed(6)}`)
    }
  }

  /**
   * 현재 사용량 정보 반환
   */
  getUsage(): TokenUsage {
    return { ...this.usage }
  }

  /**
   * 캐시 통계 반환
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: EMBEDDING_CACHE.MAX_CACHE_SIZE,
      hitRate: 0 // 간단한 구현에서는 생략, 필요시 추가
    }
  }

  /**
   * 캐시 초기화
   */
  clearCache(): void {
    this.cache.clear()
    console.log('임베딩 캐시가 초기화되었습니다')
  }
}