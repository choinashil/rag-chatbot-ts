# RAG 챗봇 페이지 기반 재귀 수집 시스템 구현 계획서

> **작성일**: 2025-08-08 11:53  
> **대상**: 기존 데이터베이스 기반 수집을 확장하여 페이지 재귀 순회 수집 추가  
> **목표**: 노션 페이지 계층구조를 재귀적으로 순회하며 모든 하위 콘텐츠를 벡터화하여 RAG 시스템 데이터 범위 확장  

## 개요

현재 RAG 시스템은 특정 노션 데이터베이스 ID를 기준으로 페이지들을 수집합니다. 이를 확장하여 **특정 페이지를 루트로 시작해 모든 하위 페이지와 데이터베이스를 재귀적으로 수집**하는 기능을 추가합니다.

**핵심 가치**: 
- **유연한 데이터 수집**: 데이터베이스 방식 + 페이지 계층구조 방식 모두 지원
- **완전한 콘텐츠 커버리지**: 중첩된 페이지, 하위 데이터베이스까지 자동 발견
- **정확한 출처 추적**: 페이지 제목 + URL로 참조 정보 제공

## 전제 조건

### 기존 시스템 완료 상태 (1-8단계)
- ✅ **완전한 RAG 파이프라인**: 노션 → 벡터화 → Pinecone → OpenAI → 실시간 UI
- ✅ **데이터베이스 기반 수집**: 특정 Database ID로 페이지 수집 및 처리
- ✅ **실시간 스트리밍 UI**: React 기반 채팅 인터페이스

### 확장 목표
기존 **데이터베이스 중심** 수집을 유지하면서 **페이지 중심** 수집 방식을 추가하여 다양한 노션 구조에 대응

#### 실제 사용 시나리오 예시

**시나리오 1: 회사 위키 전체 수집**
```bash
# 회사 위키 루트 페이지부터 모든 하위 페이지 수집
npm run collect:page a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6

# 결과: 위키 → 각 팀 페이지 → 프로젝트 페이지 → 문서 페이지 전부 수집
```

**시나리오 2: 기존 데이터베이스 + 새 위키 혼합 수집**
```json
// configs/company-docs.json
{
  "collections": [
    {
      "type": "database", 
      "id": "db-product-specs", 
      "name": "제품 스펙 DB"
    },
    {
      "type": "page",
      "id": "page-engineering-wiki", 
      "name": "엔지니어링 위키"
    }
  ]
}
```
```bash
npm run collect:mixed ./configs/company-docs.json
```

**시나리오 3: 정기적 업데이트**
```bash
# crontab으로 매주 일요일 새벽 2시 수집
0 2 * * 0 cd /path/to/project && npm run collect:page <page-id>
```

---

## 상세 개발 단계

### 9단계: 페이지 재귀 순회 시스템 구현 🔄
**예상 소요시간**: 4-5시간  
**목표**: 노션 페이지 계층구조를 재귀적으로 순회하며 모든 콘텐츠 수집

#### 최소 기능 구현 (필수)
- [x] **페이지 기반 수집 인터페이스**
  - ✅ `collectFromPage(pageId: string)` 메서드 추가
  - ✅ 기존 `collectFromDatabase()` 유지
  - ✅ 수집 방식 선택 가능한 통합 인터페이스 (`processCollectionMethod`)

- [x] **재귀 페이지 순회 로직**
  - ✅ 주어진 페이지의 모든 자식 페이지 발견 (`getChildPages`)
  - ✅ 자식 페이지 재귀적 순회 (깊이 제한 설정)
  - ✅ 순환 참조 방지 (visited pages tracking)
  - ✅ 페이지 계층 구조 로깅

- [x] **하위 데이터베이스 자동 발견**
  - ✅ 페이지 블록을 순회하며 데이터베이스 블록 탐지 (`findDatabasesInPage`)
  - ✅ 인라인 데이터베이스, 풀 페이지 데이터베이스 모두 지원
  - ✅ 발견된 데이터베이스의 모든 페이지 수집

- [x] **콘텐츠 필터링 강화**
  - ✅ 이미지/동영상 블록 제외 처리 (`isMediaBlock`)
  - ✅ 링크 텍스트와 URL 추출하여 저장 (`extractRichText`, 링크 메타데이터)
  - ✅ 빈 페이지 또는 의미없는 콘텐츠 필터링 (`excludeEmpty` 옵션)

- [x] **URL 정보 저장 및 전달**
  - ✅ 각 청크에 페이지 URL 정보 포함
  - ✅ 벡터 메타데이터에 `pageUrl`, `pageTitle` 추가
  - ✅ 추가 메타데이터: `collectionMethod`, `depthLevel`, `parentPageId`, `links`

#### 기술 구현 세부사항

##### NotionService 확장
```typescript
interface PageCollectionOptions {
  maxDepth?: number        // 재귀 깊이 제한 (기본값: 10)
  includeDatabase?: boolean // 하위 데이터베이스 수집 여부
  excludeEmpty?: boolean    // 빈 페이지 제외
  visitedPages?: Set<string> // 순환 참조 방지
}

class NotionService {
  async collectFromPage(
    pageId: string, 
    options: PageCollectionOptions = {}
  ): Promise<NotionPage[]>
  
  async getChildPages(pageId: string): Promise<string[]>
  async findDatabasesInPage(pageId: string): Promise<string[]>
}
```

##### DocumentProcessor 확장
```typescript
class DocumentProcessor {
  async processPageRecursively(
    rootPageId: string,
    options: PageCollectionOptions = {}
  ): Promise<ProcessingResult>
  
  async processCollectionMethod(
    method: 'database' | 'page',
    id: string
  ): Promise<ProcessingResult>
}
```

##### CLI 스크립트 구조
```typescript
// scripts/collect-from-page.ts
async function main() {
  const pageId = process.argv[2]
  if (!pageId) {
    console.error('Usage: npm run collect:page <page-id>')
    process.exit(1)
  }
  
  const processor = new DocumentProcessor(...)
  const result = await processor.processPageRecursively(pageId)
  console.log(`수집 완료: ${result.processedPages}개 페이지`)
}

// scripts/collect-from-database.ts (기존)
// scripts/collect-mixed.ts (신규)
```

##### package.json 스크립트 추가
```json
{
  "scripts": {
    "collect:database": "tsx scripts/collect-from-database.ts",
    "collect:page": "tsx scripts/collect-from-page.ts", 
    "collect:mixed": "tsx scripts/collect-mixed.ts"
  }
}
```

##### 메타데이터 확장
```typescript
interface ChunkMetadata {
  // 기존 필드들...
  page_url?: string        // https://notion.so/...
  page_title?: string      // 페이지 제목
  collection_method: 'database' | 'page' // 수집 방식
  parent_page_id?: string  // 상위 페이지 ID
  depth_level: number      // 재귀 깊이
}
```

#### 완료 기준 (최소 동작 수준)
- [x] ✅ 특정 페이지 ID로 재귀 수집 가능
- [x] ✅ 중첩된 페이지 구조에서 모든 하위 페이지 발견
- [x] ✅ 하위 데이터베이스 자동 발견 및 수집
- [x] ✅ 순환 참조 없이 안전한 재귀 처리
- [x] ✅ 이미지/동영상 제외, 링크 텍스트/URL 포함하여 텍스트 추출
- [x] ✅ 답변 시 정확한 페이지 제목과 링크 제공 (메타데이터 포함)

#### 🔧 **구현 과정에서 해결된 주요 이슈들**
1. **데이터베이스 방식 콘텐츠 추출 버그 수정**
   - 문제: `getPages()` 메서드가 빈 content로 반환하여 "빈 텍스트는 임베딩할 수 없다" 오류 발생
   - 해결: `processDatabaseMethod`에서 `getPage()`로 전체 콘텐츠를 조회하도록 수정

2. **매직 넘버 상수화**
   - 기존 하드코딩된 값들을 `PAGE_COLLECTION_DEFAULTS`, `SYSTEM_CONSTANTS`로 분리
   - 유지보수성과 설정 관리 향상

3. **테스트 코드 수정**
   - 새로 추가된 `getPage()` 호출에 대한 모킹 추가
   - 단위 테스트와 통합 테스트 모두 성공적으로 통과

4. **지원하지 않는 블록 타입 처리**
   - `default` case에서 `rich_text` 필드가 있는 경우 텍스트 추출 시도
   - 콘텐츠 손실 방지 및 안정성 향상

5. **벡터 메타데이터 필드 확장**
   ```typescript
   // 구현된 확장 메타데이터
   metadata: {
     // 기본 필드들
     title: string
     content: string
     source: 'notion'
     timestamp: string
     
     // 새로 추가된 필드들
     pageUrl: string           // 노션 페이지 URL
     pageTitle: string         // 페이지 제목 (중복이지만 명시성 위해 유지)
     collectionMethod: 'database' | 'page'  // 수집 방식 구분
     depthLevel: number        // 재귀 깊이 레벨
     parentPageId?: string     // 상위 페이지 ID (선택적)
     links?: string           // 페이지 내 링크 정보 (text: url 형태)
   }
   ```
   
   **메타데이터 필드별 활용 목적**:
   - `pageUrl`, `pageTitle`: RAG 응답 시 정확한 출처 링크 제공
   - `collectionMethod`: 수집 방식별 분석 및 관리
   - `depthLevel`: 계층 구조 이해 및 중요도 판단
   - `parentPageId`: 페이지 관계 추적 및 계층 구조 재구성
   - `links`: 관련 문서 추천 및 참조 관계 분석

---

### 10단계: 통합 수집 인터페이스 및 CLI 도구 🛠️ ✅ **완료**
**예상 소요시간**: 2-3시간  
**목표**: 다양한 수집 방식을 지원하는 사용자 친화적 인터페이스 제공

#### 최소 기능 구현 (필수)
- [x] ✅ **통합 수집 CLI 스크립트**
  - ✅ `npm run collect:database <database-id>` (기존 방식 유지)
  - ✅ `npm run collect:page <page-id>` (새로운 페이지 기반 수집)
  - ✅ `npm run collect:mixed [config-file]` (복합 수집 설정 파일, 기본값: configs/notion-collection.json)
  - ✅ 진행률 표시 및 상세 로깅

#### 추가 구현된 기능 (기능 확장)
- [x] ✅ **벡터 인덱스 관리 도구**
  - ✅ `npm run clear:vectors` (Pinecone 인덱스 전체 초기화)
  - ✅ `npm run show:vectors` (현재 저장된 벡터 개수 및 상태 조회)
  
- [x] ✅ **로깅 시각화 개선**
  - ✅ 들여쓰기와 이모지를 활용한 계층적 로그 표시
  - ✅ 수집 진행 상황을 단계별로 명확하게 구분
  - ✅ 데이터베이스/페이지 처리 과정의 시각적 이해도 향상

#### 실행 방식 및 시점
**수집 실행 방법:**
```bash
# 1. 데이터베이스 기반 수집 (기존)
npm run collect:database abc123-def456-ghi789

# 2. 페이지 기반 수집 (신규)
npm run collect:page xyz789-abc123-def456

# 3. 설정 파일 기반 복합 수집 (신규 - 기본값: configs/notion-collection.json)
npm run collect:mixed [config-file-path]

# 4. 벡터 관리 도구 (추가)
npm run show:vectors    # 현재 저장된 벡터 상태 조회
npm run clear:vectors   # 모든 벡터 삭제 (인덱스 초기화)
```

**수집 시점:**
- ❌ **서버 실행 시 자동 실행 안함** (기존 유지)
- ❌ **API 요청 시 실시간 수집 안함** (성능상 부적절)  
- ✅ **수동 실행**: 관리자가 필요할 때 CLI로 수집 실행
- ✅ **배치 실행**: 크론잡 등으로 주기적 수집 가능

- [x] ✅ **수집 설정 파일 지원**
  ```json
  {
    "collections": [
      {
        "type": "database",
        "id": "database-id-1",
        "name": "Product Docs"
      },
      {
        "type": "page", 
        "id": "page-id-1",
        "name": "Engineering Wiki",
        "options": {
          "maxDepth": 5,
          "includeDatabase": true
        }
      }
    ]
  }
  ```

- [x] ✅ **수집 상태 관리**
  - ✅ 수집 통계 및 오류 리포팅
  - ✅ 진행률 표시 및 상세 로깅
  - ✅ 드라이런 모드 지원

- [x] ✅ **기존 시스템과 호환성 보장**
  - ✅ 기존 데이터베이스 기반 수집 기능 유지
  - ✅ 기존 벡터 데이터와 충돌 없는 업데이트
  - ✅ 동일한 RAG 인터페이스로 통합 접근

#### 완료 기준 (최소 동작 수준) ✅ **모두 달성**
- [x] ✅ CLI로 데이터베이스/페이지 방식 모두 수집 가능
- [x] ✅ 설정 파일로 복합적 수집 시나리오 실행
- [x] ✅ 기존 RAG 시스템과 완전 호환
- [x] ✅ 수집 진행률 및 결과 모니터링

#### 🎯 **10단계 구현 완료 내용**

**1. 통합 CLI 스크립트 구현**
- `scripts/collect-from-database.ts`: 기존 데이터베이스 방식 유지
- `scripts/collect-from-page.ts`: 새로운 페이지 재귀 수집 방식
- `scripts/collect-mixed.ts`: JSON 설정 파일 기반 복합 수집

**2. package.json 스크립트 추가**
```json
{
  "scripts": {
    "collect:database": "tsx scripts/collect-from-database.ts",
    "collect:page": "tsx scripts/collect-from-page.ts", 
    "collect:mixed": "tsx scripts/collect-mixed.ts",
    "show:vectors": "tsx scripts/show-vectors.ts",
    "clear:vectors": "tsx scripts/clear-vectors.ts"
  }
}
```

**3. 사용자 친화적 인터페이스**
- 도움말 지원 (`--help`, `-h`)
- 진행률 및 상세 로깅
- 드라이런 모드 (`--dry-run`)
- 상세 옵션 지원 (`--verbose`, `--max-depth`, `--exclude-empty` 등)

**4. 설정 파일 예시 제공**
- `configs/example-mixed-collection.json`: 복합 수집 설정 예시
- JSON 스키마 검증 및 명확한 오류 메시지

**5. 기능 검증**
- 모든 CLI 도구 정상 동작 확인
- 기존 시스템과의 완전한 호환성 보장
- 실제 노션 API 연동 테스트 성공 (데이터베이스 방식)

**6. 추가 벡터 관리 도구**
- `scripts/clear-vectors.ts`: Pinecone 인덱스 전체 벡터 삭제
- `scripts/show-vectors.ts`: 현재 벡터 개수 및 네임스페이스별 상태 조회
- 벡터 관리 작업의 사용자 편의성 향상

**7. 로깅 시각화 개선**
- 수집 과정의 계층적 구조를 들여쓰기로 표현
- 이모지를 활용한 작업 단계별 시각적 구분
- 사용자가 현재 진행 상황을 쉽게 파악할 수 있도록 개선

---

#### 추후 개선 인사이트 (오버엔지니어링 방지)
다음 기능들은 실제 필요시에만 구현하여 과도한 엔지니어링을 방지:

**성능 최적화 관련**:
- 병렬 페이지 처리 (동시 요청 수 제한)
- 페이지 수정 시간 기반 증분 업데이트  
- 삭제된 페이지 감지 및 벡터 정리
- 계층 구조 변경 감지

**고급 필터링**:
- 특정 페이지 타입 필터링
- 페이지 크기 기반 제외 (너무 작거나 큰 페이지)  
- 특정 키워드 포함/제외 필터
- 콘텐츠 품질 분석 (중복, 유사도)

**모니터링 및 분석**:
- 수집 성능 메트릭
- 벡터 공간 활용률 분석
- 실시간 노션 변경사항 동기화 (Webhook)
- 페이지 중요도 기반 우선순위 처리
- 자동 태깅 및 분류

> **원칙**: MVP 우선 구현 후 실제 사용 과정에서 필요성이 검증된 기능만 추가

---

## 마일스톤 및 검증 포인트

### 마일스톤 4: 완전한 페이지 기반 수집 시스템 (9-10단계) ✅ **완료**
- [x] ✅ **9단계 완료**: 페이지 재귀 순회로 모든 하위 콘텐츠 수집
- [x] ✅ 데이터베이스/페이지 방식 모두 지원하는 통합 인터페이스  
- [x] ✅ 링크 정보 포함한 완전한 콘텐츠 추출
- [x] ✅ 기존 시스템 완전 호환성 보장
- [x] ✅ **10단계 완료**: CLI 도구
- [x] ✅ **핵심 목표 달성**: "다양한 노션 구조에서 완전한 콘텐츠 수집"


### 최종 시스템 구성 (확장된 수집 파이프라인)
```
노션 콘텐츠 소스:
├─ Database 방식: Database ID → Pages
└─ Page 방식: Root Page → Child Pages (재귀)
                        ├─ Nested Pages
                        └─ Inline Databases → Pages

수집 파이프라인:
NotionService → DocumentProcessor → EmbeddingService → PineconeService
     ↓              ↓                    ↓                   ↓
페이지 재귀 순회   콘텐츠 필터링      벡터화 + URL       메타데이터 포함
하위 DB 발견     이미지/동영상 제외                    page_title, page_url

RAG 응답:
OpenAI → 답변 + 참조 페이지 (제목, 클릭 가능한 링크)
```

**핵심 특징**:
- **유연한 수집 방식**: Database ID 또는 Page ID 시작점 선택 가능
- **완전한 콘텐츠 커버리지**: 중첩 구조 전체 자동 발견
- **정확한 출처 추적**: 페이지 제목 + URL 제공
- **성능 최적화**: 병렬 처리, 증분 업데이트

## 성공 기준

### 기능적 요구사항 ✅ 모두 달성
- [x] ✅ 페이지 ID로 시작하여 모든 하위 페이지 재귀 수집
- [x] ✅ 하위 데이터베이스 자동 발견 및 처리
- [x] ✅ 이미지/동영상 제외, 링크 정보 포함한 텍스트 콘텐츠 추출
- [x] ✅ 답변 시 정확한 페이지 제목과 클릭 가능한 링크 제공 (메타데이터)
- [x] ✅ 기존 데이터베이스 방식과 동시 지원

### 비기능적 요구사항
- [ ] **수집 성능** 50+ 페이지 처리 시 안정적 동작
- [ ] **메모리 효율성** 대용량 콘텐츠 처리 시 메모리 사용량 제어
- [ ] **안정성** 순환 참조, API 제한 등 예외 상황 안전 처리
- [ ] **확장성** 다양한 노션 구조에 범용적 적용 가능
- [ ] **타입 안전성** 모든 새 인터페이스 TypeScript 완전 지원

## 위험 요소 및 대응 방안

### 기술적 위험
- **노션 API Rate Limiting**: 대량 페이지 처리 시 제한 도달
  - *대응*: 지능적 요청 지연, 배치 크기 조절, 우선순위 기반 처리
- **복잡한 페이지 구조**: 순환 참조, 깊은 중첩, 권한 오류
  - *대응*: 방문 페이지 추적, 깊이 제한, 상세 오류 처리
- **메모리 사용량 급증**: 대용량 페이지 동시 처리
  - *대응*: 스트리밍 처리, 배치 단위 메모리 해제

### 개발 위험  
- **기존 시스템 호환성**: 새로운 메타데이터 구조로 인한 충돌
  - *대응*: 점진적 마이그레이션, 백워드 호환성 유지
- **복잡한 테스트 시나리오**: 다양한 노션 구조 검증
  - *대응*: 실제 노션 페이지 기반 통합 테스트 구축

---

**현재 계획 범위**: [9-11단계: 페이지 기반 재귀 수집 시스템 구현]  
**최종 목표**: "다양한 노션 구조에서 완전한 콘텐츠 수집과 정확한 출처 추적"  
**연관 문서**: `250808-0900-rag-api-ui-implementation.md` (7-8단계 완료), `250807-1110-rag-chatbot-migration.md` (1-6단계)  
**작성일**: 2025-08-08 11:53  
**책임자**: Development Team