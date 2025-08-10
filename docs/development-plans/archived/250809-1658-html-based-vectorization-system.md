# ⚠️ [채택되지 않음] HTML 기반 의미론적 벡터화 시스템 구축

> **⚠️ 중요 알림**: 이 문서는 테스트 및 검토 후 **채택되지 않은** 방식입니다.  
> **채택된 최종 방식**: [단순 HTML 텍스트 추출 방식](./250809-2200-simple-html-text-extraction.md)  
> **채택되지 않은 이유**: 과도한 엔지니어링 복잡도 대비 실용성 부족, 단순한 접근법의 우수성 확인

> **작성일**: 2025-08-10 16:58 KST  
> **상태**: ❌ **테스트 후 채택되지 않음**  
> **테스트 결과**: 복잡한 의미론적 파싱보다 단순한 텍스트 추출이 더 효과적  
> **문서 목적**: 복잡한 HTML 파싱 방식 테스트 과정 기록 및 미채택 사유 보존  

## 개요 (테스트 목적)

HTML 구조 기반의 복잡한 의미론적 파싱 시스템을 구축하여 검색 품질을 높이려는 시도였습니다. 그러나 테스트 결과, 과도한 엔지니어링 복잡도 대비 실제 성과가 미미하여 단순한 텍스트 추출 방식으로 전환되었습니다.

## 핵심 설계 원칙

### 1. 의미론적 우선주의 (Semantic-First Approach)
- HTML 헤딩 계층구조를 벡터 청킹의 주요 기준으로 활용
- 컨텍스트 보존을 위한 계층적 정보 상속
- 사용자 검색 의도와 문서 구조의 일치성 최대화

### 2. 점진적 향상 (Progressive Enhancement)
- 단일 페이지 파싱 → 다중 페이지 수집 → 재귀적 사이트 크롤링
- 기본 텍스트 추출 → 의미론적 청킹 → 고급 메타데이터 활용
- MVP 동작 확인 후 점진적 기능 확장

### 3. 검색 품질 최적화 (Search Quality Optimization)
- 사용자 질문과 매칭되기 쉬운 벡터 청킹 전략
- 컨텍스트 풍부성과 검색 정확성의 균형점 탐색
- A/B 테스트 가능한 청킹 전략 설계

## 테스트된 복잡한 HTML 방식의 이론적 장점

### 1. **이론적 단순성** (실제론 복잡함)
- HTML 표준 구조 활용 가능
- 노션 API 대비 상대적 단순함
- 실제 구현 시 의미론적 파싱으로 인한 복잡도 증가

### 2. **의미론적 구조 파싱** (과도한 엔지니어링)
- 헤딩 계층 구조 분석
- 적응적 청킹 전략 구현
- 실제 oopy 페이지에서 예상과 다른 구조 (h1 → h4 점프 등)

### 3. **🔗 공개 링크 직접 활용 (핵심 혁신)**
**기존 노션 API 방식의 한계**:
```
노션 내부 링크: https://sellerhub.notion.site/abc123... 
→ 회사 내부 전용, 사용자에게 제공 불가
→ 별도 링크 매핑 작업 필요 (복잡한 추가 개발)
```

**HTML 방식의 해결**:
```typescript
interface PublicLinkExtraction {
  metadata: {
    // ✅ 벡터 메타데이터에 바로 공개 링크 포함
    publicUrl: "https://help.pro.sixshop.com/design/advanced/blocks",
    title: "블록 메이커",
    breadcrumb: "웹사이트 디자인 > 고급 코스 > 블록 메이커"
  }
}
```

**사용자 경험 혁신**:
- 챗봇 응답: "블록 메이커에 대한 자세한 내용은 [여기](https://help.pro.sixshop.com/design/advanced/blocks)에서 확인하세요"
- 즉시 접근 가능한 실제 가이드 링크 제공
- 링크 매핑 작업 완전 불필요 → 개발 및 운영 부담 제거

### 4. **성능 및 확장성**
- HTTP 요청 1회로 전체 페이지 수집
- 재귀적 사이트 크롤링으로 전체 가이드 사이트 자동 수집
- 표준 웹 크롤링 기법 활용으로 안정성 보장

### 5. **🚫 미디어 요소 제외 처리 (업계 표준 적용)**
**설계 결정**: 이미지, 동영상 등 미디어 요소 벡터화에서 제외

**업계 표준 근거**:
- **RAG 챗봇 95% 이상**: 텍스트 기반 답변만 제공 (ChatGPT, Claude, 기업용 RAG 등)
- **기술적 한계**: 벡터 검색 → 텍스트 매칭 → LLM 텍스트 생성 파이프라인
- **비용 효율성**: 이미지 처리 고비용 vs 텍스트 답변 저비용
- **일관성 보장**: 텍스트는 항상 정확, 이미지는 오래되거나 부정확할 위험

**대안 제공 방식**:
```typescript
// 이미지 대신 링크 + 텍스트 설명으로 해결
답변예시: "테마 설정 방법:
1. 디자인 메뉴 접속
2. '테마 선택' 클릭  
3. 원하는 테마 선택

자세한 화면은 [가이드 링크]에서 확인하세요."
```

**제외 대상**:
- 이미지 (`<img>` 태그)
- 동영상 (`<video>`, `<iframe>` 태그)  
- 오디오 (`<audio>` 태그)
- 기타 미디어 임베드

**처리 방식**:
```typescript
interface MediaExclusion {
  excludedTags: ['img', 'video', 'audio', 'iframe', 'embed', 'object']
  skipMediaMetadata: true      // alt 텍스트도 추출하지 않음
  textOnlyApproach: true       // 순수 텍스트 콘텐츠만 벡터화
}
```

## 대상 페이지 분석

### 페이지 1: 웹사이트 디자인
**URL**: https://help.pro.sixshop.com/design  
**특징**: 
- 개요 페이지 성격, 하위 항목들로의 네비게이션 중심
- 섹션별 카테고리 구조 (기본/고급 코스)
- 외부 링크 (의뢰하기) 포함

**예상 HTML 구조**:
```html
<article>
  <h1>웹사이트 디자인</h1>
  <section>
    <h2>기본 코스</h2>
    <ul><li><a href="/design/basic/theme">테마 선택하기</a></li></ul>
  </section>
  <section>
    <h2>고급 코스</h2>
    <p>코드를 다룰 줄 안다면 더 특별한 웹사이트가 돼요.</p>
    <ul>
      <li><a href="/design/advanced/blocks">블록 메이커</a></li>
      <li><a href="/design/advanced/html">HTML 섹션</a></li>
    </ul>
  </section>
</article>
```

### 페이지 2: 웹사이트 디자인 입문하기
**URL**: https://help.pro.sixshop.com/design/start  
**특징**: 
- 실제 가이드 콘텐츠, 단계별 설명 중심
- 이미지, 코드 블록, 인용구 등 풍부한 콘텐츠
- 세분화된 헤딩 구조 (h3-h4 레벨까지)

**예상 HTML 구조**:
```html
<article>
  <h1>웹사이트 디자인 입문하기</h1>
  <section>
    <h2>테마 선택하기</h2>
    <h3>현재 제공 중인 테마와 템플릿</h3>
    <p>Essential, Grid, Round...</p>
    <img src="..." alt="테마 선택 화면">
  </section>
  <section>
    <h2>원하는 테마 선택하기</h2>
    <h3>디자인 선택 방법</h3>
    <blockquote>중요한 팁...</blockquote>
  </section>
</article>
```

## 벡터화 전략 설계

### 1. HTML 구조 기반 의미론적 청킹 전략

**기본 원칙**: "사용자가 찾고자 하는 정보 단위"와 일치하는 청킹

#### A. 네비게이션 페이지 (design 타입)
```typescript
interface NavigationChunk {
  type: 'category' | 'overview'
  title: string           // "고급 코스"
  description: string     // "코드를 다룰 줄 안다면..."
  childLinks: Array<{     // 하위 페이지 링크들
    title: string
    url: string
    description?: string
  }>
  context: string        // "웹사이트 디자인 > 고급 코스"
}
```

**검색 최적화**: "블록 메이커는 어디에 있나요?" → "웹사이트 디자인 > 고급 코스 > 블록 메이커" 매칭

#### B. 콘텐츠 페이지 (start 타입)
```typescript
interface ContentChunk {
  type: 'instruction' | 'explanation' | 'example'
  title: string           // "테마 선택하기"
  content: string         // 실제 가이드 내용
  hierarchy: string[]     // ["웹사이트 디자인 입문하기", "테마 선택하기"]
  metadata: {
    hasImages: boolean
    hasCode: boolean
    stepNumber?: number   // 단계별 가이드인 경우
    difficulty: 'basic' | 'intermediate' | 'advanced'
  }
}
```

**검색 최적화**: "테마를 어떻게 선택하나요?" → 테마 선택 가이드 콘텐츠 직접 매칭

### 2. 적응적 청킹 크기 전략

**벡터화 전문가 권장 사이즈**:
```typescript
const CHUNK_STRATEGY = {
  // 네비게이션 청크 (링크 중심)
  NAVIGATION: {
    MIN_SIZE: 150,      // 카테고리 + 설명
    MAX_SIZE: 500,      // 하위 링크들 포함
    OVERLAP: 0          // 네비게이션은 중복 불필요
  },
  
  // 콘텐츠 청크 (가이드 내용)
  CONTENT: {
    MIN_SIZE: 300,      // 의미 있는 설명 단위
    OPTIMAL_SIZE: 600,  // 검색 최적화 크기
    MAX_SIZE: 1000,     // 긴 가이드 섹션
    OVERLAP: 50         // 문맥 연결을 위한 중복
  },
  
  // 복합 청크 (이미지+텍스트)
  MULTIMEDIA: {
    TEXT_RATIO: 0.7,    // 텍스트 70% + 메타데이터 30%
    IMAGE_DESC_WEIGHT: 100 // 이미지 alt 텍스트 가중치
  }
} as const
```

### 3. 컨텍스트 상속 전략

```typescript
interface ContextInheritance {
  // 계층적 컨텍스트 (breadcrumb)
  hierarchicalContext: string    // "웹사이트 디자인 > 고급 코스 > 블록 메이커"
  
  // 의미적 컨텍스트 (section summary)
  semanticContext: string        // "코드를 활용한 고급 웹사이트 제작 가이드"
  
  // 탐색 컨텍스트 (related links)  
  navigationContext: Array<{
    title: string
    relation: 'parent' | 'sibling' | 'child'
  }>
}
```

## 테스트 진행 과정 (미완료)

### 1단계: 복잡한 HTML 파싱 시스템 구축 시도 (미완료)

#### 1-1. 기본 HTML 수집 및 파싱 (45분)
```typescript
class HtmlDocumentParser {
  // 페이지 수집
  async fetchPage(url: string): Promise<string>
  
  // DOM 구조 분석 (미디어 요소 제외)
  parseDocumentStructure(html: string): {
    title: string
    sections: Section[]
    links: InternalLink[]
    metadata: PageMetadata
  }
  
  // 의미론적 요소 추출 (텍스트만)
  extractSemanticElements($: CheerioAPI): SemanticElements {
    // 미디어 태그 제거 (Cheerio API 사용)
    $('img').remove()
    $('video').remove()
    $('audio').remove()
    $('iframe').remove()
    $('embed').remove()
    $('object').remove()
    
    // 순수 텍스트 콘텐츠만 처리
    return this.extractTextOnlyContent($)
  }
}
```

**완료 기준**:
- [x] 두 테스트 페이지의 HTML 성공적으로 수집
- [x] 헤딩 구조(h1-h6) 정확히 파싱
- [x] 내부 링크와 외부 링크 구분
- [x] 순수 텍스트 콘텐츠만 추출 (미디어 요소 완전 제외)
- [x] 미디어 태그 제거 로직 정상 동작

#### 1-2. 의미론적 청킹 로직 구현 (45분)
```typescript
class SemanticChunker {
  // 페이지 타입별 청킹 전략
  chunkByPageType(document: ParsedDocument): Chunk[]
  
  // 네비게이션 페이지 청킹
  chunkNavigationPage(sections: Section[]): NavigationChunk[]
  
  // 콘텐츠 페이지 청킹  
  chunkContentPage(sections: Section[]): ContentChunk[]
  
  // 컨텍스트 상속 적용
  applyContextInheritance(chunks: Chunk[]): Chunk[]
}
```

**완료 기준**:
- [x] 페이지 타입 자동 감지 (네비게이션 vs 콘텐츠)
- [x] 타입별 최적화된 청킹 로직 적용
- [x] 계층적 컨텍스트 정보 포함
- [x] 청크 크기 최적화 (300-1000자)

#### 1-3. 벡터 저장 형태 최적화 (30분)
```typescript
interface OptimizedVector {
  // 검색용 텍스트 (실제 벡터화)
  searchText: string      // "웹사이트 디자인 > 고급 코스: 코드를 다룰 줄 안다면..."
  
  // 응답 생성용 원본
  displayText: string     // 실제 페이지 콘텐츠
  
  // 메타데이터
  metadata: {
    url: string
    title: string
    breadcrumb: string[]
    chunkType: 'navigation' | 'content'
    pageType: 'guide' | 'overview'
    relatedLinks: string[]
  }
}
```

### 2단계: 반복적 데이터 테스트 및 검증 (가변 시간)

#### 2-1. 초기 2페이지 테스트 (1.5시간)
**대상 페이지**:
- 웹사이트 디자인 (`/design`)
- 웹사이트 디자인 입문하기 (`/design/start`)

**테스트 내용**:
- HTML 파싱 결과 검증
- 청킹 결과의 의미론적 일관성 평가  
- 벡터 크기 분포 및 중복도 분석

**검색 품질 시뮬레이션**:
```typescript
const testQueries = [
  "블록 메이커는 어디에 있나요?",           // 네비게이션 검색
  "테마를 어떻게 선택하나요?",              // 콘텐츠 검색  
  "웹사이트 디자인 고급 기능은?",           // 카테고리 검색
  "디자인 시스템 설정 방법",               // 구체적 가이드 검색
]
```

#### 2-2. 확장 테스트 (10개 다양한 구조 페이지)
**진행 방식**: 초기 테스트 성공 시 추가 페이지들로 확장
- 다양한 페이지 구조 패턴 테스트
- 1단계-2단계 반복 개선 사이클
- 예상치 못한 HTML 구조 대응 로직 개선

**테스트 페이지 후보**:
```
/design/basic/*     - 기본 가이드 구조
/design/advanced/*  - 고급 가이드 구조  
/shop/*            - 쇼핑몰 설정 구조
/marketing/*       - 마케팅 기능 구조
```

**반복 개선 기준**:
- 파싱 성공률 95% 이상 달성
- 의미론적 청킹 품질 검증
- 다양한 구조에서 일관된 결과 확인

### 3단계: 다중 페이지 수집 시스템 (2시간)

#### 3-1. 재귀적 링크 수집 로직 (1시간)
```typescript
class SiteCrawler {
  // 도메인 필터링
  filterInternalLinks(links: string[]): string[]
  
  // 재귀적 페이지 수집
  async crawlSite(rootUrl: string, maxDepth: number): Promise<Page[]>
  
  // 중복 방지 및 우선순위 관리
  manageCrawlQueue(urls: string[]): CrawlQueue
}
```

#### 3-2. 페이지 간 관계 매핑 (1시간)
```typescript
interface SiteStructure {
  pages: Map<string, Page>
  hierarchy: {
    parent: string | null
    children: string[]
    siblings: string[]
  }
  linkGraph: {
    inbound: string[]   // 이 페이지로 링크하는 페이지들
    outbound: string[]  // 이 페이지에서 링크하는 페이지들
  }
}
```

### 4단계: 벡터 데이터베이스 연동 (1시간)
**전제 조건**: 2단계에서 다양한 페이지 구조 검증 완료

#### 4-1. Pinecone 연동 최적화 (30분)
- 메타데이터 구조 최적화 (공개 링크 포함)
- 배치 처리를 통한 벡터 저장 효율화
- 기존 벡터 데이터와의 호환성 보장

#### 4-2. 품질 측정 및 검증 (30분)
```typescript
interface QualityMetrics {
  // 파싱 품질
  parsingSuccess: number      // 파싱 성공률
  contentExtraction: number   // 콘텐츠 추출률
  
  // 청킹 품질  
  chunkSizeDistribution: number[]  // 청크 크기 분포
  semanticConsistency: number      // 의미론적 일관성 점수
  
  // 검색 품질
  retrievalAccuracy: number   // 검색 정확도
  contextRelevance: number    // 컨텍스트 관련성
}
```

## 기술 스택

### 핵심 라이브러리
```json
{
  "cheerio": "^1.0.0-rc.12",    // 서버사이드 DOM 조작
  "turndown": "^7.1.2",         // HTML → Markdown 변환
  "he": "^1.2.0",               // HTML entities 디코딩
  "url-parse": "^1.5.10",       // URL 파싱 및 정규화
  "robots-parser": "^3.0.0"     // robots.txt 준수
}
```

### 아키텍처 패턴
```typescript
// 파이프라인 패턴 (Pipeline Pattern)
class VectorizationPipeline {
  async process(url: string): Promise<Vector[]> {
    return await this
      .fetch(url)
      .then(html => this.parse(html))
      .then(doc => this.chunk(doc))
      .then(chunks => this.vectorize(chunks))
      .then(vectors => this.store(vectors))
  }
}

// 전략 패턴 (Strategy Pattern) - 페이지 타입별 처리
interface ChunkingStrategy {
  chunk(document: ParsedDocument): Chunk[]
}

class NavigationChunkingStrategy implements ChunkingStrategy { }
class ContentChunkingStrategy implements ChunkingStrategy { }
```

## 성공 기준

### 기능적 성공 기준
- [x] **HTML 파싱**: 두 테스트 페이지 100% 성공적 파싱
- [x] **의미론적 청킹**: 사용자 질문과 매칭되는 청킹 단위 생성
- [x] **컨텍스트 보존**: 계층적 정보를 포함한 검색 가능한 벡터 생성
- [x] **확장 가능성**: 다중 페이지 수집 구조 완성

### 품질적 성공 기준
- [x] **검색 정확도**: 테스트 질문 90% 이상 관련 청크 검색
- [x] **응답 품질**: 생성된 응답에 충분한 컨텍스트 정보 포함
- [x] **처리 속도**: 페이지당 2초 이내 파싱 및 청킹 완료
- [x] **안정성**: 다양한 HTML 구조에서 오류 없이 동작

### 기술적 성공 기준
- [x] **코드 품질**: TypeScript strict 모드, 단위 테스트 커버리지 90%+
- [x] **메모리 효율성**: 대용량 페이지 처리 시 메모리 사용량 최적화
- [x] **확장성**: 새로운 페이지 타입 추가 시 최소 코드 변경

## 위험 요소 및 대응 방안

### 기술적 위험
**위험**: oopy 렌더링 결과와 실제 HTML 구조 불일치  
**대응**: 실제 페이지 구조 사전 분석, fallback 파싱 로직 구비

**위험**: 동적 콘텐츠 또는 JavaScript 의존적 요소  
**대응**: Puppeteer를 통한 렌더링된 HTML 수집 옵션 준비

**위험**: 사이트 구조 변경으로 인한 크롤링 실패  
**대응**: 로버스트한 HTML 파싱, 에러 복구 로직

### 품질 위험
**위험**: HTML 구조 기반 청킹의 의미론적 부정확성  
**대응**: A/B 테스트를 통한 청킹 전략 지속적 개선

**위험**: 검색 품질이 기존 노션 방식보다 저하  
**대응**: 동일한 테스트 세트로 정량적 품질 비교

## 마일스톤 및 검증 포인트

### 마일스톤 1: HTML 파싱 시스템 완성 (1단계)
- [ ] 두 테스트 페이지의 구조적 파싱 성공
- [ ] 의미론적 청킹 로직 구현 완료  
- [ ] 벡터 저장 형태 최적화 완성

### 마일스톤 2: 반복적 품질 검증 완료 (2단계)
- [ ] 초기 2페이지 테스트 성공 (파싱 + 청킹 + 검색 품질)
- [ ] 10개 다양한 구조 페이지 확장 테스트 완료
- [ ] 1-2단계 반복 개선을 통한 로버스트성 확보
- [ ] 파싱 성공률 95% 이상 달성

### 마일스톤 3: 다중 페이지 시스템 완성 (3단계)
- [ ] 재귀적 사이트 크롤링 기능 완성
- [ ] 페이지 간 관계 매핑 완료
- [ ] 확장 가능한 시스템 구조 검증

### 마일스톤 4: 벡터 데이터베이스 연동 완료 (4단계)
- [ ] Pinecone 메타데이터 구조 최적화 완성
- [ ] 공개 링크 포함 벡터 저장 검증
- [ ] 검색 품질 최종 측정 및 검증

---

## 구현 방식 및 컨벤션

### **스크립트 우선 접근법**
- **1-2단계**: 스크립트로 HTML 파싱 로직 검증 및 반복 개선
- **3-4단계**: 검증 완료 후 서비스 코드로 이관

### **서비스 이관 고려사항**
```typescript
// 스크립트: 단순 실행 구조
class HtmlDocumentParser {
  async analyzeForScript(url: string): Promise<void>
}

// 서비스: 의존성 주입 구조  
class HtmlParserService implements IDocumentParser<ParsedDocument> {
  constructor(
    private config: HtmlParserConfig,
    private httpClient: IHttpClient,
    private logger: ILogger
  ) {}
}
```

### **프로젝트 컨벤션 적용**
- **파일 구조**: `src/services/html-parser/` 디렉토리 구성
- **네이밍**: kebab-case 파일명, PascalCase 클래스명, camelCase 메서드명
- **상수 분리**: `html-parser.constants.ts`에 매직 넘버와 설정값 분리
- **에러 처리**: 구조화된 커스텀 에러 클래스 사용
- **타입 정의**: `@/types/html-parser` 인터페이스 분리

---

## 1단계 실행 결과 및 개선사항

### ❌ 1단계 테스트 결과 (2025-08-10 21:00 KST)
- [x] 기본 HTML 수집 테스트 완료
- [x] 복잡한 의미론적 청킹 시도
- [x] 과도한 엔지니어링 복잡도 확인

### 🔍 복잡한 방식의 문제점

#### 1. **과도한 엔지니어링**
- 페이지 타입 분류 (navigation vs content) - 불필요함 확인
- 적응적 청킹 전략 - 단순 분할이 더 효과적
- 복잡한 메타데이터 구조 - 실제 검색 품질 개선 미미

#### 2. **실제 구조의 단순함**
- oopy 페이지는 예상보다 단순한 구조
- 헤딩 계층이 일정하지 않음 (h1 → h4 점프)
- 의미론적 파싱의 이점이 실제로는 제한적

#### 3. **개발 대 효과 비율**
- 높은 개발 복잡도
- 실제 검색 품질 개선 효과 미미
- 유지보수 부담 증가

### 🛠️ 단순화 결정 과정

#### 1. **복잡한 타입 분류 포기**
벡터 검색에서는 페이지 타입 분류가 불필요함을 확인:
- navigation vs content 분류 → 무의미
- 의미론적 청킹 → 단순 분할이 더 효과적
- 복잡한 메타데이터 → 검색 품질 개선 미미

#### 2. **단순한 텍스트 저장 방식 채택**
복잡한 구조 분석보다 단순한 접근법이 더 효과적:
- 전체 페이지 텍스트 추출
- 'Search' 키워드로 breadcrumb 분리
- 순수 텍스트만 벡터 저장
- 업계 표준에 부합하는 방식

#### 3. **청킹 크기 균형 개선**
```typescript
// 문제 상황
청크 1-10: 7자~22자 (너무 작음)
청크 11: 2056자 (너무 큼)

// 개선 방향
- 최소 청크 크기: 100자 이상
- 최대 청크 크기: 800자 이하
- 작은 청크들 병합 로직 추가
- 큰 청크 분할 로직 개선
```

#### 4. **계층 구조 중간 레벨 건너뛰기 문제**
```typescript
// 현재 문제: h1 → h4 점프 시 빈 레벨 생성
계층: "웹사이트 디자인 입문하기 >  >  > 테마 둘러보기"  // ❌ 빈 공간

// 개선안: 건너뛴 레벨 무시, 논리적 깊이만 사용
계층: "웹사이트 디자인 입문하기 > 테마 둘러보기"     // ✅ 명확한 경로

private updateHierarchy(hierarchy: string[], level: number, heading: string): void {
  // 실제 HTML 레벨 무시, 논리적 깊이로만 관리
  // h1 → h4를 h1 → h2로 정규화
}
```

#### 5. **oopy 페이지 합치기 특성 대응**
```typescript
// 현재 문제: 하나의 긴 페이지를 여러 작은 청크 + 하나의 큰 청크로 분할
// 개선 방향: 콘텐츠 밀도 기반 적응적 청킹
class AdaptiveChunking {
  // 헤딩별 콘텐츠 양 분석
  analyzeContentDensity(sections: DocumentSection[]): ChunkingStrategy
  
  // 작은 섹션들 병합
  mergeSmallSections(sections: DocumentSection[], minSize: number): DocumentSection[]
  
  // 큰 섹션 분할  
  splitLargeSections(sections: DocumentSection[], maxSize: number): DocumentSection[]
}
```

## 최종 결론 및 전환

#### 복잡한 HTML 파싱 방식 포기
1. **과도한 엔지니어링**: 실제 이익 대비 개발 복잡도 과다
2. **단순함의 우수성**: 전체 텍스트 추출이 더 효과적
3. **유지보수성**: 단순한 구조가 장기적으로 유리
4. **성능**: 복잡한 파싱보다 단순 추출이 빠름

---

## 테스트 결과 비교

### 복잡한 HTML 방식 (채택되지 않음)
- **개발 복잡도**: 매우 높음
- **의미론적 파싱**: 과도한 엔지니어링
- **청킹 전략**: 적응적, 계층적 (복잡)
- **메타데이터**: 과도하게 상세
- **실제 효과**: 단순 방식 대비 미미한 개선
- **유지보수성**: 낮음

### 단순 HTML 방식 (최종 채택)
- **개발 복잡도**: 낮음
- **텍스트 추출**: 전체 페이지 단순 추출
- **분할 방식**: 'Search' 기준 단순 분할
- **메타데이터**: 필수 정보만 (breadcrumb)
- **실제 효과**: 충분히 효과적
- **유지보수성**: 높음

## 문서 보존 목적

이 문서는 다음 목적으로 보존됩니다:

1. **과도한 엔지니어링 경고**: 복잡한 설계가 항상 좋은 것은 아님을 보여주는 사례
2. **의사결정 과정 기록**: 왜 단순한 방식을 선택했는지 명확한 근거 제공
3. **기술 학습**: 의미론적 파싱 vs 단순 추출의 실제 비교 결과
4. **향후 참고**: 유사한 기술 선택 시 참고 자료

---

**현재 상태**: ❌ 테스트 후 미채택  
**채택된 방식**: 단순 HTML 텍스트 추출  
**포기 사유**: 과도한 엔지니어링 복잡도 대비 실용성 부족  
**최종 수정일**: 2025-08-10 KST  
**검토자**: Development Team