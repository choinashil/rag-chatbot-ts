import * as cheerio from 'cheerio'
import type { HtmlParserStrategy } from '../../../types/html-parser'

/**
 * Oopy 사이트에서 사용되는 상수
 */
const OOPY_CONSTANTS = {
  /** breadcrumb과 content를 구분하는 키워드 */
  CONTENT_SEPARATOR: 'Search'
} as const

/**
 * Oopy 사이트 전용 HTML 파서
 * 
 * 'Search' 키워드 기준으로 breadcrumb와 content를 분리하는 oopy 전용 로직
 */
export class OopyParser implements HtmlParserStrategy {
  name = 'oopy' as const

  /**
   * Oopy 사이트 여부 판단
   * URL 패턴과 HTML 내 oopy 고유 요소를 검사
   */
  isApplicable(html: string, url: string): boolean {
    // URL 기반 검사 (oopy.io 도메인)
    if (url.includes('oopy.io')) {
      return true
    }

    // HTML 내용 기반 검사 (oopy 고유 요소들)
    return html.includes('window.__OOPY__') ||
           html.includes('oopy.lazyrockets.com') ||
           html.includes('oopy-footer') ||
           html.includes('OopyFooter_container')
  }

  /**
   * Oopy 사이트의 콘텐츠 추출
   * 'Search' 키워드를 기준으로 breadcrumb와 content 분리
   */
  extractContent(html: string): {
    title: string
    content: string  
    breadcrumb: string[]
  } {
    const $ = cheerio.load(html)
    
    // 불필요한 요소 제거
    $('script, style, nav, footer, aside').remove()
    
    // 제목 추출
    const title = $('title').text().trim() || $('h1').first().text().trim() || '제목 없음'
    
    // 제목 요소를 제거한 후 전체 텍스트 추출
    $('title, h1').remove()
    const fullText = $('body').text().trim()
    
    // 'Search' 키워드 기준으로 분할 (oopy 특화)
    const parts = fullText.split(OOPY_CONSTANTS.CONTENT_SEPARATOR)
    
    if (parts.length === 1) {
      // Search 키워드가 없는 경우: breadcrumb는 비움, content도 비움
      return {
        title,
        content: '',
        breadcrumb: []
      }
    }
    
    // Search 키워드가 있는 경우: 정상 처리
    const breadcrumbText = parts[0]?.trim() || ''
    const mainContent = parts.slice(1).join(OOPY_CONSTANTS.CONTENT_SEPARATOR).trim()
    
    // breadcrumb 파싱 ('/' 구분자 기준)
    const breadcrumb = breadcrumbText
      ? breadcrumbText.split('/')
          .map(item => item.trim())
          .filter(item => item.length > 0)
      : []
    
    // 텍스트 정리 (연속된 공백을 하나로)
    const processedContent = mainContent
      .replace(/\s+/g, ' ')
      .trim()
    
    return {
      title,
      content: processedContent,
      breadcrumb
    }
  }
}