import axios from 'axios'
import type { SimpleDocument, HtmlFetchOptions } from '../../types/html'
import { HTML_PARSING_CONSTANTS } from './html.constants'
import { HtmlParserManager } from './html-parser.manager'

export class HtmlService {
  private parserManager = new HtmlParserManager()
  /**
   * HTML 페이지 수집
   */
  async fetchPage(url: string, options?: HtmlFetchOptions): Promise<string> {
    const {
      timeout = HTML_PARSING_CONSTANTS.REQUEST_TIMEOUT,
      retryCount = HTML_PARSING_CONSTANTS.MAX_RETRY_COUNT,
      userAgent = HTML_PARSING_CONSTANTS.USER_AGENT
    } = options || {}
    
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout,
          headers: {
            'User-Agent': userAgent
          }
        })

        return response.data
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('알 수 없는 오류')
        console.warn(`⚠️ 페이지 수집 실패 (시도 ${attempt}/${retryCount}): ${lastError.message}`)
        
        if (attempt < retryCount) {
          await this.delay(HTML_PARSING_CONSTANTS.RETRY_DELAY * attempt)
        }
      }
    }
    
    console.error(`    ❌ 페이지 수집 최종 실패: ${url}`, lastError)
    throw new Error(`페이지 수집에 실패했습니다: ${lastError?.message || '알 수 없는 오류'}`)
  }

  /**
   * HTML에서 순수 텍스트만 추출
   * 파서 전략 패턴을 사용하여 사이트별 최적화된 파싱 수행
   */
  extractText(html: string, url: string): SimpleDocument {
    // 적절한 파서 전략 선택
    const parser = this.parserManager.selectStrategy(html, url)
    console.log(`  🔍 파서 선택: ${parser.name}`)
    
    // 파서를 사용하여 콘텐츠 추출
    const { title, content, breadcrumb } = parser.extractContent(html)
    
    const result: SimpleDocument = {
      url,
      title,
      content,
      wordCount: content.length,
      breadcrumb,
      timestamp: new Date().toISOString()
    }
    
    console.log(`  ✅ 텍스트 추출 완료: ${content.length}자`)
    console.log(`  📍 breadcrumb: ${breadcrumb.join(' > ')}`)
    return result
  }

  /**
   * URL에서 직접 문서 추출 (fetch + extract 통합)
   */
  async extractFromUrl(
    url: string, 
    fetchOptions?: HtmlFetchOptions
  ): Promise<SimpleDocument> {
    try {
      console.log(`\n🔄 URL 문서 추출 시작: ${url}`)
      
      const html = await this.fetchPage(url, fetchOptions)
      return this.extractText(html, url)
    } catch (error) {
      console.error(`  ❌ URL 문서 추출 실패: ${url}`, error)
      throw new Error(`URL 문서 추출에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  /**
   * 결과 출력 (로깅용)
   */
  displayResult(document: SimpleDocument): void {
    console.log('\n' + '='.repeat(80))
    console.log('📄 HTML 텍스트 추출 결과')
    console.log('='.repeat(80))
    
    console.log(`\n📋 문서 정보:`)
    console.log(`  제목: ${document.title}`)
    console.log(`  URL: ${document.url}`)
    console.log(`  텍스트 길이: ${document.wordCount.toLocaleString()}자`)
    console.log(`  추출 시간: ${document.timestamp}`)
    
    console.log(`\n📍 메타데이터:`)
    console.log(`  breadcrumb: [${document.breadcrumb.map(item => `"${item}"`).join(', ')}]`)
    
    console.log(`\n📝 전체 벡터 저장 텍스트:`)
    console.log(`"${document.content}"`)
    
    console.log('\n' + '='.repeat(80))
    console.log('🎉 추출 완료!')
    console.log('='.repeat(80))
  }

  /**
   * 지연 함수 (재시도 간격용)
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}