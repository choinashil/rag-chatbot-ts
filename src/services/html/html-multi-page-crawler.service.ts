import { HtmlCrawlerService } from './html-crawler.service'
import type { CrawlOptions, CrawlSession, CrawledDocument } from '../../types/html'

/**
 * 다중 페이지 HTML 크롤링 서비스
 * 
 * HtmlCrawlerService를 사용하여 사이트 전체를 크롤링하고 결과를 처리하는 고수준 서비스
 */
export class HtmlMultiPageCrawlerService {
  private crawlerService: HtmlCrawlerService

  constructor() {
    this.crawlerService = new HtmlCrawlerService()
  }

  /**
   * 크롤링 실행 및 결과 반환
   */
  async crawlSite(startUrl: string, options?: Partial<CrawlOptions>): Promise<{
    session: CrawlSession,
    documents: CrawledDocument[]
  }> {
    const session = await this.crawlerService.crawlSite(startUrl, options)
    const documents = this.crawlerService.getCrawledDocuments()
    
    return { session, documents }
  }

  /**
   * 특정 URL의 크롤링된 문서 반환
   */
  getCrawledDocument(url: string): CrawledDocument | undefined {
    return this.crawlerService.getCrawledDocument(url)
  }

  /**
   * 크롤링 세션 결과 출력 (콘솔용)
   */
  displayCrawlResults(session: CrawlSession): void {
    console.log('\n' + '='.repeat(80))
    console.log('📊 크롤링 세션 결과')
    console.log('='.repeat(80))
    
    console.log(`\n🆔 세션 정보:`)
    console.log(`  세션 ID: ${session.id}`)
    console.log(`  시작 URL: ${session.startUrl}`)
    console.log(`  시작 시간: ${session.startTime}`)
    console.log(`  상태: ${session.status}`)
    
    console.log(`\n⚙️ 크롤링 설정:`)
    console.log(`  최대 깊이: ${session.options.maxDepth}`)
    console.log(`  최대 페이지: ${session.options.maxPages}`)
    console.log(`  동시성: ${session.options.concurrency}`)
    console.log(`  크롤링 지연: ${session.options.crawlDelay}ms`)
    console.log(`  도메인 제한: [${session.options.domainRestriction?.join(', ') || '없음'}]`)
    console.log(`  부모 페이지 포함: ${session.options.includeParentPages}`)
    
    console.log(`\n📈 처리 통계:`)
    console.log(`  총 페이지 수: ${session.statistics.totalPages}`)
    console.log(`  처리된 페이지: ${session.statistics.processedPages}`)
    console.log(`  건너뛴 페이지: ${session.statistics.skippedPages}`)
    console.log(`  오류 페이지: ${session.statistics.errorPages}`)
    console.log(`  중복 페이지: ${session.statistics.duplicatePages}`)
    console.log(`  평균 처리 시간: ${Math.round(session.statistics.averageProcessingTime)}ms`)
  }
  
  /**
   * 크롤링된 문서들 출력 (콘솔용)
   */
  displayDocuments(documents: CrawledDocument[]): void {
    console.log('\n' + '='.repeat(80))
    console.log(`📚 크롤링된 문서 목록 (${documents.length}개)`)
    console.log('='.repeat(80))
    
    documents.forEach((doc, index) => {
      console.log(`\n[${index + 1}] ${doc.title}`)
      console.log(`  📍 URL: ${doc.url}`)
      console.log(`  📏 깊이: ${doc.depth}`)
      console.log(`  📝 텍스트 길이: ${doc.wordCount.toLocaleString()}자`)
      console.log(`  🔗 발견된 링크: ${doc.links.length}개`)
      console.log(`  📍 Breadcrumb: [${doc.breadcrumb.join(' > ')}]`)
      console.log(`  ⏱️ 처리 시간: ${doc.crawlMetadata.processingTime}ms`)
      
      if (doc.parentUrl) {
        console.log(`  👆 부모 페이지: ${doc.parentUrl}`)
      }
      
      // 내용 미리보기 (처음 200자)
      const preview = doc.content.length > 200 
        ? doc.content.substring(0, 200) + '...'
        : doc.content
      console.log(`  📄 내용 미리보기: "${preview}"`)
    })
    
    // 링크 관계 요약
    this.displayLinkSummary(documents)
  }
  
  /**
   * 링크 관계 요약 출력 (콘솔용)
   */
  private displayLinkSummary(documents: CrawledDocument[]): void {
    console.log('\n' + '='.repeat(80))
    console.log('🔗 링크 관계 분석')
    console.log('='.repeat(80))
    
    const totalInternalLinks = documents.reduce((sum, doc) => 
      sum + doc.links.filter(link => link.type === 'internal').length, 0)
    const totalExternalLinks = documents.reduce((sum, doc) => 
      sum + doc.links.filter(link => link.type === 'external').length, 0)
    
    console.log(`\n📊 링크 통계:`)
    console.log(`  내부 링크: ${totalInternalLinks}개`)
    console.log(`  외부 링크: ${totalExternalLinks}개`)
    console.log(`  총 링크: ${totalInternalLinks + totalExternalLinks}개`)
    
    // 사이트 계층 구조 출력
    console.log(`\n🌳 사이트 계층 구조:`)
    const hierarchy = this.buildHierarchy(documents)
    this.printHierarchy(hierarchy, 0)
  }
  
  /**
   * 계층 구조 생성
   */
  private buildHierarchy(documents: CrawledDocument[]): any {
    const hierarchy: any = {}
    
    documents.forEach(doc => {
      if (doc.depth === 0) {
        hierarchy[doc.url] = { document: doc, children: {} }
      }
    })
    
    documents.forEach(doc => {
      if (doc.depth > 0 && doc.parentUrl) {
        const parent = this.findInHierarchy(hierarchy, doc.parentUrl)
        if (parent) {
          parent.children[doc.url] = { document: doc, children: {} }
        }
      }
    })
    
    return hierarchy
  }
  
  /**
   * 계층 구조에서 노드 찾기
   */
  private findInHierarchy(hierarchy: any, url: string): any {
    for (const key in hierarchy) {
      if (key === url) return hierarchy[key]
      const found = this.findInHierarchy(hierarchy[key].children, url)
      if (found) return found
    }
    return null
  }
  
  /**
   * 계층 구조 출력
   */
  private printHierarchy(hierarchy: any, depth: number): void {
    const indent = '  '.repeat(depth)
    
    for (const url in hierarchy) {
      const node = hierarchy[url]
      console.log(`${indent}📄 ${node.document.title} (${node.document.wordCount}자)`)
      if (Object.keys(node.children).length > 0) {
        this.printHierarchy(node.children, depth + 1)
      }
    }
  }
}