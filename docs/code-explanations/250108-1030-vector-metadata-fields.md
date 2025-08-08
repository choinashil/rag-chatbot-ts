# 벡터 메타데이터 필드 설계 및 활용 방안

> RAG 시스템의 벡터 검색에서 사용되는 메타데이터 필드들의 필요성과 활용 시나리오를 설명합니다.

## 개요

페이지 기반 수집 시스템(Stage 9) 구현과 함께 기존 벡터 메타데이터에 새로운 필드들이 추가되었습니다. 각 필드의 설계 의도와 RAG 시스템에서의 활용 가치를 분석합니다.

## 메타데이터 필드 구조

### 기존 필드 (Stage 1-8)
```typescript
interface VectorMetadata {
  title: string         // 문서 제목
  content: string       // 문서 내용
  source: string        // 소스 타입 ('notion')
  timestamp?: string    // 생성 시점
  url?: string         // 소스 URL
}
```

### 새로 추가된 필드 (Stage 9)
```typescript
interface VectorMetadata {
  // ... 기존 필드들
  
  // 페이지 기반 수집용 메타데이터
  pageUrl?: string              // 노션 페이지 URL
  pageTitle?: string            // 페이지 제목
  collectionMethod?: CollectionMethod  // 수집 방식 ('database' | 'page')
  parentPageId?: string         // 상위 페이지 ID
  depthLevel?: number           // 재귀 수집 깊이
  links?: string               // 페이지 내 링크 정보 (문자열로 직렬화)
}
```

## 필드별 상세 분석

### 1. collectionMethod ('database' | 'page')

#### 필요성: **높음**
- **설계 의도**: 해당 벡터가 어떤 수집 방식으로 생성되었는지 추적
- **데이터 값**: 
  - `'database'`: 기존 데이터베이스 기반 수집 (Stage 1-8)
  - `'page'`: 새로운 페이지 기반 재귀 수집 (Stage 9+)

#### 활용 시나리오
1. **검색 품질 분석**
   ```typescript
   // 수집 방식별 검색 성능 분석
   const databaseResults = results.filter(r => r.metadata.collectionMethod === 'database')
   const pageResults = results.filter(r => r.metadata.collectionMethod === 'page')
   ```

2. **디버깅 및 문제 해결**
   - 특정 수집 방식에서 발생하는 문제점 식별
   - 수집 방식별 콘텐츠 품질 비교

3. **향후 수집 전략 최적화**
   - A/B 테스트를 통한 최적 수집 방식 결정
   - 문서 유형별 최적 수집 방법 선택

### 2. parentPageId

#### 필요성: **중간**
- **설계 의도**: 페이지 간 계층 관계 및 구조 정보 보존
- **데이터 값**: 상위 페이지의 Notion ID (최상위 페이지의 경우 null/undefined)

#### 활용 시나리오
1. **관련 문서 추천**
   ```typescript
   // 같은 상위 페이지를 가진 관련 문서들 찾기
   const relatedDocs = await findRelatedDocuments({
     parentPageId: currentDoc.metadata.parentPageId,
     excludeId: currentDoc.id
   })
   ```

2. **컨텍스트 확장 검색**
   - 사용자 질문에 대한 답변이 불충분할 때 상위-하위 페이지 연관 검색
   - 문서 계층 구조를 활용한 포괄적 답변 생성

3. **문서 구조 시각화**
   - 노션 워크스페이스의 페이지 구조를 시각적으로 표현
   - 지식 베이스 네비게이션 기능 구현

### 3. depthLevel

#### 필요성: **중간**
- **설계 의도**: 재귀 수집에서의 문서 깊이로 중요도 추정
- **데이터 값**: 0(루트 페이지)부터 시작하는 정수값

#### 활용 시나리오
1. **검색 결과 가중치 조정**
   ```typescript
   // 깊이가 얕을수록 높은 가중치 부여
   const weightedScore = baseScore * (1 + (maxDepth - depthLevel) * 0.1)
   ```

2. **문서 중요도 기반 필터링**
   - 개요 수준의 질문: 낮은 depth의 문서 우선
   - 세부 사항 질문: 높은 depth의 문서까지 포함

3. **수집 성능 분석**
   - 깊이별 문서 품질 분석
   - 최적 수집 깊이 결정을 위한 데이터

### 4. links

#### 필요성: **중간**
- **설계 의도**: 페이지 내 외부 링크 정보 보존으로 답변 품질 향상
- **데이터 값**: "텍스트: URL; 텍스트2: URL2" 형태의 직렬화된 문자열

#### 활용 시나리오
1. **풍부한 답변 제공**
   ```typescript
   // 답변과 함께 관련 링크 제공
   const response = {
     answer: generatedAnswer,
     relatedLinks: parseLinksFromMetadata(result.metadata.links)
   }
   ```

2. **답변 신뢰성 향상**
   - 출처와 추가 정보 링크 제공
   - 사용자의 추가 탐색 지원

3. **문서 네트워크 분석**
   - 노션 페이지 간 연결 관계 분석
   - 중요 허브 페이지 식별

## 성능 및 저장 공간 고려사항

### 저장 공간 영향
- 각 필드당 평균 추가 저장 공간: 50-200 bytes
- 대량 문서 컬렉션에서의 총 영향: 10-20% 증가 예상

### 검색 성능 영향
- 메타데이터 필터링 시 약간의 성능 오버헤드
- 인덱싱 최적화로 영향 최소화 가능

## 권장 활용 전략

### 단계적 적용
1. **1단계**: `collectionMethod` 필드를 활용한 기본 분석
2. **2단계**: `parentPageId`를 활용한 관련 문서 추천 기능
3. **3단계**: `depthLevel`과 `links`를 활용한 고급 검색 기능

### 모니터링 포인트
- 메타데이터 활용률 추적
- 검색 품질 개선 효과 측정
- 사용자 피드백 기반 기능 조정

## 결론

추가된 메타데이터 필드들은 모두 RAG 시스템의 검색 품질 향상과 운영 최적화에 실질적으로 기여할 수 있습니다. 특히 `collectionMethod`는 시스템 운영에 필수적이며, 다른 필드들도 향후 기능 확장에 중요한 기반을 제공합니다.

---
**작성일**: 2025-01-08  
**작성자**: Claude Code Assistant  
**다음 리뷰**: 벡터 검색 품질 개선 결과 측정 후