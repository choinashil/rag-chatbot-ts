# EmbeddingService 고급 구현 참조 문서

> **목적**: 3단계에서 구현했던 고급 기능들을 향후 고도화 시 참조할 수 있도록 보존  
> **작성일**: 2025-08-07  
> **현재 상태**: 기본 구현으로 간소화됨 (일관성을 위해)

## 개요

3단계에서 처음에는 프로덕션 레디 수준의 고도화된 EmbeddingService를 구현했으나, 다른 단계들과의 일관성을 위해 기본 구현으로 되돌렸습니다. 이 문서는 제거된 고급 기능들을 향후 필요 시 다시 구현할 수 있도록 보존하는 목적입니다.

## 제거된 고급 기능들

### 1. tiktoken 기반 정확한 토큰 계산

#### 구현된 기능
- OpenAI와 100% 동일한 토큰화 (`cl100k_base` 인코딩)
- 백업 추정 함수 (tiktoken 실패 시 자동 전환)
- 성능 최적화 (싱글톤 패턴 인코더)

#### 핵심 코드
```typescript
import { get_encoding } from 'tiktoken'

let encoder: ReturnType<typeof get_encoding> | null = null

function getEncoder() {
  if (!encoder) {
    encoder = get_encoding('cl100k_base') // text-embedding-3-small과 동일
  }
  return encoder
}

export function estimateTokenCount(text: string): number {
  try {
    const encoder = getEncoder()
    const tokens = encoder.encode(text)
    return tokens.length
  } catch (error) {
    console.warn('tiktoken 실패, 추정 방식으로 대체:', error)
    return estimateTokenCountFallback(text)
  }
}
```

#### 성능 테스트 결과
| 텍스트 길이 | tiktoken 시간 | 추정방식 시간 | 정확도 개선 |
|-------------|---------------|---------------|-------------|
| 짧은글(18자) | 0.638ms | 0.001ms | 56.3% → 100% |
| 긴글(1,251자) | 0.315ms | 0.010ms | 49.9% → 100% |

#### 도입 시점
정확한 토큰 계산이 중요해지는 시점:
- API 비용 최적화가 중요할 때
- 토큰 제한으로 인한 에러가 빈번할 때
- 여러 OpenAI 모델을 사용할 때

### 2. FIFO 캐싱 시스템

#### 구현된 기능
- SHA256 해시 기반 캐시 키 (텍스트 + 모델명)
- FIFO (First In, First Out) 방식 캐시 관리
- 최대 1000개 항목 제한
- 캐시 통계 및 히트율 추적

#### 핵심 코드
```typescript
private cache: Map<string, EmbeddingResult> = new Map()

private getTextHash(text: string): string {
  return crypto
    .createHash('sha256')
    .update(text + this.config.model)
    .digest('hex')
}

private getCachedEmbedding(text: string): EmbeddingResult | null {
  const hash = this.getTextHash(text)
  return this.cache.get(hash) || null
}

private setCachedEmbedding(text: string, result: EmbeddingResult): void {
  const hash = this.getTextHash(text)
  
  // FIFO 방식으로 캐시 크기 관리
  if (this.cache.size >= MAX_CACHE_SIZE) {
    const firstKey = this.cache.keys().next().value
    this.cache.delete(firstKey)
  }
  
  this.cache.set(hash, result)
}
```

#### 도입 시점
캐싱이 효과적인 시점:
- 같은 문서를 반복 처리할 때
- 사용자 질문에서 유사한 패턴이 반복될 때
- API 비용 최적화가 중요할 때

#### LRU vs FIFO 고려사항
- **FIFO**: 구현 단순, 메모리 사용량 예측 가능
- **LRU**: 자주 사용되는 데이터 유지, 더 높은 효율성

### 3. 지수 백오프 재시도 로직

#### 구현된 기능
- Rate limit, timeout, network 오류 대상
- 지수 백오프 (1초 → 2초 → 4초)
- 최대 3회 재시도
- 재시도 불가능한 오류 구분 (인증 오류 등)

#### 핵심 코드
```typescript
private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: Error
  
  for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      
      // 재시도 불가능한 오류
      if (!this.isRetryableError(error)) {
        throw error
      }
      
      // 마지막 시도면 실패
      if (attempt === this.config.maxRetries) {
        throw lastError
      }
      
      // 지수 백오프 대기
      const delay = Math.min(
        this.config.retryDelay * Math.pow(2, attempt),
        10000 // 최대 10초
      )
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError!
}

private isRetryableError(error: any): boolean {
  const message = error.message?.toLowerCase() || ''
  return message.includes('rate limit') || 
         message.includes('timeout') || 
         message.includes('network')
}
```

#### 도입 시점
안정성이 중요한 시점:
- 프로덕션 환경 배포 시
- 대량 데이터 처리 시
- API 호출 실패가 비즈니스에 큰 영향을 미칠 때

### 4. 배치 처리 (`createBatchEmbeddings`)

#### 구현된 기능
- 여러 텍스트 동시 처리
- 부분 실패 허용 (일부 성공, 일부 실패)
- 개별 에러 추적 및 보고
- Promise.allSettled 활용

#### 핵심 코드
```typescript
async createBatchEmbeddings(input: BatchEmbeddingInput): Promise<BatchEmbeddingResult> {
  const { texts } = input
  const results: EmbeddingResult[] = []
  const errors: EmbeddingError[] = []
  
  // 배치를 작은 단위로 분할
  const batches = splitIntoBatches(texts, 10)
  
  for (const batch of batches) {
    const promises = batch.map(async (textInput) => {
      try {
        return await this.createEmbedding(textInput)
      } catch (error) {
        return { error, input: textInput }
      }
    })
    
    const batchResults = await Promise.allSettled(promises)
    
    // 결과 분류
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if ('error' in result.value) {
          errors.push({
            id: batch[index]?.id || `batch-${index}`,
            message: result.value.error.message,
            code: 'EMBEDDING_FAILED'
          })
        } else {
          results.push(result.value)
        }
      }
    })
  }
  
  return {
    results,
    errors,
    totalTokens: results.reduce((sum, r) => sum + r.tokenCount, 0),
    requestCount: Math.ceil(texts.length / 10)
  }
}
```

#### 도입 시점
대량 처리가 필요한 시점:
- 여러 문서를 한 번에 임베딩할 때
- 초기 데이터 로딩 시
- API 호출 횟수 최적화가 필요할 때

### 5. 긴 텍스트 처리 (`createEmbeddingForLongText`)

#### 구현된 기능
- 토큰 제한 초과 텍스트 자동 청킹
- 200토큰 오버랩으로 문맥 연속성 보장
- 청크별 개별 ID 할당
- 문장 단위 분할로 의미 보존

#### 핵심 코드
```typescript
async createEmbeddingForLongText(text: string, id?: string): Promise<EmbeddingResult[]> {
  // 토큰 제한 확인
  if (!isTokenLimitExceeded(text, this.config.maxTokensPerRequest)) {
    return [await this.createEmbedding({ text, id })]
  }
  
  // 청크 분할
  const chunks = splitTextIntoChunks(text, this.config.maxTokensPerRequest, 200)
  
  // 배치 처리로 임베딩 생성
  const chunkInputs = chunks.map((chunk, index) => ({
    text: chunk,
    id: id ? `${id}_chunk_${index}` : undefined
  }))
  
  const batchResult = await this.createBatchEmbeddings({ texts: chunkInputs })
  
  if (batchResult.errors.length > 0) {
    console.warn(`긴 텍스트 처리 중 ${batchResult.errors.length}개 청크 실패`)
  }
  
  return batchResult.results
}
```

#### 청킹 전략
```typescript
export function splitTextIntoChunks(
  text: string, 
  maxTokensPerChunk: number = 8191,
  overlapTokens: number = 200
): string[] {
  // 문장 단위 분할
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const chunks: string[] = []
  let currentChunk = ''
  
  for (const sentence of sentences) {
    const testChunk = currentChunk + sentence + '.'
    
    if (isTokenLimitExceeded(testChunk, maxTokensPerChunk) && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      
      // 오버랩 처리
      const overlapText = getLastTokens(currentChunk, overlapTokens)
      currentChunk = overlapText + sentence + '.'
    } else {
      currentChunk = testChunk
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks.length > 0 ? chunks : [text]
}
```

#### 도입 시점
긴 문서 처리가 필요한 시점:
- PDF, Word 문서 처리 시
- 웹페이지 전체 내용 처리 시
- 책, 논문 등 긴 텍스트 처리 시

### 6. 사용량 추적 및 비용 계산

#### 구현된 기능
- 실시간 토큰 사용량 추적
- API 호출 횟수 카운트
- 비용 계산 ($0.02/1M tokens)
- 사용량 통계 제공

#### 핵심 코드
```typescript
private usage: TokenUsage = {
  totalTokens: 0,
  requestCount: 0,
  estimatedCost: 0,
  timestamp: new Date()
}

private updateUsage(tokenCount: number): void {
  this.usage.totalTokens += tokenCount
  this.usage.requestCount += 1
  this.usage.estimatedCost = (this.usage.totalTokens / 1000000) * EMBEDDING_PRICING.TEXT_EMBEDDING_3_SMALL
  this.usage.timestamp = new Date()
}

getUsage(): TokenUsage {
  return { ...this.usage }
}
```

#### 도입 시점
비용 관리가 중요한 시점:
- 프로덕션 환경에서 비용 추적 시
- API 사용량 제한이 있을 때
- 사용량 기반 알림이 필요할 때

## 성능 테스트 결과

### 복잡성 비교
- **고급 구현**: 911줄 (EmbeddingService 357줄 + token.utils 140줄 + constants 38줄 + 테스트 376줄)
- **기본 구현**: 93줄 (EmbeddingService 60줄 + constants 4줄 + 테스트 29줄)
- **감소율**: 90% 감소

### 테스트 실행 성능
- **고급 구현**: 1.5초 (최적화 후)
- **기본 구현**: 0.3초 예상

## 향후 도입 가이드라인

### 단계별 도입 권장사항

**Phase 1: 기본 안정성**
1. 재시도 로직 (지수 백오프)
2. 기본 에러 분류

**Phase 2: 성능 최적화**  
3. 캐싱 시스템 (FIFO → LRU)
4. 배치 처리

**Phase 3: 고급 기능**
5. tiktoken 정확한 토큰 계산
6. 긴 텍스트 청킹

**Phase 4: 모니터링**
7. 사용량 추적
8. 비용 알림 시스템

### 도입 시점 판단 기준

| 기능 | 도입 시점 | 우선순위 |
|------|-----------|----------|
| 재시도 로직 | API 실패가 빈번할 때 | High |
| 캐싱 시스템 | 같은 텍스트 반복 처리 시 | Medium |
| 배치 처리 | 대량 데이터 처리 시 | Medium |
| tiktoken | 토큰 정확도가 중요할 때 | Low |
| 사용량 추적 | 비용 관리가 필요할 때 | Low |

## 주의사항

1. **의존성 관리**: tiktoken 패키지 추가 필요 (`npm install tiktoken`)
2. **메모리 사용량**: 캐싱 시스템 도입 시 메모리 사용량 모니터링 필요
3. **테스트 복잡성**: 고급 기능 도입 시 테스트 코드도 크게 증가
4. **타입 정의**: 복잡한 타입들 (`BatchEmbeddingInput`, `TokenUsage` 등) 추가 필요

---

**참고**: 이 문서는 실제 구현된 코드를 기반으로 작성되었으며, 필요 시 언제든지 다시 구현할 수 있습니다. 단, 도입 시에는 현재 프로젝트의 복잡성 수준과 실제 필요성을 신중히 검토하시기 바랍니다.