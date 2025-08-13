#!/usr/bin/env tsx

/**
 * 혼합 수집 스크립트
 * 
 * JSON 설정 파일을 기반으로 데이터베이스와 페이지 방식을 
 * 조합하여 수집하고 벡터화하여 Pinecone에 저장합니다.
 * 
 * 사용법: npm run collect:mixed <config-file-path> --env=<dev|test|prod> [옵션]
 */

import { parseEnvironment, loadEnvironment, getEnvironmentHelp } from './utils/env-loader'
import { readFileSync } from 'fs'
import { DocumentProcessor } from '../src/services/document/document.processor'
import { NotionService } from '../src/services/notion/notion.service'
import { EmbeddingService } from '../src/services/openai/embedding.service'
import { OpenAIClient } from '../src/services/openai/openai.client'
import { PineconeService } from '../src/services/vector/pinecone.service'
import { PineconeClient } from '../src/services/vector/pinecone.client'
import { createNotionConfig } from '../src/config/notion'
import { createOpenAIConfig } from '../src/config/openai'
import { createPineconeConfig } from '../src/config/pinecone'
import type { PageCollectionOptions } from '../src/types/notion'


interface CollectionItem {
  type: 'database' | 'page'
  id: string
  name: string
  options?: PageCollectionOptions
}

interface CollectionConfig {
  collections: CollectionItem[]
}

interface CliOptions {
  verbose?: boolean
  dryRun?: boolean
}

function parseArgs(): { configPath: string; options: CliOptions } {
  const args = process.argv.slice(2)
  
  if (args[0] === '--help' || args[0] === '-h') {
    console.log(`
🔀 노션 혼합 수집 도구

사용법:
  npm run collect:mixed [config-file-path] --env=<dev|test|prod> [옵션]

선택 인자:
  [config-file-path]  수집 설정 JSON 파일 경로 (기본값: configs/notion-collection.json)

옵션:
  --verbose           상세 로그 출력
  --dry-run           실제 저장 없이 수집만 테스트
  --help, -h          도움말 표시
${getEnvironmentHelp()}

설정 파일 예시 (configs/notion-collection.json):
{
  "collections": [
    {
      "type": "database",
      "id": "249fdde8c2ac8095b88fe24a46513171",
      "name": "기본 노션 데이터베이스"
    }
  ]
}

예시:
  npm run collect:mixed --env=dev                              # 기본 설정 파일 사용
  npm run collect:mixed --env=test --dry-run --verbose        # 기본 설정으로 드라이런
  npm run collect:mixed ./configs/my-custom.json --env=prod   # 사용자 정의 설정 파일
`)
    process.exit(0)
  }

  // 첫 번째 인자가 옵션인지 파일 경로인지 확인
  let configPath = 'configs/notion-collection.json' // 기본값
  let startIndex = 0
  
  if (args.length > 0 && !args[0].startsWith('--')) {
    // 첫 번째 인자가 옵션이 아니면 파일 경로로 사용
    configPath = args[0]
    startIndex = 1
  }
  
  const options: CliOptions = {
    verbose: false,
    dryRun: false
  }

  for (let i = startIndex; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--env=')) {
      // env 옵션은 env-loader에서 처리하므로 건너뜀
      continue
    }
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

  return { configPath, options }
}

function loadConfig(configPath: string): CollectionConfig {
  try {
    const configContent = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(configContent) as CollectionConfig
    
    // 기본 검증
    if (!config.collections || !Array.isArray(config.collections)) {
      throw new Error('설정 파일에 collections 배열이 필요합니다')
    }
    
    if (config.collections.length === 0) {
      throw new Error('최소 하나의 수집 대상이 필요합니다')
    }
    
    // 각 수집 대상 검증
    for (const [index, item] of config.collections.entries()) {
      if (!item.type || !['database', 'page'].includes(item.type)) {
        throw new Error(`수집 대상 ${index + 1}: type은 'database' 또는 'page'여야 합니다`)
      }
      
      if (!item.id || typeof item.id !== 'string') {
        throw new Error(`수집 대상 ${index + 1}: id가 필요합니다`)
      }
      
      if (!item.name || typeof item.name !== 'string') {
        throw new Error(`수집 대상 ${index + 1}: name이 필요합니다`)
      }
    }
    
    return config
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`❌ 설정 파일 JSON 형식 오류: ${error.message}`)
    } else {
      console.error(`❌ 설정 파일 로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
    process.exit(1)
  }
}

async function main() {
  const startTime = Date.now()
  const { configPath, options } = parseArgs()
  
  // 환경 설정 로드
  const environment = parseEnvironment(process.argv.slice(2))
  loadEnvironment(environment)
  
  const config = loadConfig(configPath)

  console.log('🚀 혼합 수집 시작')
  console.log(`📋 설정 파일: ${configPath}`)
  console.log(`📊 수집 대상: ${config.collections.length}개`)
  console.log(`⚙️  옵션:`)
  console.log(`   드라이런 모드: ${options.dryRun ? '예' : '아니오'}`)
  console.log('')

  // 수집 대상 목록 출력
  console.log('📋 수집 계획:')
  config.collections.forEach((item, index) => {
    const typeIcon = item.type === 'database' ? '🗂️' : '📄'
    console.log(`   ${index + 1}. ${typeIcon} ${item.name} (${item.type}): ${item.id}`)
    
    if (item.options && options.verbose) {
      console.log(`      옵션: ${JSON.stringify(item.options)}`)
    }
  })
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

    // 전체 결과 집계
    let totalProcessedPages = 0
    let totalSkippedPages = 0
    let totalVectors = 0
    let totalDiscoveredDatabases: string[] = []
    const allErrors: Array<{ source: string; title: string; error: string }> = []

    // 각 수집 대상 처리
    for (const [index, item] of config.collections.entries()) {
      const progress = `[${index + 1}/${config.collections.length}]`
      const typeIcon = item.type === 'database' ? '🗂️' : '📄'
      
      console.log(`${progress} ${typeIcon} ${item.name} 수집 시작...`)
      
      try {
        let result
        
        if (item.type === 'database') {
          result = await documentProcessor.processCollectionMethod('database', item.id)
        } else {
          result = await documentProcessor.processPageRecursively(item.id, item.options || {})
        }
        
        // 결과 집계
        totalProcessedPages += result.processedPages
        totalSkippedPages += result.skippedPages
        totalVectors += result.totalVectors
        
        if ('discoveredDatabases' in result) {
          totalDiscoveredDatabases.push(...result.discoveredDatabases)
        }
        
        // 에러에 출처 정보 추가
        result.errors.forEach(error => {
          allErrors.push({
            source: item.name,
            title: error.title,
            error: error.error
          })
        })
        
        console.log(`   ✅ ${item.name} 완료: ${result.processedPages}개 페이지 처리`)
        
        if (options.verbose && result.errors.length > 0) {
          console.log(`   ⚠️  오류 ${result.errors.length}개`)
        }
        
      } catch (error) {
        console.error(`   ❌ ${item.name} 수집 실패:`, error)
        allErrors.push({
          source: item.name,
          title: item.name,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        })
      }
    }

    // 최종 결과 출력
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('\n🎉 혼합 수집 완료!')
    console.log('📈 전체 수집 통계:')
    console.log(`   처리된 페이지: ${totalProcessedPages}개`)
    console.log(`   건너뛴 페이지: ${totalSkippedPages}개`)
    console.log(`   생성된 벡터: ${totalVectors}개`)
    console.log(`   소요 시간: ${elapsed}초`)

    if (totalDiscoveredDatabases.length > 0) {
      console.log(`\n🗂️  발견된 데이터베이스: ${totalDiscoveredDatabases.length}개`)
      if (options.verbose) {
        totalDiscoveredDatabases.forEach((dbId, index) => {
          console.log(`   ${index + 1}. ${dbId}`)
        })
      }
    }

    if (allErrors.length > 0) {
      console.log('\n⚠️  발생한 오류:')
      allErrors.forEach((error, index) => {
        console.log(`   ${index + 1}. [${error.source}] ${error.title}: ${error.error}`)
      })
    }

    if (options.dryRun) {
      console.log('\n💡 드라이런 모드였습니다. 실제 데이터는 저장되지 않았습니다.')
    }

  } catch (error) {
    console.error('❌ 혼합 수집 중 오류 발생:', error)
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