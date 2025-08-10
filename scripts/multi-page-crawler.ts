#!/usr/bin/env npx tsx

/**
 * 다중 페이지 HTML 크롤링 스크립트 (3단계)
 * 
 * HtmlMultiPageCrawlerService를 사용한 단순 실행 스크립트
 */

import { HtmlMultiPageCrawlerService } from '../src/services/html/html-multi-page-crawler.service'
import { DEFAULT_TEST_PAGES, DEFAULT_CRAWL_OPTIONS } from '../src/services/html/html.constants'

// 스크립트 실행
async function main() {
  const startUrl = process.argv[2] || DEFAULT_TEST_PAGES.WEBSITE_DESIGN
  
  // 커스텀 옵션
  const crawlOptions = {
    ...DEFAULT_CRAWL_OPTIONS,
    maxDepth: 10,        // 깊이 n단계까지
    maxPages: 200,       // 최대 n페이지
    crawlDelay: 1000,   // n초 지연 (서버 부하 방지)
    concurrency: 1     // n개 동시 페이지 처리
  }
  
  console.log(`🚀 크롤링 시작: ${startUrl}`)
  console.log(`📋 설정: 깊이 ${crawlOptions.maxDepth}, 최대 ${crawlOptions.maxPages}페이지`)
  
  try {
    console.log('='.repeat(80))
    console.log('🕷️ 다중 페이지 HTML 크롤러 시작')
    console.log('='.repeat(80))
    
    const crawlerService = new HtmlMultiPageCrawlerService()
    
    // 크롤링 실행
    const result = await crawlerService.crawlSite(startUrl, crawlOptions)
    
    // 결과 출력
    crawlerService.displayCrawlResults(result.session)
    crawlerService.displayDocuments(result.documents)
    
  } catch (error) {
    console.error('❌ 크롤링 실패:', error)
    process.exit(1)
  }
}

// 직접 실행 시에만 main 함수 호출
if (require.main === module) {
  main().catch(error => {
    console.error('스크립트 실행 실패:', error)
    process.exit(1)
  })
}