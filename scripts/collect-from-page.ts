#!/usr/bin/env tsx

/**
 * 페이지 기반 재귀 수집 스크립트
 * 
 * 특정 노션 페이지를 루트로 시작하여 모든 하위 페이지와 데이터베이스를 
 * 재귀적으로 수집하고 벡터화하여 Pinecone에 저장합니다.
 * 
 * 사용법: npm run collect:page <page-id> [옵션]
 */

import dotenv from 'dotenv'
import { DocumentProcessor } from '../src/services/document/document.processor'
import { NotionService } from '../src/services/notion/notion.service'
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

interface CliOptions extends PageCollectionOptions {
  verbose?: boolean
  dryRun?: boolean
}

function parseArgs(): { pageId: string; options: CliOptions } {
  const args = process.argv.slice(2)
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
📄 노션 페이지 기반 재귀 수집 도구

사용법:
  npm run collect:page <page-id> [옵션]

필수 인자:
  <page-id>         노션 페이지 ID (루트 페이지)

옵션:
  --max-depth <n>   재귀 수집 최대 깊이 (기본값: 10)
  --exclude-empty   빈 페이지 제외
  --no-database     하위 데이터베이스 수집 안함
  --verbose         상세 로그 출력
  --dry-run         실제 저장 없이 수집만 테스트
  --help, -h        도움말 표시

예시:
  npm run collect:page abc123-def456-ghi789
  npm run collect:page abc123-def456-ghi789 --max-depth 5 --exclude-empty
  npm run collect:page abc123-def456-ghi789 --verbose --dry-run
`)
    process.exit(0)
  }

  const pageId = args[0]
  const options: CliOptions = {
    maxDepth: 10,
    includeDatabase: true,
    excludeEmpty: false,
    verbose: false,
    dryRun: false
  }

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--max-depth':
        options.maxDepth = parseInt(args[++i], 10)
        if (isNaN(options.maxDepth)) {
          console.error('❌ --max-depth 값은 숫자여야 합니다')
          process.exit(1)
        }
        break
      case '--exclude-empty':
        options.excludeEmpty = true
        break
      case '--no-database':
        options.includeDatabase = false
        break
      case '--verbose':
        options.verbose = true
        break
      case '--dry-run':
        options.dryRun = true
        break
      default:
        console.error(`❌ 알 수 없는 옵션: ${arg}`)
        process.exit(1)
    }
  }

  return { pageId, options }
}

async function main() {
  const startTime = Date.now()
  const { pageId, options } = parseArgs()

  console.log('🚀 페이지 기반 재귀 수집 시작')
  console.log(`📄 루트 페이지: ${pageId}`)
  console.log(`⚙️  옵션:`)
  console.log(`   최대 깊이: ${options.maxDepth}`)
  console.log(`   하위 DB 수집: ${options.includeDatabase ? '예' : '아니오'}`)
  console.log(`   빈 페이지 제외: ${options.excludeEmpty ? '예' : '아니오'}`)
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

    await notionService.initialize()
    
    if (options.verbose) {
      console.log('✅ 모든 서비스 초기화 완료\n')
    }

    // 드라이런 모드인 경우 실제 저장하지 않는 Mock 서비스 사용
    const documentProcessor = new DocumentProcessor(
      notionService,
      embeddingService,
      options.dryRun ? createMockPineconeService() : pineconeService
    )

    // 수집 실행
    console.log('📊 수집 진행 중...')
    const result = await documentProcessor.processPageRecursively(pageId, options)

    // 결과 출력
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('\n🎉 수집 완료!')
    console.log('📈 수집 통계:')
    console.log(`   처리된 페이지: ${result.processedPages}개`)
    console.log(`   건너뛴 페이지: ${result.skippedPages}개`)
    console.log(`   생성된 벡터: ${result.totalVectors}개`)
    console.log(`   발견된 DB: ${result.discoveredDatabases.length}개`)
    console.log(`   소요 시간: ${elapsed}초`)

    if (result.errors.length > 0) {
      console.log('\n⚠️  오류 발생:')
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.title}: ${error.error}`)
      })
    }

    if (result.discoveredDatabases.length > 0) {
      console.log('\n🗂️  발견된 데이터베이스:')
      result.discoveredDatabases.forEach((dbId, index) => {
        console.log(`   ${index + 1}. ${dbId}`)
      })
    }

    if (options.dryRun) {
      console.log('\n💡 드라이런 모드였습니다. 실제 데이터는 저장되지 않았습니다.')
    }

  } catch (error) {
    console.error('❌ 수집 중 오류 발생:', error)
    process.exit(1)
  }
}

function createMockPineconeService() {
  return {
    upsert: async () => {
      // 드라이런 모드에서는 실제 저장하지 않음
    }
  } as any
}

// 스크립트 실행
main().catch(error => {
  console.error('❌ 스크립트 실행 실패:', error)
  process.exit(1)
})