#!/usr/bin/env npx tsx

/**
 * 단순 HTML 텍스트 추출 및 벡터화 스크립트
 * 
 * 목표: 페이지 내 모든 텍스트를 추출해서 하나의 벡터로 저장
 */

import { HtmlService } from '../src/services/html/html.service'
import { DEFAULT_TEST_PAGES } from '../src/services/html/html.constants'

class SimpleHtmlParser {
  private htmlService: HtmlService

  constructor() {
    this.htmlService = new HtmlService()
  }

  /**
   * 메인 실행 함수
   */
  async analyze(url: string): Promise<void> {
    try {
      const document = await this.htmlService.extractFromUrl(url)
      this.htmlService.displayResult(document)
    } catch (error) {
      console.error('❌ 분석 실패:', error)
      process.exit(1)
    }
  }
}

// 스크립트 실행
async function main() {
  const url = process.argv[2] || DEFAULT_TEST_PAGES.WEBSITE_DESIGN
  console.log(`📄 분석 대상: ${url}`)
  
  const parser = new SimpleHtmlParser()
  await parser.analyze(url)
}

// 직접 실행 시에만 main 함수 호출
if (require.main === module) {
  main().catch(error => {
    console.error('스크립트 실행 실패:', error)
    process.exit(1)
  })
}

export { SimpleHtmlParser }