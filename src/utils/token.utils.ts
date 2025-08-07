// 토큰 계산 유틸리티 함수

import { get_encoding } from 'tiktoken'
import { EMBEDDING_LIMITS } from '../constants/embedding.constants'

// OpenAI text-embedding-3-small 모델용 인코더 (cl100k_base 사용)
let encoder: ReturnType<typeof get_encoding> | null = null

function getEncoder() {
  if (!encoder) {
    encoder = get_encoding('cl100k_base') // text-embedding-3-small과 동일한 인코딩
  }
  return encoder
}

/**
 * tiktoken을 사용하여 텍스트의 정확한 토큰 수를 계산합니다.
 * OpenAI text-embedding-3-small 모델과 동일한 토큰화를 사용합니다.
 */
export function estimateTokenCount(text: string): number {
  // 빈 텍스트 처리
  if (!text || text.trim().length === 0) {
    return 0
  }
  
  try {
    const encoder = getEncoder()
    const tokens = encoder.encode(text)
    return tokens.length
  } catch (error) {
    console.warn('tiktoken 토큰 계산 실패, 추정 방식으로 대체:', error)
    // tiktoken 실패 시 기존 추정 방식 사용
    return estimateTokenCountFallback(text)
  }
}

/**
 * tiktoken 실패 시 사용할 백업 토큰 추정 함수
 */
function estimateTokenCountFallback(text: string): number {
  const charCount = text.length
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length
  
  // 한국어 특성을 고려한 보수적 추정
  const estimatedByChars = charCount * 0.35 // 한국어는 토큰 밀도가 높음
  const estimatedByWords = wordCount * 1.5
  
  return Math.ceil(Math.max(estimatedByChars, estimatedByWords))
}

/**
 * 텍스트가 토큰 제한을 초과하는지 확인합니다.
 */
export function isTokenLimitExceeded(text: string, maxTokens?: number): boolean {
  const limit = maxTokens || EMBEDDING_LIMITS.MAX_TOKENS_PER_REQUEST
  const estimated = estimateTokenCount(text)
  return estimated > limit
}

/**
 * 긴 텍스트를 토큰 제한에 맞게 청크로 분할합니다.
 */
export function splitTextIntoChunks(
  text: string, 
  maxTokensPerChunk?: number,
  overlapTokens: number = 200
): string[] {
  const limit = maxTokensPerChunk || EMBEDDING_LIMITS.MAX_TOKENS_PER_REQUEST
  
  // 토큰 제한을 넘지 않으면 그대로 반환
  if (!isTokenLimitExceeded(text, limit)) {
    return [text]
  }
  
  const chunks: string[] = []
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  
  let currentChunk = ''
  
  for (const sentence of sentences) {
    const testChunk = currentChunk + sentence + '.'
    
    if (isTokenLimitExceeded(testChunk, limit) && currentChunk.length > 0) {
      // 현재 청크를 완성하고 새 청크 시작
      chunks.push(currentChunk.trim())
      
      // 오버랩을 위해 마지막 부분을 유지
      const overlapText = getLastTokens(currentChunk, overlapTokens)
      currentChunk = overlapText + sentence + '.'
    } else {
      currentChunk = testChunk
    }
  }
  
  // 마지막 청크 추가
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.length > 0 ? chunks : [text] // 빈 결과 방지
}

/**
 * 텍스트의 마지막 N개 토큰에 해당하는 부분을 정확히 반환합니다.
 */
function getLastTokens(text: string, tokenCount: number): string {
  try {
    const encoder = getEncoder()
    const tokens = encoder.encode(text)
    
    if (tokens.length <= tokenCount) {
      return text
    }
    
    // 마지막 tokenCount 개의 토큰 선택
    const lastTokens = tokens.slice(-tokenCount)
    const decoded = new TextDecoder().decode(encoder.decode(lastTokens))
    return decoded
  } catch (error) {
    console.warn('tiktoken getLastTokens 실패, 추정 방식 사용:', error)
    // 백업 방식: 문자 수 기반 추정
    const estimatedChars = tokenCount * 3 // 한국어 기준 보수적 추정
    const startIndex = Math.max(0, text.length - estimatedChars)
    return text.substring(startIndex)
  }
}

/**
 * 배치 처리를 위해 텍스트 배열을 적절한 크기로 분할합니다.
 */
export function splitIntoBatches<T>(items: T[], batchSize?: number): T[][] {
  const size = batchSize || EMBEDDING_LIMITS.MAX_BATCH_SIZE
  const batches: T[][] = []
  
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  
  return batches
}