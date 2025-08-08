#!/usr/bin/env tsx

/**
 * 벡터 인덱스 초기화 스크립트
 * 
 * Pinecone 인덱스의 모든 벡터를 삭제하여 초기화합니다.
 * 
 * 사용법: npm run clear:vectors [옵션]
 */

import dotenv from 'dotenv'
import { PineconeService } from '../src/services/pinecone/pinecone.service'
import { PineconeClient } from '../src/services/pinecone/pinecone.client'
import { createPineconeConfig } from '../src/config/pinecone'

// 환경변수 로드
dotenv.config({ path: 'env/.env.integration' })

interface CliOptions {
  verbose?: boolean
  dryRun?: boolean
  confirm?: boolean
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🗑️  Pinecone 벡터 인덱스 초기화 도구

사용법:
  npm run clear:vectors [옵션]

옵션:
  --confirm           확인 없이 실행 (위험!)
  --verbose           상세 로그 출력
  --dry-run           실제 삭제 없이 정보만 조회
  --help, -h          도움말 표시

⚠️  주의사항:
  - 이 작업은 되돌릴 수 없습니다
  - 모든 벡터 데이터가 영구적으로 삭제됩니다
  - 프로덕션 환경에서는 매우 주의해서 사용하세요

예시:
  npm run clear:vectors --dry-run                # 삭제할 벡터 개수만 확인
  npm run clear:vectors --verbose                # 상세 정보와 함께 실행
  npm run clear:vectors --confirm --verbose      # 확인 없이 즉시 실행
`)
    process.exit(0)
  }

  const options: CliOptions = {
    verbose: false,
    dryRun: false,
    confirm: false
  }

  for (const arg of args) {
    switch (arg) {
      case '--verbose':
        options.verbose = true
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--confirm':
        options.confirm = true
        break
      default:
        console.error(`❌ 알 수 없는 옵션: ${arg}`)
        process.exit(1)
    }
  }

  return options
}

async function getUserConfirmation(): Promise<boolean> {
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question('정말로 모든 벡터를 삭제하시겠습니까? (y/n): ', (answer: string) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y')
    })
  })
}

async function getVectorStats(pineconeService: PineconeService): Promise<{ totalVectors: number; namespaces: string[] }> {
  try {
    // Pinecone 인덱스 통계 조회
    const stats = await pineconeService.describeIndexStats()
    
    const totalVectors = stats.totalRecordCount || 0
    const namespaces = Object.keys(stats.namespaces || {})
    
    return { totalVectors, namespaces }
  } catch (error) {
    console.warn('⚠️  벡터 통계 조회 실패, 기본값으로 진행합니다')
    return { totalVectors: 0, namespaces: [] }
  }
}

async function main() {
  const startTime = Date.now()
  const options = parseArgs()

  console.log('🗑️  벡터 인덱스 초기화 시작')
  console.log(`⚙️  옵션:`)
  console.log(`   드라이런 모드: ${options.dryRun ? '예' : '아니오'}`)
  console.log(`   상세 로그: ${options.verbose ? '예' : '아니오'}`)
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

    // 현재 벡터 통계 조회
    console.log('📊 현재 인덱스 상태 조회 중...')
    const { totalVectors, namespaces } = await getVectorStats(pineconeService)

    console.log(`📈 인덱스 통계:`)
    console.log(`   총 벡터 개수: ${totalVectors.toLocaleString()}개`)
    
    if (namespaces.length > 0) {
      console.log(`   네임스페이스: ${namespaces.length}개`)
      if (options.verbose) {
        namespaces.forEach((ns, index) => {
          console.log(`     ${index + 1}. ${ns || '(default)'}`)
        })
      }
    } else {
      console.log(`   네임스페이스: 없음`)
    }
    console.log('')

    if (totalVectors === 0) {
      console.log('✅ 인덱스가 이미 비어있습니다.')
      return
    }

    if (options.dryRun) {
      console.log('💡 드라이런 모드: 실제 삭제는 수행하지 않습니다.')
      console.log(`🔍 삭제 대상: ${totalVectors.toLocaleString()}개 벡터`)
      return
    }

    // 사용자 확인 (--confirm 옵션이 없는 경우)
    if (!options.confirm) {
      console.log('⚠️  경고: 이 작업은 되돌릴 수 없습니다!')
      console.log(`🔥 삭제될 벡터: ${totalVectors.toLocaleString()}개`)
      console.log('')

      const confirmed = await getUserConfirmation()
      if (!confirmed) {
        console.log('❌ 사용자가 취소했습니다.')
        return
      }
    }

    // 벡터 삭제 실행
    console.log('🔥 벡터 삭제 시작...')
    
    if (namespaces.length > 0) {
      // 네임스페이스별 삭제
      for (const namespace of namespaces) {
        const nsName = namespace || 'default'
        console.log(`   ${nsName} 네임스페이스 삭제 중...`)
        await pineconeService.deleteAll(namespace)
        console.log(`   ✅ ${nsName} 네임스페이스 삭제 완료`)
      }
    } else {
      // 기본 네임스페이스 삭제
      await pineconeService.deleteAll()
      console.log('   ✅ 기본 네임스페이스 삭제 완료')
    }

    // 삭제 후 통계 확인
    console.log('')
    console.log('🔍 삭제 후 상태 확인 중...')
    
    // 잠시 대기 (Pinecone 인덱스 업데이트 시간)
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const { totalVectors: remainingVectors } = await getVectorStats(pineconeService)

    // 결과 출력
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log('')
    console.log('🎉 벡터 삭제 완료!')
    console.log('📈 최종 결과:')
    console.log(`   삭제 전 벡터: ${totalVectors.toLocaleString()}개`)
    console.log(`   삭제 후 벡터: ${remainingVectors.toLocaleString()}개`)
    console.log(`   삭제된 벡터: ${(totalVectors - remainingVectors).toLocaleString()}개`)
    console.log(`   소요 시간: ${elapsed}초`)

    if (remainingVectors > 0) {
      console.log('')
      console.log('⚠️  일부 벡터가 남아있을 수 있습니다. Pinecone 인덱스 업데이트는 시간이 걸릴 수 있습니다.')
    }

  } catch (error) {
    console.error('❌ 벡터 삭제 중 오류 발생:', error)
    process.exit(1)
  }
}

// 스크립트 실행
main().catch(error => {
  console.error('❌ 스크립트 실행 실패:', error)
  process.exit(1)
})