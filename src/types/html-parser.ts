/**
 * 파서 이름 타입
 */
export type ParserName = 'oopy' | 'generic'

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
   * HTML에서 제목, 내용, breadcrumb을 추출
   * @param html HTML 문서 내용  
   * @param url 대상 URL
   * @returns 파싱된 콘텐츠
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