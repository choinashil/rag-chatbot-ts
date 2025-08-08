#!/usr/bin/env tsx

/**
 * 페이지 기반 수집 시스템 통합 테스트
 * 
 * Stage 9에서 구현된 페이지 기반 재귀 수집 기능을 실제 Notion API와 연동하여 테스트합니다.
 * 실행 전 env/.env.dev에 올바른 API 키와 설정이 있어야 합니다.
 */

import dotenv from 'dotenv'
import { NotionService } from '../src/services/notion/notion.service'
import { DocumentProcessor } from '../src/services/document/document.processor'
import { EmbeddingService } from '../src/services/openai/embedding.service'
import { OpenAIClient } from '../src/services/openai/openai.client'
import { PineconeService } from '../src/services/pinecone/pinecone.service'
import { PineconeClient } from '../src/services/pinecone/pinecone.client'
import { createNotionConfig } from '../src/config/notion'
import { createOpenAIConfig } from '../src/config/openai'
import { createPineconeConfig } from '../src/config/pinecone'
import type { PageCollectionOptions } from '../src/types/notion'

// 환경변수 로드
dotenv.config({ path: 'env/.env.integration' })

interface TestResult {
  testName: string
  success: boolean
  error?: string
  details?: any
}

class PageCollectionIntegrationTest {
  private notionService: NotionService
  private documentProcessor: DocumentProcessor
  private results: TestResult[] = []

  constructor() {
    // 서비스 초기화
    const notionConfig = createNotionConfig()
    const openaiConfig = createOpenAIConfig()
    const pineconeConfig = createPineconeConfig()

    this.notionService = new NotionService(notionConfig)
    const openaiClient = new OpenAIClient(openaiConfig)
    const embeddingService = new EmbeddingService(openaiClient)
    const pineconeClient = new PineconeClient(pineconeConfig)
    const pineconeService = new PineconeService(pineconeClient)
    
    this.documentProcessor = new DocumentProcessor(
      this.notionService,
      embeddingService,
      pineconeService
    )
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 페이지 기반 수집 통합 테스트 시작\n')

    try {
      await this.notionService.initialize()
      console.log('✅ Notion 서비스 초기화 완료\n')

      // 테스트 실행
      await this.testBasicPageCollection()
      await this.testRecursivePageCollection()
      await this.testChildPageDetection()
      await this.testDatabaseDiscovery()
      await this.testCollectionMethodComparison()
      await this.testPageBlocksRetrieval()

      // 결과 출력
      this.printResults()

    } catch (error) {
      console.error('❌ 테스트 초기화 실패:', error)
      process.exit(1)
    }
  }

  private async testBasicPageCollection(): Promise<void> {
    console.log('🔍 Test 1: 기본 페이지 수집')
    
    try {
      const testPageId = process.env.NOTION_PAGE_ID
      if (!testPageId) {
        throw new Error('NOTION_PAGE_ID 환경변수가 설정되지 않았습니다')
      }

      const options: PageCollectionOptions = {
        maxDepth: 1,
        includeDatabase: false,
        excludeEmpty: true
      }

      const result = await this.notionService.collectFromPage(testPageId, options)
      
      console.log(`  📄 수집된 페이지: ${result.totalPages}개`)
      console.log(`  ⏭️  건너뛴 페이지: ${result.skippedPages}개`)
      console.log(`  🗂️  발견된 데이터베이스: ${result.discoveredDatabases.length}개`)

      this.results.push({
        testName: 'Basic Page Collection',
        success: true,
        details: {
          totalPages: result.totalPages,
          skippedPages: result.skippedPages,
          discoveredDatabases: result.discoveredDatabases.length
        }
      })

    } catch (error) {
      console.error('  ❌ 실패:', error)
      this.results.push({
        testName: 'Basic Page Collection',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    console.log()
  }

  private async testRecursivePageCollection(): Promise<void> {
    console.log('🔍 Test 2: 재귀 페이지 수집')
    
    try {
      const testPageId = process.env.NOTION_PAGE_ID
      if (!testPageId) {
        throw new Error('NOTION_PAGE_ID 환경변수가 설정되지 않았습니다')
      }

      const options: PageCollectionOptions = {
        maxDepth: 10,
        includeDatabase: true,
        excludeEmpty: true
      }

      const result = await this.notionService.collectFromPage(testPageId, options)
      
      console.log(`  📄 수집된 페이지: ${result.totalPages}개`)
      console.log(`  🔄 최대 깊이: ${options.maxDepth}`)
      console.log(`  🗂️  발견된 데이터베이스: ${result.discoveredDatabases.length}개`)

      // 깊이별 페이지 분포 확인
      const depthDistribution = new Map<number, number>()
      result.pages.forEach(page => {
        // 페이지 메타데이터에서 깊이 정보 확인 (실제 구현에서는 메타데이터에 포함되어야 함)
        console.log(`    - ${page.title} (ID: ${page.id.substring(0, 8)}...)`)
      })

      this.results.push({
        testName: 'Recursive Page Collection',
        success: true,
        details: {
          totalPages: result.totalPages,
          maxDepth: options.maxDepth,
          discoveredDatabases: result.discoveredDatabases.length
        }
      })

    } catch (error) {
      console.error('  ❌ 실패:', error)
      this.results.push({
        testName: 'Recursive Page Collection',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    console.log()
  }

  private async testChildPageDetection(): Promise<void> {
    console.log('🔍 Test 3: 하위 페이지 탐지')
    
    try {
      const testPageId = process.env.NOTION_PAGE_ID
      if (!testPageId) {
        throw new Error('NOTION_PAGE_ID 환경변수가 설정되지 않았습니다')
      }

      const childPages = await this.notionService.getChildPages(testPageId)
      
      console.log(`  👶 발견된 하위 페이지: ${childPages.length}개`)
      childPages.forEach((childId, index) => {
        console.log(`    ${index + 1}. ${childId.substring(0, 8)}...`)
      })

      this.results.push({
        testName: 'Child Page Detection',
        success: true,
        details: { childPageCount: childPages.length }
      })

    } catch (error) {
      console.error('  ❌ 실패:', error)
      this.results.push({
        testName: 'Child Page Detection',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    console.log()
  }

  private async testDatabaseDiscovery(): Promise<void> {
    console.log('🔍 Test 4: 데이터베이스 발견')
    
    try {
      const testPageId = process.env.NOTION_PAGE_ID
      if (!testPageId) {
        throw new Error('NOTION_PAGE_ID 환경변수가 설정되지 않았습니다')
      }

      const databases = await this.notionService.findDatabasesInPage(testPageId)
      
      console.log(`  🗂️  발견된 데이터베이스: ${databases.length}개`)
      databases.forEach((dbId, index) => {
        console.log(`    ${index + 1}. ${dbId.substring(0, 8)}...`)
      })

      this.results.push({
        testName: 'Database Discovery',
        success: true,
        details: { databaseCount: databases.length }
      })

    } catch (error) {
      console.error('  ❌ 실패:', error)
      this.results.push({
        testName: 'Database Discovery',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    console.log()
  }

  private async testCollectionMethodComparison(): Promise<void> {
    console.log('🔍 Test 5: 수집 방식 비교')
    
    try {
      const testPageId = process.env.NOTION_PAGE_ID
      const testDatabaseId = process.env.NOTION_DATABASE_ID
      
      if (!testPageId || !testDatabaseId) {
        console.log('  ⏭️  건너뜀: NOTION_PAGE_ID 또는 NOTION_DATABASE_ID가 설정되지 않음')
        this.results.push({
          testName: 'Collection Method Comparison',
          success: true,
          details: { skipped: true, reason: 'Missing environment variables' }
        })
        return
      }

      // 페이지 방식 테스트
      const pageResult = await this.documentProcessor.processPageRecursively(testPageId, {
        maxDepth: 2,
        excludeEmpty: true
      })

      // 데이터베이스 방식 테스트
      const databaseResult = await this.documentProcessor.processCollectionMethod(
        'database',
        testDatabaseId
      )

      console.log('  📊 페이지 방식 결과:')
      console.log(`    - 처리된 페이지: ${pageResult.processedPages}개`)
      console.log(`    - 건너뛴 페이지: ${pageResult.skippedPages}개`)
      console.log(`    - 생성된 벡터: ${pageResult.totalVectors}개`)

      console.log('  📊 데이터베이스 방식 결과:')
      console.log(`    - 처리된 페이지: ${databaseResult.processedPages}개`)
      console.log(`    - 건너뛴 페이지: ${databaseResult.skippedPages}개`)
      console.log(`    - 생성된 벡터: ${databaseResult.totalVectors}개`)

      this.results.push({
        testName: 'Collection Method Comparison',
        success: true,
        details: {
          pageMethod: pageResult,
          databaseMethod: databaseResult
        }
      })

    } catch (error) {
      console.error('  ❌ 실패:', error)
      this.results.push({
        testName: 'Collection Method Comparison',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    console.log()
  }

  private async testPageBlocksRetrieval(): Promise<void> {
    console.log('🔍 Test 6: 페이지 블록 조회')
    
    try {
      const testPageId = process.env.NOTION_PAGE_ID
      if (!testPageId) {
        throw new Error('NOTION_PAGE_ID 환경변수가 설정되지 않았습니다')
      }

      const blocks = await this.notionService.getPageBlocks(testPageId)
      
      console.log(`  🧱 조회된 블록: ${blocks.length}개`)
      
      // 블록 타입별 분포
      const blockTypes = new Map<string, number>()
      blocks.forEach(block => {
        const type = (block as any).type || 'unknown'
        blockTypes.set(type, (blockTypes.get(type) || 0) + 1)
      })

      console.log('  📋 블록 타입 분포:')
      blockTypes.forEach((count, type) => {
        console.log(`    - ${type}: ${count}개`)
      })

      this.results.push({
        testName: 'Page Blocks Retrieval',
        success: true,
        details: {
          totalBlocks: blocks.length,
          blockTypes: Object.fromEntries(blockTypes)
        }
      })

    } catch (error) {
      console.error('  ❌ 실패:', error)
      this.results.push({
        testName: 'Page Blocks Retrieval',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
    console.log()
  }

  private printResults(): void {
    console.log('📊 테스트 결과 요약\n')
    
    const successCount = this.results.filter(r => r.success).length
    const totalCount = this.results.length

    console.log(`총 테스트: ${totalCount}개`)
    console.log(`성공: ${successCount}개`)
    console.log(`실패: ${totalCount - successCount}개\n`)

    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌'
      console.log(`${status} ${index + 1}. ${result.testName}`)
      
      if (!result.success && result.error) {
        console.log(`   오류: ${result.error}`)
      }
      
      if (result.details) {
        console.log(`   상세: ${JSON.stringify(result.details, null, 2)}`)
      }
      console.log()
    })

    if (successCount === totalCount) {
      console.log('🎉 모든 테스트가 성공했습니다!')
      process.exit(0)
    } else {
      console.log(`⚠️  ${totalCount - successCount}개의 테스트가 실패했습니다.`)
      process.exit(1)
    }
  }
}

// 환경변수 체크
const requiredEnvVars = ['NOTION_INTEGRATION_TOKEN', 'NOTION_DATABASE_ID', 'NOTION_PAGE_ID']
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingEnvVars.length > 0) {
  console.error('❌ 필수 환경변수가 설정되지 않았습니다:')
  missingEnvVars.forEach(varName => console.error(`  - ${varName}`))
  console.error('\nenv/.env.dev 파일을 확인하세요.')
  process.exit(1)
}

// 테스트 실행
const test = new PageCollectionIntegrationTest()
test.runAllTests().catch(error => {
  console.error('❌ 테스트 실행 중 오류 발생:', error)
  process.exit(1)
})