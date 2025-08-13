#!/usr/bin/env tsx

/**
 * HTML 크롤링 + 벡터화 기본 통합 테스트 (MVP)
 * 
 * Stage 5에서 구현된 HTML 크롤링 + 자동 벡터화 기능을 실제로 테스트합니다.
 * 실행 전 env/.env.integration에 올바른 API 키와 설정이 있어야 합니다.
 */

import dotenv from 'dotenv'
import { HtmlCrawlerService } from '../../src/services/html/html-crawler.service'
import { DocumentProcessor } from '../../src/services/document/document.processor'
import { NotionService } from '../../src/services/notion/notion.service'
import { EmbeddingService } from '../../src/services/openai/embedding.service'
import { OpenAIClient } from '../../src/services/openai/openai.client'
import { PineconeService } from '../../src/services/vector/pinecone.service'
import { PineconeClient } from '../../src/services/vector/pinecone.client'
import { createNotionConfig } from '../../src/config/notion'
import { createOpenAIConfig } from '../../src/config/openai'
import { createPineconeConfig } from '../../src/config/pinecone'

// 환경변수 로드
dotenv.config({ path: 'env/.env.integration' })

interface TestResult {
  testName: string
  success: boolean
  error?: string
  details?: any
}

class HtmlVectorizationIntegrationTest {
  private crawler: HtmlCrawlerService
  private documentProcessor: DocumentProcessor
  private results: TestResult[] = []

  constructor() {
    // 서비스 초기화
    const notionConfig = createNotionConfig()
    const openaiConfig = createOpenAIConfig()
    const pineconeConfig = createPineconeConfig()

    const notionService = new NotionService(notionConfig)
    const openaiClient = new OpenAIClient(openaiConfig)
    const embeddingService = new EmbeddingService(openaiClient)
    const pineconeClient = new PineconeClient(pineconeConfig)
    const pineconeService = new PineconeService(pineconeClient)
    
    this.documentProcessor = new DocumentProcessor(
      notionService,
      embeddingService,
      pineconeService
    )

    this.crawler = new HtmlCrawlerService(this.documentProcessor)
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 HTML 벡터화 통합 테스트 시작')
    console.log('=' .repeat(60))

    // 테스트 실행
    await this.testBasicCrawling()
    await this.testManualVectorization()
    await this.testAutoVectorization()
    
    // 결과 출력
    this.printResults()
  }

  /**
   * 기본 크롤링 테스트 (벡터화 없음)
   */
  private async testBasicCrawling(): Promise<void> {
    console.log('\n📄 테스트 1: 기본 크롤링 (벡터화 없음)')
    
    try {
      const session = await this.crawler.crawlSite('https://help.pro.sixshop.com/', {
        maxPages: 2,
        maxDepth: 1,
        autoVectorize: false  // 벡터화 비활성화
      })

      const documents = this.crawler.getCrawledDocuments()
      
      // 검증
      if (session.statistics.processedPages === 0) {
        throw new Error('크롤링된 페이지가 없습니다')
      }
      
      if (documents.length === 0) {
        throw new Error('수집된 문서가 없습니다')
      }

      if (session.vectorizationResult) {
        throw new Error('벡터화가 비활성화되었는데 결과가 존재합니다')
      }

      this.results.push({
        testName: '기본 크롤링',
        success: true,
        details: {
          processedPages: session.statistics.processedPages,
          documentsCount: documents.length
        }
      })

      console.log(`✅ 성공: ${session.statistics.processedPages}개 페이지 크롤링`)
      
    } catch (error) {
      this.results.push({
        testName: '기본 크롤링',
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      })
      console.error('❌ 실패:', error)
    }
  }

  /**
   * 수동 벡터화 테스트
   */
  private async testManualVectorization(): Promise<void> {
    console.log('\n🧠 테스트 2: 수동 벡터화')
    
    try {
      // 먼저 크롤링
      const session = await this.crawler.crawlSite('https://help.pro.sixshop.com/', {
        maxPages: 2,
        maxDepth: 1,
        autoVectorize: false
      })

      const documents = this.crawler.getCrawledDocuments()
      if (documents.length === 0) {
        throw new Error('크롤링된 문서가 없습니다')
      }

      // 수동으로 벡터화
      const vectorResult = await this.documentProcessor.processHtmlDocuments(documents)

      // 검증
      if (vectorResult.processed === 0) {
        throw new Error('벡터화된 문서가 없습니다')
      }

      if (vectorResult.total !== documents.length) {
        throw new Error('처리 대상 문서 수가 일치하지 않습니다')
      }

      this.results.push({
        testName: '수동 벡터화',
        success: true,
        details: {
          documentsCount: documents.length,
          processed: vectorResult.processed,
          failed: vectorResult.failed
        }
      })

      console.log(`✅ 성공: ${documents.length}개 문서 중 ${vectorResult.processed}개 벡터화 완료`)
      
    } catch (error) {
      this.results.push({
        testName: '수동 벡터화',
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      })
      console.error('❌ 실패:', error)
    }
  }

  /**
   * 자동 벡터화 테스트 (MVP 핵심 기능)
   */
  private async testAutoVectorization(): Promise<void> {
    console.log('\n🚀 테스트 3: 자동 크롤링 + 벡터화 (MVP 핵심)')
    
    try {
      const session = await this.crawler.crawlSite('https://help.pro.sixshop.com/', {
        maxPages: 2,
        maxDepth: 1,
        autoVectorize: true  // 🎯 자동 벡터화 활성화
      })

      // 검증
      if (session.statistics.processedPages === 0) {
        throw new Error('크롤링된 페이지가 없습니다')
      }

      if (!session.vectorizationResult) {
        throw new Error('벡터화 결과가 없습니다')
      }

      if (session.vectorizationResult.processed === 0) {
        throw new Error('벡터화된 문서가 없습니다')
      }

      // 크롤링된 페이지 수와 벡터화 대상 수가 일치해야 함
      if (session.vectorizationResult.total !== session.statistics.processedPages) {
        throw new Error('크롤링된 페이지 수와 벡터화 대상 수가 일치하지 않습니다')
      }

      this.results.push({
        testName: '자동 크롤링+벡터화',
        success: true,
        details: {
          processedPages: session.statistics.processedPages,
          vectorized: session.vectorizationResult.processed,
          vectorizationFailed: session.vectorizationResult.failed
        }
      })

      console.log(`✅ 성공: ${session.statistics.processedPages}개 페이지 크롤링 + ${session.vectorizationResult.processed}개 벡터화`)
      
    } catch (error) {
      this.results.push({
        testName: '자동 크롤링+벡터화',
        success: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류'
      })
      console.error('❌ 실패:', error)
    }
  }

  /**
   * 테스트 결과 출력
   */
  private printResults(): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 테스트 결과 요약')
    console.log('='.repeat(60))

    const successCount = this.results.filter(r => r.success).length
    const totalCount = this.results.length

    this.results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      console.log(`${status} ${result.testName}`)
      
      if (result.success && result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`)
        })
      } else if (!result.success && result.error) {
        console.log(`   오류: ${result.error}`)
      }
      console.log('')
    })

    console.log(`🎯 전체 결과: ${successCount}/${totalCount} 성공`)
    
    if (successCount === totalCount) {
      console.log('🎉 모든 테스트 통과!')
    } else {
      console.log('⚠️  일부 테스트 실패 - 로그를 확인하세요.')
    }
  }
}

// 메인 실행
async function main() {
  try {
    const test = new HtmlVectorizationIntegrationTest()
    await test.runAllTests()
  } catch (error) {
    console.error('❌ 통합 테스트 실행 실패:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}