import * as cheerio from 'cheerio'
import type { HtmlParserStrategy, CrawlingStrategy } from '../../../types/html-parser'

/**
 * 일반 HTML 사이트용 파서
 * 
 * 표준 HTML 구조를 기반으로 title과 main content를 추출
 * breadcrumb은 일반 HTML에서 추출이 어려우므로 빈 배열로 반환
 */
export class GenericParser implements HtmlParserStrategy {
  name = 'generic' as const

  /**
   * 항상 적용 가능 (fallback 파서)
   */
  isApplicable(): boolean {
    return true
  }

  /**
   * 일반 사이트는 동적 크롤링 불필요
   */
  shouldUseDynamicCrawling(html: string): CrawlingStrategy {
    return { useDynamic: false }
  }

  /**
   * 일반 사이트는 동적 크롤링 설정 없음
   */
  getDynamicCrawlingSetup(): undefined {
    return undefined
  }

  /**
   * 정적 HTML에서 콘텐츠 추출
   */
  parseStaticContent(html: string, url: string): {
    title: string
    content: string
    breadcrumb: string[]
  } {
    return this.extractContent(html)
  }

  /**
   * 일반 사이트는 동적 크롤링을 지원하지 않음
   */
  parseDynamicContent(content: string, url: string, metadata?: any): {
    title: string
    content: string
    breadcrumb: string[]
  } {
    throw new Error('GenericParser는 동적 크롤링을 지원하지 않습니다')
  }

  /**
   * 일반 HTML 사이트의 콘텐츠 추출
   * 표준 HTML 요소들을 우선순위에 따라 탐색
   */
  extractContent(html: string): {
    title: string
    content: string
    breadcrumb: string[]
  } {
    const $ = cheerio.load(html)
    
    // 불필요한 요소 제거
    $('script, style, nav, footer, aside, header').remove()
    
    // 제목 추출 (우선순위: title > h1)
    const title = $('title').text().trim() || 
                  $('h1').first().text().trim() || 
                  '제목 없음'
    
    // 메인 콘텐츠 추출 (우선순위에 따라)
    const content = this.extractMainContent($)
    
    // 텍스트 정리
    const processedContent = content
      .replace(/\s+/g, ' ')
      .trim()
    
    return {
      title,
      content: processedContent,
      breadcrumb: [] // 일반 HTML에서는 breadcrumb 추출 어려움
    }
  }

  /**
   * 메인 콘텐츠 추출
   * 우선순위: main > article > .content > .post-content > body
   */
  private extractMainContent($: cheerio.CheerioAPI): string {
    const contentSelectors = [
      'main',
      'article', 
      '.content',
      '.post-content',
      '.entry-content',
      '#content',
      '#main-content'
    ]
    
    for (const selector of contentSelectors) {
      const element = $(selector).first()
      if (element.length > 0) {
        const text = element.text().trim()
        if (text.length > 100) { // 최소한의 콘텐츠가 있는지 확인
          return text
        }
      }
    }
    
    // 최소 조건을 만족하는 요소가 없는 경우, 첫 번째 요소를 사용
    for (const selector of contentSelectors) {
      const element = $(selector).first()
      if (element.length > 0) {
        return element.text().trim()
      }
    }
    
    // fallback: body 전체
    return $('body').text().trim()
  }
}