import axios from 'axios'
import type { SimpleDocument, HtmlFetchOptions } from '../../types/html'
import { HTML_PARSING_CONSTANTS } from './html.constants'
import { HtmlParserManager } from './html-parser.manager'
import type { CrawlingStrategy } from '../../types/html-parser'

// Browser-related imports (puppeteer will be loaded conditionally)
type Browser = any
type Page = any

export class HtmlService {
  private parserManager = new HtmlParserManager()
  private browser: Browser | undefined
  private puppeteer: typeof import('puppeteer') | undefined
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
   * @deprecated parseUrl 사용 권장 (동적 크롤링 지원)
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
   * URL을 파싱하여 문서 추출 (하이브리드 크롤링 지원)
   * 파서가 동적 크롤링이 필요하다고 판단하면 브라우저 사용
   */
  async parseUrl(url: string, fetchOptions?: HtmlFetchOptions): Promise<SimpleDocument> {
    try {
      console.log(`\n🔄 URL 파싱 시작: ${url}`)
      
      // 1단계: 정적 HTML 가져오기
      const html = await this.fetchPage(url, fetchOptions)
      const parser = this.parserManager.selectStrategy(html, url)
      console.log(`  🔍 파서 선택: ${parser.name}`)
      
      // 2단계: 파서가 동적 크롤링 필요 여부 결정
      const crawlingStrategy = parser.shouldUseDynamicCrawling(html)
      
      if (crawlingStrategy.useDynamic) {
        console.log(`  🌐 동적 크롤링 시작: ${crawlingStrategy.reason}`)
        
        try {
          const dynamicContent = await this.fetchDynamicContent(
            url, 
            parser.getDynamicCrawlingSetup()
          )
          
          const result = parser.parseDynamicContent(
            dynamicContent, 
            url, 
            crawlingStrategy.metadata
          )
          
          console.log(`  ✅ 동적 크롤링 완료: ${result.content.length}자`)
          console.log(`  📍 breadcrumb: ${result.breadcrumb.join(' > ')}`)
          
          return {
            ...result,
            url,
            wordCount: result.content.length,
            timestamp: new Date().toISOString()
          }
        } catch (error) {
          console.warn(`  ⚠️ 브라우저 크롤링 실패, 정적 HTML로 대체:`, error)
          // 브라우저 크롤링 실패 시 정적 파싱으로 fallback
        }
      }
      
      // 3단계: 정적 파싱
      const result = parser.parseStaticContent(html, url)
      console.log(`  ✅ 정적 파싱 완료: ${result.content.length}자`)
      console.log(`  📍 breadcrumb: ${result.breadcrumb.join(' > ')}`)
      
      return {
        ...result,
        url,
        wordCount: result.content.length,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error(`  ❌ URL 파싱 실패: ${url}`, error)
      throw new Error(`URL 파싱에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  /**
   * URL에서 직접 문서 추출 (fetch + extract 통합)
   * @deprecated parseUrl 사용 권장 (동적 크롤링 지원)
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
   * 동적 콘텐츠를 브라우저로 가져오기
   */
  private async fetchDynamicContent(
    url: string, 
    pageSetup?: (page: Page) => Promise<void>
  ): Promise<string> {
    if (!this.browser) {
      await this.initBrowser()
    }
    
    const page = await this.browser!.newPage()
    
    try {
      // 페이지 로드 설정
      await page.setViewport({ width: 1920, height: 1080 })
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
      
      // 페이지 이동 (네트워크가 조용해질 때까지 대기)
      await page.goto(url, { 
        waitUntil: 'networkidle2',  // 500ms 동안 네트워크 요청이 2개 이하일 때까지 대기
        timeout: 30000 
      })
      
      // 파서별 커스텀 페이지 설정 (토글 확장 등)
      if (pageSetup) {
        await pageSetup(page)
      }
      
      // 텍스트 콘텐츠 추출 (불필요한 요소 제거 후)
      const content = await page.evaluate(() => {
        // 불필요한 요소 제거
        const elementsToRemove = ['nav', 'footer', '.sidebar', '.navigation', 'script', 'style']
        elementsToRemove.forEach((selector: string) => {
          const elements = (globalThis as any).document.querySelectorAll(selector)
          elements.forEach((el: any) => el.remove())
        })
        
        return (globalThis as any).document.body.innerText
      })
      
      return content
    } finally {
      await page.close()
    }
  }

  /**
   * 브라우저 초기화
   */
  private async initBrowser(): Promise<void> {
    try {
      // 동적 puppeteer import
      if (!this.puppeteer) {
        this.puppeteer = await import('puppeteer')
      }
      
      this.browser = await this.puppeteer.launch({
        headless: process.env.NODE_ENV === 'production',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      })
      
      console.log('  🚀 브라우저 초기화 완료')
    } catch (error) {
      console.error('  ❌ 브라우저 초기화 실패:', error)
      throw new Error(`브라우저 초기화에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  /**
   * 브라우저 종료 (리소스 정리)
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = undefined
      console.log('  🔒 브라우저 종료 완료')
    }
  }

  /**
   * 지연 함수 (재시도 간격용)
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}