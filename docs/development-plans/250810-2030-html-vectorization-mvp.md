# HTML 크롤링 벡터화 MVP 구현 - Stage 5

> **작성일**: 2025-08-10 20:30 KST  
> **대상**: HTML 크롤링 결과를 Pinecone 벡터 데이터베이스에 저장  
> **목적**: 크롤링된 HTML 문서의 기본 벡터화 저장 기능 구현 (MVP)  
> **상태**: 📋 **계획 수립 완료**

## 개요

HTML 크롤링 시스템(Stage 3-4 완료)과 Pinecone 벡터 저장을 연결하여 **가장 단순한 형태**의 벡터화 저장 기능을 구현합니다. 복잡한 기능은 배제하고 **동작하는 제품**을 빠르게 만드는 것에 집중합니다.

## MVP 핵심 목표 🎯

**"크롤링한 HTML 페이지들을 벡터로 변환해서 Pinecone에 저장한다"**

- ✅ **단순함**: 복잡한 로직 없이 기본 동작만
- ✅ **안정성**: 에러 없이 동작하는 것 우선
- ✅ **확장성**: 나중에 기능 추가 가능한 구조

## 현재 상황 분석

### ✅ **이미 구현된 것**
- HTML 크롤링: `HtmlCrawlerService` (Stage 3-4 완료)
- 벡터 저장: `PineconeService.upsert()` 
- 임베딩 생성: `EmbeddingService.createEmbedding()`
- 노션 문서 처리: `DocumentProcessor` (노션 전용)

### ❌ **부족한 것**
- HTML 문서 → 벡터 변환 연결고리
- 크롤링 결과를 일괄 처리하는 기능

## MVP 구현 계획

### **Phase 1: DocumentProcessor HTML 지원 최소 확장** ⏳
#### 목표
기존 DocumentProcessor에 HTML 문서 처리 메서드 하나만 추가

#### 작업 내용
- [ ] **HTML 문서 처리 메서드 추가**
  ```typescript
  export class DocumentProcessor {
    // 🆕 추가: HTML 문서 처리 (단순 버전)
    async processHtmlDocument(crawledDoc: CrawledDocument): Promise<void> {
      // 1. 임베딩 생성 (제목 + 내용)
      const embeddingText = `${crawledDoc.title}\n\n${crawledDoc.content}`
      const embedding = await this.embeddingService.createEmbedding(embeddingText)
      
      // 2. 벡터 데이터 구성 (전체 내용 저장 - 소규모에 최적)
      const vectorData: VectorData = {
        id: `html-${this.generateSimpleId(crawledDoc.url)}`,
        vector: embedding.embedding,
        metadata: {
          title: crawledDoc.title,
          content: crawledDoc.content, // 🎯 전체 내용 저장 (100개 문서에 최적)
          source: 'html',
          url: crawledDoc.url,
          timestamp: new Date().toISOString()
        }
      }
      
      // 3. Pinecone 저장
      await this.pineconeService.upsert(vectorData)
    }
  }
  ```

- [ ] **단순한 ID 생성 로직**
  ```typescript
  private generateSimpleId(url: string): string {
    // URL을 base64로 인코딩 후 처음 16자리만 사용
    return Buffer.from(url).toString('base64').substring(0, 16)
  }
  ```

### **Phase 2: 배치 처리 + 진행률 표시** ⏳
#### 목표
여러 HTML 문서를 순차적으로 처리하면서 진행률을 실시간 표시

#### 작업 내용
- [ ] **순차 배치 처리 메서드**
  ```typescript
  export class DocumentProcessor {
    // 🆕 추가: 여러 HTML 문서 순차 처리
    async processHtmlDocuments(documents: CrawledDocument[]): Promise<BatchResult> {
      const result: BatchResult = {
        total: documents.length,
        processed: 0,
        failed: 0,
        errors: []
      }
      
      for (const [index, doc] of documents.entries()) {
        try {
          // 🎯 진행률 표시 개선
          console.log(`📄 [${index + 1}/${documents.length}] 처리 중: ${doc.title}`)
          console.log(`   진행률: ${Math.round((index / documents.length) * 100)}%`)
          
          await this.processHtmlDocument(doc)
          result.processed++
          
          console.log(`   ✅ 완료: ${doc.title}`)
          console.log(`   📊 누적: 성공 ${result.processed}개, 실패 ${result.failed}개`)
          console.log('') // 구분선
        } catch (error) {
          console.error(`   ❌ 실패: ${doc.title}`, error)
          result.failed++
          result.errors.push({
            url: doc.url,
            title: doc.title,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
          })
        }
      }
      
      return result
    }
  }
  
  interface BatchResult {
    total: number
    processed: number
    failed: number
    errors: Array<{url: string, title: string, error: string}>
  }
  ```

### **Phase 3: 자동 크롤링+벡터화 구현** ⏳
#### 목표
`autoVectorize: true` 옵션으로 크롤링과 벡터화를 한 번에 처리

#### 작업 내용
- [ ] **CrawlOptions에 autoVectorize 옵션 추가**
  ```typescript
  interface CrawlOptions {
    // ... 기존 옵션들
    autoVectorize?: boolean  // 🆕 자동 벡터화 옵션
  }
  ```

- [ ] **HtmlCrawlerService 자동 벡터화 구현**
  ```typescript
  export class HtmlCrawlerService extends HtmlService {
    constructor(
      private documentProcessor?: DocumentProcessor  // 선택적 의존성
    ) { super() }
    
    async crawlSite(startUrl: string, options?: Partial<CrawlOptions>): Promise<CrawlSession> {
      const crawlOptions: CrawlOptions = { ...DEFAULT_CRAWL_OPTIONS, ...options }
      
      // 기존 크롤링 로직...
      const session = await this.performCrawling(startUrl, crawlOptions)
      
      // 🎯 자동 벡터화 처리
      if (crawlOptions.autoVectorize && this.documentProcessor) {
        console.log('🧠 자동 벡터화 시작...')
        const documents = this.getCrawledDocuments()
        const vectorResult = await this.documentProcessor.processHtmlDocuments(documents)
        
        // 세션에 벡터화 결과 추가
        session.vectorizationResult = vectorResult
        console.log(`🎉 벡터화 완료: ${vectorResult.processed}개 성공`)
      }
      
      return session
    }
  }
  ```

- [ ] **CrawlSession에 벡터화 결과 필드 추가**
  ```typescript
  interface CrawlSession {
    // ... 기존 필드들
    vectorizationResult?: BatchResult  // 벡터화 결과
  }
  ```

### **Phase 4: 실사용 스크립트** ⏳
#### 목표
실제로 사용할 수 있는 단순한 스크립트 작성

#### 작업 내용
- [ ] **크롤링 + 벡터화 스크립트**
  ```typescript
  // scripts/crawl-and-vectorize-simple.ts
  import { HtmlCrawlerService } from '../src/services/html/html-crawler.service'
  import { DocumentProcessor } from '../src/services/document/document.processor'
  // ... 기타 import
  
  async function main() {
    // 1. 서비스 초기화
    const documentProcessor = new DocumentProcessor(
      notionService, embeddingService, pineconeService
    )
    const crawler = new HtmlCrawlerService(documentProcessor)  // 의존성 주입
    
    // 2. 🎯 원클릭 크롤링+벡터화
    console.log('🚀 크롤링+벡터화 시작...')
    const session = await crawler.crawlSite('https://help.pro.sixshop.com/', {
      maxPages: 10,
      maxDepth: 2,
      autoVectorize: true  // 🎉 자동 벡터화!
    })
    
    // 3. 결과 출력
    console.log('🎉 모든 작업 완료!')
    console.log(`📄 크롤링: ${session.statistics.processedPages}페이지`)
    if (session.vectorizationResult) {
      console.log(`🧠 벡터화: ${session.vectorizationResult.processed}개 성공, ${session.vectorizationResult.failed}개 실패`)
    }
  }
  
  main().catch(console.error)
  ```

### **Phase 5: 기본 테스트** ⏳
#### 목표
핵심 기능이 동작하는지만 확인하는 단순한 테스트

#### 작업 내용
- [ ] **통합 테스트 하나만**
  ```typescript
  // tests/integration/html-vectorization-basic.test.ts
  describe('HTML Vectorization Basic', () => {
    test('크롤링 결과를 벡터화할 수 있다', async () => {
      // 1. 작은 HTML 페이지 크롤링
      const crawler = new HtmlCrawlerService()
      await crawler.crawlSite(testUrl, { maxPages: 2 })
      
      // 2. 벡터화
      const result = await crawler.vectorizeCrawlResults(documentProcessor)
      
      // 3. 기본 검증
      expect(result.processed).toBeGreaterThan(0)
      expect(result.errors).toHaveLength(0)
    })
  })
  ```

## 완료 기준 (MVP)

### **필수 요구사항**
- [ ] HTML 문서 → 벡터 변환 동작
- [ ] 여러 문서 순차 처리 + 진행률 표시
- [ ] 자동 크롤링+벡터화 (`autoVectorize: true`) 동작
- [ ] 에러 발생 시 중단되지 않고 계속 진행
- [ ] 실사용 스크립트 원클릭 동작

### **품질 요구사항**
- [ ] TypeScript 컴파일 에러 없음
- [ ] 기본 통합 테스트 통과
- [ ] 10개 페이지 벡터화 5분 이내 완료

## 제외사항 (추후 구현)

❌ **지금은 구현하지 않음:**
- 동시성 제어 (concurrency)
- 중복 벡터 감지
- 고도화된 메타데이터 (breadcrumb, depth 등)
- 변경 감지 및 자동 업데이트
- 검색 최적화
- 재시도 로직

## 다음 단계: Stage 6 - DocumentProcessor 아키텍처 개선 🏗️

### **배경**
현재 MVP에서는 기존 노션 전용 `DocumentProcessor`에 `processHtmlDocument()` 메서드를 추가하는 방식으로 구현합니다. 하지만 이는 임시적인 해결책이며, 아키텍처 개선이 필요합니다.

### **Stage 6 목표: 전략 패턴 도입**
- **확장 가능한 구조**: PDF, Word 등 추가 문서 타입 지원 용이
- **단일 책임 원칙**: 각 문서 타입별 독립적인 처리 로직
- **테스트 용이성**: 문서 타입별 독립적인 테스트

### **상세 계획**: [`250810-2130-html-vectorization-integration.md - Stage 6 섹션`](./250810-2130-html-vectorization-integration.md#📋-stage-6-documentprocessor-전략-패턴-리팩토링-mvp-완료-후-적용)

---

## 추후 개선 아이디어 💡

### **우선순위 1 (다음 버전)**
- **동시성 처리**: 3-5개 문서 동시 벡터화로 속도 3배 향상

### **우선순위 2 (중기)**
- **중복 관리**: 기존 벡터 스킵 기능
- **메타데이터 확장**: breadcrumb, depth, domain 등
- **에러 복구**: 재시도 로직

### **우선순위 3 (규모 확장시)**
- **스마트 청킹**: 문서 규모가 1000개+ 될 때 적용
- **하이브리드 저장**: 큰 문서는 요약+별도DB, 작은 문서는 전체 저장  
- **변경 감지**: 콘텐츠 변경 시 자동 업데이트
- **검색 최적화**: 메타데이터 필터링 활용

## 예상 소요 시간

- **Phase 1**: 2시간 (HTML 처리 메서드)
- **Phase 2**: 1.5시간 (배치 처리 + 진행률 표시)  
- **Phase 3**: 2시간 (자동 크롤링+벡터화 연동)
- **Phase 4**: 1시간 (실사용 스크립트)
- **Phase 5**: 1시간 (기본 테스트)
- **총 예상 시간**: 7.5시간

---

**현재 상태**: 📋 계획 수립 완료  
**다음 단계**: Phase 1 - DocumentProcessor HTML 지원 최소 확장  
**목표**: 단순하게 동작하는 MVP 완성  
**최종 수정일**: 2025-08-10 20:30 KST  
**책임자**: Development Team