import { HtmlService } from './html.service'
import type { 
  CrawledDocument, 
  CrawlOptions, 
  CrawlSession, 
  CrawlStatistics,
  PageLink,
  CrawlMetadata 
} from '../../types/html'
import { CRAWL_CONSTANTS, DEFAULT_CRAWL_OPTIONS } from './html.constants'
import * as cheerio from 'cheerio'
import { URL } from 'url'

export class HtmlCrawlerService extends HtmlService {
  private visitedUrls: Set<string> = new Set()
  
  /** 콘텐츠 기반 중복 검사를 위한 해시 저장소
   * 제목 + 콘텐츠 길이 조합으로 빠른 중복 검사 수행 */
  private contentHashes: Set<string> = new Set()
  
  private urlQueue: Array<{url: string, depth: number, parentUrl?: string}> = []
  private crawledDocuments: Map<string, CrawledDocument> = new Map()
  private processingPromises: Map<string, Promise<CrawledDocument | null>> = new Map()
  
  
  /** 시작 페이지의 breadcrumb 깊이
   * 상대 깊이 계산 기준점으로 사용 */
  private startBreadcrumbDepth: number = 0
  
  /**
   * 사이트 크롤링 시작
   */
  async crawlSite(startUrl: string, options?: Partial<CrawlOptions>): Promise<CrawlSession> {
    const crawlOptions: CrawlOptions = { ...DEFAULT_CRAWL_OPTIONS, ...options }
    const sessionId = this.generateSessionId()
    const startTime = new Date().toISOString()
    
    console.log(`🕷️ 크롤링 시작: ${startUrl}`)
    console.log(`📊 설정: 최대 깊이 ${crawlOptions.maxDepth}, 최대 페이지 ${crawlOptions.maxPages}`)
    console.log('─'.repeat(80))
    
    const session: CrawlSession = {
      id: sessionId,
      startUrl,
      options: crawlOptions,
      startTime,
      status: 'running',
      statistics: this.initializeStatistics()
    }
    
    try {
      // 초기화
      this.reset()
      
      // 시작 URL을 visited에 추가하고 큐에 추가
      const normalizedStartUrl = this.normalizeUrl(startUrl)
      this.visitedUrls.add(normalizedStartUrl)
      this.urlQueue.push({ url: startUrl, depth: 0 })
      
      // 크롤링 실행
      await this.processCrawlQueue(session)
      
      session.status = 'completed'
      console.log('─'.repeat(80))
      console.log(`✅ 크롤링 완료: ${session.statistics.processedPages}개 페이지 처리`)
      
    } catch (error) {
      console.error(`❌ 크롤링 실패:`, error)
      session.status = 'error'
      throw error
    }
    
    return session
  }
  
  /**
   * 크롤링된 문서들 반환
   */
  getCrawledDocuments(): CrawledDocument[] {
    return Array.from(this.crawledDocuments.values())
  }
  
  /**
   * 특정 URL의 크롤링된 문서 반환
   */
  getCrawledDocument(url: string): CrawledDocument | undefined {
    return this.crawledDocuments.get(this.normalizeUrl(url))
  }
  
  /**
   * 크롤링 큐 처리
   */
  private async processCrawlQueue(session: CrawlSession): Promise<void> {
    const concurrentPromises: Promise<void>[] = []
    
    while (this.urlQueue.length > 0 && this.crawledDocuments.size < session.options.maxPages) {
      // 동시성 제어
      if (concurrentPromises.length >= session.options.concurrency) {
        await Promise.race(concurrentPromises)
        // 모든 Promise를 새로 시작
        await Promise.allSettled(concurrentPromises)
        concurrentPromises.length = 0
      }
      
      const queueItem = this.urlQueue.shift()
      if (!queueItem) break
      
      const { url, depth, parentUrl } = queueItem
      
      // 탐색깊이 기준 최대 깊이 확인
      if (depth > session.options.maxDepth) {
        session.statistics.skippedPages++
        continue
      }
      
      // 도메인 제한 확인
      if (!this.isAllowedDomain(url, session.options.domainRestriction)) {
        session.statistics.skippedPages++
        continue
      }
      
      // 페이지 처리를 비동기로 시작
      const processPromise = this.processPage(url, depth, parentUrl, session)
        .then(document => {
          if (document) {
            // 새로운 링크를 큐에 추가 (로그는 processPage에서 처리)
            this.addLinksToQueue(document.links, depth + 1, url)
          }
        })
        .catch(error => {
          console.warn(`⚠️ 페이지 처리 실패: ${url}`, error)
          session.statistics.errorPages++
        })
      
      concurrentPromises.push(processPromise)
      
      // 크롤링 지연
      if (session.options.crawlDelay > 0) {
        await this.delayExecution(session.options.crawlDelay)
      }
    }
    
    // 모든 처리 완료 대기
    await Promise.allSettled(concurrentPromises)
  }
  
  /**
   * 개별 페이지 처리
   */
  private async processPage(
    url: string, 
    depth: number, 
    parentUrl: string | undefined,
    session: CrawlSession
  ): Promise<CrawledDocument | null> {
    const startTime = Date.now()
    
    try {
      // 기본 HTML 문서 추출
      const simpleDocument = await this.extractFromUrl(url)
      
      // 시작 페이지인 경우 breadcrumb 깊이 저장
      if (depth === 0) {
        this.startBreadcrumbDepth = simpleDocument.breadcrumb.length
        console.log(`  📋 시작 breadcrumb 깊이: ${this.startBreadcrumbDepth}`)
      }
      
      // 현재 페이지의 breadcrumb 깊이를 가져와서 상대 깊이 계산
      const currentBreadcrumbDepth = simpleDocument.breadcrumb.length
      const relativeDepth = currentBreadcrumbDepth - this.startBreadcrumbDepth
      
      console.log(`  📄 처리 중: ${simpleDocument.title} (상대깊이: ${relativeDepth}, 탐색깊이: ${depth})`)
      
      // 부모 페이지 크롤링 제한 확인 (시작 페이지 제외, 형제 페이지는 허용)
      if (relativeDepth < 0 && depth > 0 && !session.options.includeParentPages) {
        console.log(`  ⚠️ 부모 페이지 스킵 (상대깊이: ${relativeDepth})`)
        session.statistics.skippedPages++
        return null
      }
      
      
      // 효율적인 중복 검사: 제목 + 콘텐츠 길이 기반
      const quickHash = this.generateQuickHash(simpleDocument.title, simpleDocument.content.length)
      if (this.contentHashes.has(quickHash)) {
        console.log(`  ⚠️ 중복 콘텐츠 스킵: ${simpleDocument.title}`)
        session.statistics.duplicatePages++
        return null // 중복 콘텐츠는 처리하지 않음
      }
      this.contentHashes.add(quickHash)
      
      // HTML에서 링크 추출
      const html = await this.fetchPage(url)
      const links = this.extractLinks(html, url)
      
      // 크롤링 메타데이터 생성
      const crawlMetadata: CrawlMetadata = {
        crawlId: this.generateCrawlId(),
        sessionId: session.id,
        discoveryMethod: depth === 0 ? 'initial' : 'link',
        processingTime: Date.now() - startTime,
        errorCount: 0
      }
      
      // 크롤된 문서 생성
      const crawledDocument: CrawledDocument = {
        ...simpleDocument,
        id: this.generateDocumentId(url),
        parentUrl,
        depth,
        discoveredAt: new Date().toISOString(),
        links,
        crawlMetadata
      }
      
      this.crawledDocuments.set(this.normalizeUrl(url), crawledDocument)
      session.statistics.processedPages++
      
      
      // 평균 처리 시간 업데이트
      this.updateAverageProcessingTime(session.statistics, crawlMetadata.processingTime)
      
      // 하위 링크를 큐에 추가
      const addedCount = this.addLinksToQueue(crawledDocument.links, depth + 1, url)
      if (addedCount > 0) {
        console.log(`  🔗 ${addedCount}개 하위 링크를 큐에 추가`)
      }
      
      console.log(`  ✅ 완료 (${crawlMetadata.processingTime}ms)`)
      return crawledDocument
      
    } catch (error) {
      console.error(`  ❌ 실패: ${url}`, error)
      session.statistics.errorPages++
      return null
    }
  }
  
  /**
   * HTML에서 링크 추출
   */
  private extractLinks(html: string, baseUrl: string): PageLink[] {
    const $ = cheerio.load(html)
    const links: PageLink[] = []
    const baseUrlObj = new URL(baseUrl)
    
    $(CRAWL_CONSTANTS.INTERNAL_LINK_SELECTORS).each((_, element) => {
      const href = $(element).attr('href')
      const text = $(element).text().trim()
      
      if (href && this.isValidLink(href)) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString()
          const isInternal = this.isInternalLink(absoluteUrl, baseUrlObj.hostname)
          
          links.push({
            url: absoluteUrl,
            text: text || href,
            type: isInternal ? 'internal' : 'external',
            discovered: false
          })
        } catch (error) {
          // URL 파싱 오류 무시
        }
      }
    })
    
    return links
  }
  
  /**
   * 링크들을 크롤링 큐에 추가
   */
  private addLinksToQueue(links: PageLink[], depth: number, parentUrl: string): number {
    let addedCount = 0
    for (const link of links) {
      if (link.type === 'internal' && !link.discovered) {
        const normalizedUrl = this.normalizeUrl(link.url)
        if (!this.visitedUrls.has(normalizedUrl)) {
          this.visitedUrls.add(normalizedUrl) // visited에 추가하여 중복 방지
          this.urlQueue.push({
            url: link.url,
            depth,
            parentUrl
          })
          link.discovered = true
          addedCount++
        }
      }
    }
    return addedCount
  }
  
  /**
   * URL 정규화
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      // 쿼리 파라미터와 해시 제거 (선택적)
      urlObj.search = ''
      urlObj.hash = ''
      return urlObj.toString().replace(/\/$/, '') // 끝 슬래시 제거
    } catch {
      return url
    }
  }
  
  /**
   * 도메인 허용 여부 확인
   */
  private isAllowedDomain(url: string, allowedDomains?: string[]): boolean {
    if (!allowedDomains || allowedDomains.length === 0) return true
    
    try {
      const urlObj = new URL(url)
      return allowedDomains.some(domain => urlObj.hostname.includes(domain))
    } catch {
      return false
    }
  }
  
  /**
   * 유효한 링크 여부 확인
   */
  private isValidLink(href: string): boolean {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return false
    }
    return true
  }
  
  /**
   * 내부 링크 여부 확인
   */
  private isInternalLink(url: string, baseHostname: string): boolean {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname === baseHostname || urlObj.hostname.endsWith(`.${baseHostname}`)
    } catch {
      return false
    }
  }
  
  
  /**
   * 지연 실행 (delay 메서드를 public으로 재구현)
   */
  private delayExecution(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * 평균 처리 시간 업데이트
   */
  private updateAverageProcessingTime(statistics: CrawlStatistics, processingTime: number): void {
    const totalTime = statistics.averageProcessingTime * (statistics.processedPages - 1)
    statistics.averageProcessingTime = (totalTime + processingTime) / statistics.processedPages
  }
  
  /**
   * 통계 초기화
   */
  private initializeStatistics(): CrawlStatistics {
    return {
      totalPages: 0,
      processedPages: 0,
      skippedPages: 0,
      errorPages: 0,
      duplicatePages: 0,
      averageProcessingTime: 0
    }
  }
  
  /**
   * 상태 초기화
   */
  private reset(): void {
    this.visitedUrls.clear()
    this.contentHashes.clear()
    this.urlQueue = []
    this.crawledDocuments.clear()
    this.processingPromises.clear()
  }
  
  /**
   * ID 생성 헬퍼 메서드들
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }
  
  private generateCrawlId(): string {
    return `crawl-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }
  
  private generateDocumentId(url: string): string {
    return `doc-${Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`
  }
  
  /**
   * 효율적인 중복 검사를 위한 빠른 해시 생성
   * 제목 + 콘텐츠 길이 조합으로 성능과 정확성의 균형
   */
  private generateQuickHash(title: string, contentLength: number): string {
    return `${title.trim()}_${contentLength}`
  }
}