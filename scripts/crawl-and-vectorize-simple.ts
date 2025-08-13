#!/usr/bin/env tsx

/**
 * HTML 크롤링 + 벡터화 단순 스크립트 (MVP)
 * 
 * 지정된 웹사이트를 크롤링하고 자동으로 벡터화하여 Pinecone에 저장합니다.
 * 
 * 사용법: npm run crawl-and-vectorize <start-url> --env=<dev|test|prod> [옵션]
 */

import { HtmlCrawlerService } from '../src/services/html/html-crawler.service'
import { DocumentProcessor } from '../src/services/document/document.processor'
import { NotionService } from '../src/services/notion/notion.service'
import { EmbeddingService } from '../src/services/openai/embedding.service'
import { OpenAIClient } from '../src/services/openai/openai.client'
import { PineconeService } from '../src/services/vector/pinecone.service'
import { PineconeClient } from '../src/services/vector/pinecone.client'
import { createNotionConfig } from '../src/config/notion'
import { createOpenAIConfig } from '../src/config/openai'
import { createPineconeConfig } from '../src/config/pinecone'
import type { CrawlOptions } from '../src/types/html'
import { parseEnvironment, loadEnvironment, getEnvironmentHelp } from './utils/env-loader'

interface CliOptions extends Partial<CrawlOptions> {
  verbose?: boolean
  dryRun?: boolean
}

function parseArgs(): { startUrl: string; options: CliOptions } {
  const args = process.argv.slice(2)
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🕷️ HTML 크롤링 + 벡터화 도구 (MVP)

사용법:
  npm run crawl-and-vectorize -- <start-url> --env=<dev|test|prod> [옵션]

필수 인자:
  <start-url>       시작 URL (예: https://help.pro.sixshop.com/)

옵션:
  --max-pages <n>   최대 페이지 수 (기본값: 10)
  --max-depth <n>   최대 크롤링 깊이 (기본값: 2)
  --no-vectorize    벡터화 비활성화 (크롤링만 실행)
  --verbose         상세 로그 출력
  --dry-run         실제 저장 없이 테스트만 실행
  --help, -h        도움말 표시
${getEnvironmentHelp()}

⚠️  중요: npm run 명령어 사용 시 반드시 -- 구분자를 사용하세요

예시:
  npm run crawl-and-vectorize -- https://help.pro.sixshop.com/ --env=dev --max-pages=20
  npm run crawl-and-vectorize -- https://help.pro.sixshop.com/ --env=prod --no-vectorize
  npm run crawl-and-vectorize -- https://help.pro.sixshop.com/ --env=prod --dry-run

직접 실행 (tsx):
  tsx scripts/crawl-and-vectorize-simple.ts https://help.pro.sixshop.com/ --env=prod --max-pages=20
`)
    process.exit(0)
  }

  const startUrl = args.find(arg => arg.startsWith('http'))
  if (!startUrl) {
    console.error('❌ 시작 URL이 필요합니다.')
    process.exit(1)
  }

  const options: CliOptions = {
    maxPages: 10,
    maxDepth: 2,
    autoVectorize: true
  }

  // 옵션 파싱
  args.forEach((arg, index) => {
    if (arg === '--max-pages' && args[index + 1]) {
      options.maxPages = parseInt(args[index + 1])
    }
    if (arg === '--max-depth' && args[index + 1]) {
      options.maxDepth = parseInt(args[index + 1])
    }
    if (arg === '--no-vectorize') {
      options.autoVectorize = false
    }
    if (arg === '--verbose') {
      options.verbose = true
    }
    if (arg === '--dry-run') {
      options.dryRun = true
    }
  })

  return { startUrl, options }
}

// 드라이런 모드용 Mock 서비스
function createMockPineconeService(): PineconeService {
  const mockClient = {
    getIndex: () => ({
      upsert: async (data: any) => {
        console.log(`   [DRY-RUN] 벡터 저장 시뮬레이션: ${data[0]?.id}`)
      }
    })
  } as any

  return new PineconeService(mockClient)
}

async function main() {
  const startTime = Date.now()
  
  // 환경 설정을 먼저 로드 (URL 파싱 전에)
  const environment = parseEnvironment(process.argv.slice(2))
  loadEnvironment(environment)
  
  const { startUrl, options } = parseArgs()

  console.log('🚀 HTML 크롤링 + 벡터화 시작')
  console.log(`🔗 시작 URL: ${startUrl}`)
  console.log(`⚙️  옵션:`)
  console.log(`   최대 페이지: ${options.maxPages}개`)
  console.log(`   최대 깊이: ${options.maxDepth}`)
  console.log(`   자동 벡터화: ${options.autoVectorize ? '예' : '아니오'}`)
  console.log(`   드라이런 모드: ${options.dryRun ? '예' : '아니오'}`)
  console.log('')

  try {
    // 서비스 초기화
    const notionConfig = createNotionConfig()
    const openaiConfig = createOpenAIConfig()
    const pineconeConfig = createPineconeConfig()

    const notionService = new NotionService(notionConfig)
    const openaiClient = new OpenAIClient(openaiConfig)
    const embeddingService = new EmbeddingService(openaiClient)
    const pineconeClient = new PineconeClient(pineconeConfig)
    const pineconeService = new PineconeService(pineconeClient)

    // NotionService는 벡터화에만 필요하므로 autoVectorize가 true일 때만 초기화
    if (options.autoVectorize && !options.dryRun) {
      await notionService.initialize()
    }
    
    if (options.verbose) {
      console.log('✅ 모든 서비스 초기화 완료\n')
    }

    // DocumentProcessor 및 HtmlCrawlerService 초기화
    let documentProcessor: DocumentProcessor | undefined
    if (options.autoVectorize) {
      documentProcessor = new DocumentProcessor(
        notionService,
        embeddingService,
        options.dryRun ? createMockPineconeService() : pineconeService
      )
    }

    const crawler = new HtmlCrawlerService(documentProcessor)

    // 크롤링 + 벡터화 실행
    console.log('🕷️ 크롤링 시작...')
    const session = await crawler.crawlSite(startUrl, {
      maxPages: options.maxPages,
      maxDepth: options.maxDepth,
      autoVectorize: options.autoVectorize,
      crawlDelay: 2000,  // 서버 부하 방지
      concurrency: 2     // 동시 요청 제한
    })

    // 결과 출력
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    
    console.log('')
    console.log('🎉 모든 작업 완료!')
    console.log(`⏱️  소요 시간: ${elapsed}초`)
    console.log(`📊 크롤링 결과:`)
    console.log(`   처리된 페이지: ${session.statistics.processedPages}개`)
    console.log(`   건너뛴 페이지: ${session.statistics.skippedPages}개`)
    console.log(`   중복 페이지: ${session.statistics.duplicatePages}개`)
    console.log(`   에러 페이지: ${session.statistics.errorPages}개`)

    if (session.vectorizationResult && options.autoVectorize) {
      console.log(`📊 벡터화 결과:`)
      console.log(`   성공: ${session.vectorizationResult.processed}개`)
      console.log(`   실패: ${session.vectorizationResult.failed}개`)
      
      if (session.vectorizationResult.errors.length > 0) {
        console.log(`❌ 벡터화 실패 목록:`)
        session.vectorizationResult.errors.forEach(error => {
          console.log(`   - ${error.title}: ${error.error}`)
        })
      }
    }

  } catch (error) {
    console.error('❌ 실행 실패:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}