# HTML 파서 전략 패턴 리팩토링 - Stage 3.5

> **작성일**: 2025-08-10 18:30 KST  
> **대상**: HTML 텍스트 추출 시스템 범용성 확보  
> **목적**: oopy 전용 로직을 전략 패턴으로 분리하여 다양한 사이트 지원  
> **상태**: 📋 **계획 수립 완료**

## 개요

현재 HtmlService는 oopy 사이트 전용 로직('Search' 문자열 기준 분할)이 하드코딩되어 있어 범용성이 부족합니다. 전략 패턴을 도입하여 사이트별 파싱 로직을 분리하고 확장 가능한 구조로 리팩토링합니다.

## 현재 문제점

### **하드코딩된 oopy 전용 로직**
```typescript
// src/services/html/html.service.ts
const parts = fullText.split(contentSeparator) // 'Search' 기준 분할
const breadcrumbText = parts[0]?.trim() || ''
const mainContent = parts.slice(1).join(contentSeparator).trim()
```

### **제한사항**
- oopy 사이트에만 적용 가능
- 다른 사이트(WordPress, 일반 HTML) 처리 불가
- 커스텀 도메인 사용 시 감지 어려움
- 유지보수 시 전체 서비스 영향

## 설계 방향

### **1. 전략 패턴 적용**
- 사이트별 파싱 로직을 독립적인 전략 클래스로 분리
- 자동 감지를 통한 적절한 전략 선택
- 확장 가능한 구조로 향후 새 사이트 유형 추가 용이

### **2. 최소 구현 범위**
- **oopy 파서**: 기존 로직 유지 (Search 기준 분할)
- **generic 파서**: 일반 HTML 처리 (title, body만 추출)

### **3. oopy 감지 로직 개선**
- URL 기반: `oopy.io` 도메인 확인
- HTML 기반: `window.__OOPY__`, `oopy.lazyrockets.com`, `oopy-footer` 등 oopy 고유 요소 검사

## 구현 계획

### **Phase 1: 파서 전략 인터페이스 및 기본 구조** ⏳
#### 목표
파서 전략 패턴의 기본 구조를 구현하고 현재 로직을 oopy 전략으로 분리

#### 작업 내용
- [ ] **파서 전략 인터페이스 정의**
  ```typescript
  // src/types/html-parser.ts
  export interface HtmlParserStrategy {
    name: string
    extractContent(html: string, url: string): {
      title: string
      content: string
      breadcrumb: string[]
    }
    isApplicable(html: string, url: string): boolean
  }
  ```

- [ ] **파서 매니저 구현**
  ```typescript
  // src/services/html/html-parser.manager.ts
  export class HtmlParserManager {
    private strategies: HtmlParserStrategy[]
    selectStrategy(html: string, url: string): HtmlParserStrategy
  }
  ```

- [ ] **파서 디렉토리 구조 생성**
  ```
  src/services/html/parsers/
  ├── oopy-parser.ts           # oopy 사이트 전용 파서
  ├── generic-parser.ts        # 일반 HTML 파서
  └── index.ts                 # 파서들 export
  ```

### **Phase 2: oopy 파서 구현** ⏳
#### 목표
기존 oopy 전용 로직을 독립적인 전략으로 분리

#### 작업 내용
- [ ] **oopy 파서 전략 구현**
  ```typescript
  // src/services/html/parsers/oopy-parser.ts
  export class OopyParser implements HtmlParserStrategy {
    name = 'oopy'
    
    isApplicable(html: string, url: string): boolean {
      // URL 기반 검사
      if (url.includes('oopy.io')) return true
      
      // HTML 내용 기반 검사
      return html.includes('window.__OOPY__') ||
             html.includes('oopy.lazyrockets.com') ||
             html.includes('oopy-footer') ||
             html.includes('OopyFooter_container')
    }
    
    extractContent(html: string, url: string) {
      // 기존 'Search' 기준 분할 로직 그대로 이전
    }
  }
  ```

- [ ] **oopy 감지 로직 정교화**
  - URL 패턴: `*.oopy.io`, `oopy.io` 하위 도메인
  - HTML 요소: `window.__OOPY__` 스크립트
  - CSS 클래스: `oopy-footer`, `OopyFooter_container`
  - API 경로: `oopy.lazyrockets.com`

### **Phase 3: Generic 파서 구현** ⏳
#### 목표
일반 HTML 문서 처리를 위한 기본 파서 구현

#### 작업 내용
- [ ] **Generic 파서 전략 구현**
  ```typescript
  // src/services/html/parsers/generic-parser.ts
  export class GenericParser implements HtmlParserStrategy {
    name = 'generic'
    
    isApplicable(): boolean {
      return true // 항상 적용 가능 (fallback)
    }
    
    extractContent(html: string, url: string) {
      const $ = cheerio.load(html)
      
      return {
        title: $('title').text().trim() || $('h1').first().text().trim() || '제목 없음',
        content: this.extractMainContent($),
        breadcrumb: [] // 일반 HTML에서는 breadcrumb 추출 어려움
      }
    }
    
    private extractMainContent($: CheerioAPI): string {
      // 우선순위: main > article > .content > body
      const contentSelectors = ['main', 'article', '.content', 'body']
      for (const selector of contentSelectors) {
        const element = $(selector).first()
        if (element.length > 0) {
          return element.text().trim()
        }
      }
      return ''
    }
  }
  ```

### **Phase 4: HtmlService 리팩토링** ⏳
#### 목표
기존 HtmlService에 전략 패턴 적용 및 하위 호환성 유지

#### 작업 내용
- [ ] **HtmlService.extractText 메서드 리팩토링**
  ```typescript
  // src/services/html/html.service.ts
  export class HtmlService {
    private parserManager = new HtmlParserManager()
    
    extractText(html: string, url: string, options?: HtmlParsingOptions): SimpleDocument {
      // 전략 선택
      const parser = this.parserManager.selectStrategy(html, url)
      console.log(`  🔍 파서 선택: ${parser.name}`)
      
      // 파싱 실행
      const { title, content, breadcrumb } = parser.extractContent(html, url)
      
      // 기존과 동일한 SimpleDocument 반환
      return {
        url, title, content,
        wordCount: content.length,
        breadcrumb,
        timestamp: new Date().toISOString()
      }
    }
  }
  ```

- [ ] **기존 파싱 옵션 유지**
  - `includeTitle` 옵션 각 전략에서 처리
  - `unnecessaryTags` 제거 로직 각 전략에서 처리

### **Phase 5: 테스트 및 검증** ⏳
#### 목표
리팩토링된 코드의 정확성 검증 및 하위 호환성 확인

#### 작업 내용
- [ ] **파서별 단위 테스트 작성**
  ```typescript
  // tests/unit/services/html/parsers/
  ├── oopy-parser.test.ts
  ├── generic-parser.test.ts
  └── html-parser.manager.test.ts
  ```

- [ ] **기존 테스트 통과 확인**
  - oopy 사이트 대상 기존 테스트 모두 통과
  - 추출 결과 동일성 검증

- [ ] **새로운 사이트 유형 테스트**
  - 일반 HTML 문서 파싱 테스트
  - 커스텀 도메인 oopy 사이트 감지 테스트

## 기술적 고려사항

### **파서 우선순위**
1. **oopy**: oopy 관련 요소 감지 시 최우선
2. **generic**: 기본 fallback 전략 (항상 적용 가능)

### **성능 최적화**
- 파서 감지 로직은 빠른 검사 우선 (URL → HTML 간단 검사 → 복잡한 HTML 분석)
- 한 번 선택된 전략은 세션 동안 재사용 검토

### **확장성 고려**
- 향후 WordPress, Notion 파서 추가 시 최소한의 변경으로 확장 가능
- 파서 등록 방식으로 플러그인 형태 지원 가능

## 기대 효과

### **범용성 확보**
- oopy 외 다양한 사이트 지원 가능
- 커스텀 도메인 oopy 사이트 정확한 감지

### **유지보수성 향상**
- 사이트별 로직 독립화로 수정 영향도 최소화
- 새로운 사이트 유형 추가 시 기존 코드 영향 없음

### **테스트 용이성**
- 파서별 독립적인 단위 테스트 가능
- 각 전략의 책임 명확화

## 완료 기준

- [ ] 기존 oopy 사이트 크롤링 결과 동일성 보장
- [ ] 일반 HTML 사이트 기본 파싱 기능 동작
- [ ] 커스텀 도메인 oopy 사이트 정확한 감지
- [ ] 모든 기존 테스트 통과
- [ ] TypeScript 컴파일 에러 없음

---

**현재 상태**: 📋 계획 수립 완료  
**다음 단계**: Phase 1 - 파서 전략 인터페이스 구현  
**예상 소요 시간**: 2-3시간  
**최종 수정일**: 2025-08-10 18:30 KST  
**책임자**: Development Team