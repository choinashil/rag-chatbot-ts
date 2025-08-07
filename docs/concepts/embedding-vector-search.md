# 임베딩과 벡터 검색

> RAG 챗봇의 핵심 기술인 임베딩과 벡터 검색에 대한 개념 정리

## 1. 임베딩(Embedding)이란?

### 정의
**임베딩**은 텍스트, 이미지, 오디오 등의 비정형 데이터를 **고차원 벡터(숫자 배열)**로 변환하는 기술입니다. 이를 통해 컴퓨터가 데이터의 의미를 수학적으로 처리할 수 있게 됩니다.

### 예시
```
입력 텍스트: "TypeScript는 JavaScript의 상위집합입니다"
출력 벡터: [0.12, -0.34, 0.78, 0.23, -0.09, ..., 0.41] (1536개 숫자)
```

### 핵심 특징

#### 1. 의미적 유사성 보존
비슷한 의미를 가진 텍스트는 벡터 공간에서 가까운 위치에 배치됩니다.

```
"자동차" → [0.1, 0.8, 0.2, ...]
"차량"   → [0.09, 0.82, 0.18, ...]  # 자동차와 유사한 벡터
"사과"   → [0.9, 0.1, 0.7, ...]   # 완전히 다른 벡터
```

#### 2. 차원 통일
길이가 다른 텍스트도 동일한 차원으로 변환됩니다.

```
"안녕" → 1536차원 벡터
"안녕하세요. 오늘 날씨가 좋네요." → 1536차원 벡터 (같은 차원!)
```

#### 3. 수학적 연산 가능
벡터 간 거리 계산으로 유사도를 측정할 수 있습니다.

```
코사인 유사도 = cos(벡터A, 벡터B)
- 1에 가까울수록 유사함
- 0에 가까울수록 관련 없음
- -1에 가까울수록 반대 의미
```

## 2. 임베딩 모델

### OpenAI text-embedding-3-small
이 프로젝트에서 사용하는 임베딩 모델의 특징:

- **차원**: 1536차원 벡터 생성
- **최대 토큰**: 8191 토큰 (약 6,000-8,000 단어)
- **언어 지원**: 다국어 지원 (한국어, 영어 등)
- **성능**: 높은 품질의 의미 표현

### 토큰 제한 처리
```typescript
// 긴 텍스트는 청크로 나누어 처리
const maxTokens = 8191;
if (tokenCount > maxTokens) {
  // 텍스트를 여러 청크로 분할
  const chunks = splitTextIntoChunks(text, maxTokens);
  // 각 청크별로 임베딩 생성
}
```

## 3. RAG에서의 임베딩 활용

### 3.1 문서 저장 단계
```mermaid
graph LR
    A[Notion 문서] --> B[텍스트 추출]
    B --> C[임베딩 생성]
    C --> D[벡터 DB 저장]
```

**상세 과정**:
1. Notion에서 문서 내용 추출
2. OpenAI API로 임베딩 벡터 생성
3. Pinecone에 벡터 + 메타데이터 저장

### 3.2 질문 처리 단계
```mermaid
graph LR
    A[사용자 질문] --> B[질문 임베딩]
    B --> C[벡터 유사도 검색]
    C --> D[관련 문서 추출]
    D --> E[LLM에 컨텍스트 제공]
```

**상세 과정**:
1. 사용자 질문을 같은 임베딩 모델로 변환
2. Pinecone에서 유사한 벡터 검색
3. 검색된 문서를 LLM의 컨텍스트로 활용

## 4. 벡터 검색(Vector Search)

### 유사도 측정 방법

#### 코사인 유사도 (Cosine Similarity)
가장 일반적으로 사용되는 방법:
```
similarity = (A · B) / (||A|| × ||B||)
```
- 범위: -1 ~ 1
- 1에 가까울수록 유사함

#### 유클리드 거리 (Euclidean Distance)
벡터 간 직선 거리:
```
distance = √Σ(ai - bi)²
```
- 거리가 가까울수록 유사함

### 검색 최적화

#### Top-K 검색
```typescript
// 가장 유사한 상위 5개 문서 검색
const searchResults = await pinecone.query({
  vector: questionEmbedding,
  topK: 5,
  includeMetadata: true
});
```

#### 임계값 설정
```typescript
const threshold = 0.7; // 유사도 임계값
const relevantDocs = searchResults.matches.filter(
  match => match.score >= threshold
);
```

## 5. 임베딩의 장단점

### 장점
- **의미적 검색**: 키워드가 정확히 일치하지 않아도 의미상 유사한 문서 검색
- **다국어 지원**: 언어가 달라도 의미가 같으면 유사한 벡터
- **문맥 이해**: 단어의 문맥적 의미 고려

### 단점
- **계산 비용**: 벡터 생성과 검색에 연산 자원 필요
- **저장 공간**: 고차원 벡터 저장 필요 (문서당 1536 × 4바이트)
- **정확도 한계**: 매우 전문적이거나 특수한 용어는 제한적

## 6. 실제 사용 예시

### 임베딩 생성
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function createEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float"
  });
  
  return response.data[0].embedding;
}
```

### 유사도 계산
```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  
  return dotProduct / (magnitudeA * magnitudeB);
}
```

## 7. 베스트 프랙티스

### 텍스트 전처리
- 불필요한 HTML 태그 제거
- 과도한 공백 정리
- 의미 있는 청크 단위로 분할

### 성능 최적화
- 배치 처리로 API 호출 최소화
- 캐싱을 통한 중복 임베딩 방지
- 적절한 청크 크기 설정 (500-1000 토큰)

### 품질 관리
- 임계값 조정을 통한 관련성 필터링
- 다양한 검색 결과 조합
- 사용자 피드백 기반 개선

---

**작성일**: 2025-08-07  
**관련 단계**: 3단계 - OpenAI 임베딩 연동  
**다음 문서**: [벡터 데이터베이스와 Pinecone](./vector-database-pinecone.md)