#!/usr/bin/env tsx

/**
 * 벡터 인덱스 상태 조회 스크립트
 * 
 * Pinecone 인덱스의 벡터 개수와 상태를 조회합니다.
 * 
 * 사용법: npm run show:vectors [옵션]
 */

import dotenv from 'dotenv'
import { PineconeService } from '../src/services/pinecone/pinecone.service'
import { PineconeClient } from '../src/services/pinecone/pinecone.client'
import { createPineconeConfig } from '../src/config/pinecone'

// 환경변수 로드
dotenv.config({ path: 'env/.env.integration' })

interface CliOptions {
  verbose?: boolean
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📊 Pinecone 벡터 인덱스 상태 조회 도구

사용법:
  npm run show:vectors [옵션]

옵션:
  --verbose           상세 정보 출력
  --help, -h          도움말 표시

예시:
  npm run show:vectors                    # 기본 정보만 조회
  npm run show:vectors --verbose          # 상세 정보까지 조회
`)
    process.exit(0)
  }

  const options: CliOptions = {
    verbose: false
  }

  for (const arg of args) {
    switch (arg) {
      case '--verbose':
        options.verbose = true
        break
      default:
        console.error(`❌ 알 수 없는 옵션: ${arg}`)
        process.exit(1)
    }
  }

  return options
}

async function main() {
  const options = parseArgs()

  console.log('📊 벡터 인덱스 상태 조회')
  console.log('')

  try {
    // Pinecone 서비스 초기화
    const pineconeConfig = createPineconeConfig()
    const pineconeClient = new PineconeClient(pineconeConfig)
    const pineconeService = new PineconeService(pineconeClient)

    if (options.verbose) {
      console.log('✅ Pinecone 서비스 초기화 완료')
      console.log(`📊 인덱스: ${pineconeConfig.indexName}`)
      console.log('')
    }

    // 인덱스 통계 조회
    console.log('📊 인덱스 상태 조회 중...')
    const stats = await pineconeService.describeIndexStats()

    const totalVectors = stats.totalRecordCount || 0
    const namespaces = Object.keys(stats.namespaces || {})

    console.log('')
    console.log('📈 인덱스 통계:')
    console.log(`   총 벡터 개수: ${totalVectors.toLocaleString()}개`)
    
    if (totalVectors === 0) {
      console.log('   상태: 비어있음 (초기화됨)')
    } else {
      console.log('   상태: 데이터 있음')
    }

    if (namespaces.length > 0) {
      console.log(`   네임스페이스: ${namespaces.length}개`)
      
      if (options.verbose) {
        console.log('')
        console.log('📁 네임스페이스별 상세 정보:')
        
        for (const [index, namespace] of namespaces.entries()) {
          const nsName = namespace || '(default)'
          const nsStats = stats.namespaces[namespace] || {}
          const nsVectorCount = nsStats.recordCount || 0
          
          console.log(`   ${index + 1}. ${nsName}`)
          console.log(`      벡터 개수: ${nsVectorCount.toLocaleString()}개`)
        }
      }
    } else {
      console.log(`   네임스페이스: 없음`)
    }

    if (options.verbose && stats.dimension) {
      console.log('')
      console.log('🔧 인덱스 설정:')
      console.log(`   벡터 차원: ${stats.dimension}`)
    }

    // 건강 상태 확인
    console.log('')
    console.log('🏥 서비스 상태 확인 중...')
    const isHealthy = await pineconeService.healthCheck()
    console.log(`   Pinecone 연결: ${isHealthy ? '✅ 정상' : '❌ 오류'}`)

    if (totalVectors > 0) {
      console.log('')
      console.log('💡 팁:')
      console.log('   - 벡터를 모두 삭제하려면: npm run clear:vectors')
      console.log('   - 새로운 데이터를 수집하려면: npm run collect:* 명령어 사용')
    }

  } catch (error) {
    console.error('❌ 벡터 상태 조회 중 오류 발생:', error)
    process.exit(1)
  }
}

// 스크립트 실행
main().catch(error => {
  console.error('❌ 스크립트 실행 실패:', error)
  process.exit(1)
})