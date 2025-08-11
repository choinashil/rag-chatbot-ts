/**
 * 파서 이름 타입
 */
export type ParserName = 'oopy' | 'generic'

/**
 * 동적 크롤링 전략
 */
export interface CrawlingStrategy {
  useDynamic: boolean
  reason?: string
  metadata?: Record<string, any>
}

/**
 * HTML 파서 전략 인터페이스
 * 
 * 사이트별 HTML 파싱 로직을 캡슐화하는 전략 패턴 인터페이스
 */
export interface HtmlParserStrategy {
  /** 파서 이름 (디버깅/로깅용) */
  name: ParserName

  /**
   * 해당 파서가 주어진 HTML/URL에 적용 가능한지 판단
   * @param html HTML 문서 내용
   * @param url 대상 URL
   * @returns 적용 가능 여부
   */
  isApplicable(html: string, url: string): boolean

  /**
   * 동적 크롤링 필요 여부 결정
   * @param html HTML 문서 내용
   * @returns 크롤링 전략
   */
  shouldUseDynamicCrawling(html: string): CrawlingStrategy

  /**
   * 동적 크롤링을 위한 페이지 설정 함수 반환
   * @returns Puppeteer Page 설정 함수 (undefined면 동적 크롤링 불필요)
   */
  getDynamicCrawlingSetup(): ((page: any) => Promise<void>) | undefined

  /**
   * 정적 HTML에서 콘텐츠 추출
   * @param html HTML 문서 내용
   * @param url 대상 URL
   * @returns 파싱된 콘텐츠
   */
  parseStaticContent(html: string, url: string): {
    title: string
    content: string
    breadcrumb: string[]
  }

  /**
   * 동적 크롤링으로 얻은 콘텐츠 파싱
   * @param content 동적 크롤링된 텍스트
   * @param url 대상 URL
   * @param metadata 크롤링 메타데이터
   * @param originalHtml 원본 HTML (title, breadcrumb 추출용)
   * @returns 파싱된 콘텐츠
   */
  parseDynamicContent(content: string, url: string, metadata?: any, originalHtml?: string): {
    title: string
    content: string
    breadcrumb: string[]
  }

  // 기존 메서드 호환성 유지 (deprecated)
  /**
   * @deprecated parseStaticContent 사용 권장
   */
  extractContent(html: string): {
    title: string
    content: string
    breadcrumb: string[]
  }
}

/**
 * HTML 파싱 옵션 확장
 */
export interface HtmlParsingOptionsExtended {
  contentSeparator?: string
  unnecessaryTags?: string
  includeTitle?: boolean
  /** 특정 파서 전략 강제 사용 (선택사항) */
  parserStrategy?: string
}