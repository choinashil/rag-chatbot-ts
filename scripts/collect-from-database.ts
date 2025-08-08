#!/usr/bin/env tsx

/**
 * 데이터베이스 기반 수집 스크립트
 * 
 * 특정 노션 데이터베이스의 모든 페이지를 수집하고 
 * 벡터화하여 Pinecone에 저장합니다.
 * 
 * 사용법: npm run collect:database <database-id> [옵션]
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

// 환경변수 로드
dotenv.config({ path: 'env/.env.integration' })

interface CliOptions {
  verbose?: boolean
  dryRun?: boolean
}

function parseArgs(): { databaseId: string; options: CliOptions } {
  const args = process.argv.slice(2)
  
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
🗂️  노션 데이터베이스 기반 수집 도구

사용법:
  npm run collect:database <database-id> [옵션]

필수 인자:
  <database-id>     노션 데이터베이스 ID

옵션:
  --verbose         상세 로그 출력
  --dry-run         실제 저장 없이 수집만 테스트
  --help, -h        도움말 표시

예시:
  npm run collect:database abc123-def456-ghi789
  npm run collect:database abc123-def456-ghi789 --verbose --dry-run
`)
    process.exit(0)
  }

  const databaseId = args[0]
  const options: CliOptions = {
    verbose: false,
    dryRun: false
  }

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
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

  return { databaseId, options }
}

async function main() {
  const startTime = Date.now()
  const { databaseId, options } = parseArgs()

  console.log('🚀 데이터베이스 기반 수집 시작')
  console.log(`🗂️  데이터베이스: ${databaseId}`)
  console.log(`⚙️  옵션:`)
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
    const result = await documentProcessor.processCollectionMethod('database', databaseId)

    // 결과 출력
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('\n🎉 수집 완료!')
    console.log('📈 수집 통계:')
    console.log(`   처리된 페이지: ${result.processedPages}개`)
    console.log(`   건너뛴 페이지: ${result.skippedPages}개`)
    console.log(`   생성된 벡터: ${result.totalVectors}개`)
    console.log(`   소요 시간: ${elapsed}초`)

    if (result.errors.length > 0) {
      console.log('\n⚠️  오류 발생:')
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.title}: ${error.error}`)
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