#!/usr/bin/env tsx
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

// 전역 변수로 중단 상태 관리
let isInterrupted = false
let currentTestName = ''

// 시그널 처리 설정
function setupSignalHandlers() {
  const handleInterrupt = () => {
    isInterrupted = true
    console.log(`\n\n⚠️  사용자 중단 요청 (Ctrl+C)`)
    if (currentTestName) {
      console.log(`📍 현재 실행 중인 테스트: ${currentTestName}`)
      console.log('⏹️  테스트 중단 중...')
    }
    console.log('👋 테스트 실행을 중단합니다.')
    process.exit(130) // 130 = 128 + SIGINT(2)
  }

  process.on('SIGINT', handleInterrupt)   // Ctrl+C
  process.on('SIGTERM', handleInterrupt)  // 종료 시그널
}

// 사용 가능한 통합 테스트 목록 (서버 없이 실행 가능한 테스트들)
const AVAILABLE_TESTS = {
  'notion': 'test-notion-integration.ts',
  'openai': 'test-openai-integration.ts',
  'embedding': 'test-embedding-integration.ts',  
  'pinecone': 'test-pinecone-integration.ts',
  'page-collection': 'test-page-collection.ts',
  'indexing-pipeline': 'test-indexing-pipeline.ts',
  'rag-pipeline': 'test-rag-pipeline.ts'
} as const

// 서버 기반 API 테스트 (별도 실행 필요)
const SERVER_TESTS = {
  'streaming-api': 'test-streaming-api.ts'
} as const

type TestName = keyof typeof AVAILABLE_TESTS

function showHelp() {
  console.log(`
🧪 통합 테스트 실행기

사용법:
  npm run test:integration [테스트명]
  
사용 가능한 통합 테스트 (서버 불필요):
${Object.keys(AVAILABLE_TESTS).map(name => `  - ${name}`).join('\n')}

서버 기반 API 테스트 (별도 실행):
${Object.keys(SERVER_TESTS).map(name => `  - ${name} (서버 실행 후 개별 실행 필요)`).join('\n')}

예시:
  npm run test:integration                    # 모든 통합 테스트 순차 실행 (서버 불필요)
  npm run test:integration notion             # 노션 테스트만 실행
  npm run test:integration openai             # OpenAI 테스트만 실행
  npm run test:integration indexing-pipeline  # 문서 색인화 파이프라인 테스트만 실행
  npm run test:integration rag-pipeline       # RAG 질의응답 파이프라인 테스트만 실행
  
서버 기반 테스트 실행:
  npm run dev                             # 서버 실행 (별도 터미널)
  tsx tests/integration/test-streaming-api.ts  # API 테스트 실행
`)
}

function isValidTestName(name: string): name is TestName {
  return name in AVAILABLE_TESTS
}

async function runSingleTest(testName: TestName) {
  // 중단 요청 체크
  if (isInterrupted) {
    console.log(`⏹️  테스트 중단됨: ${testName}`)
    return
  }

  const testFile = AVAILABLE_TESTS[testName]
  const testPath = join(__dirname, '..', 'tests', 'integration', testFile)
  
  if (!existsSync(testPath)) {
    console.error(`❌ 테스트 파일을 찾을 수 없습니다: ${testPath}`)
    process.exit(1)
  }
  
  // 현재 실행 중인 테스트 설정
  currentTestName = testName
  
  console.log(`\n🚀 실행 중: ${testName} 테스트`)
  console.log(`📁 파일: ${testFile}`)
  console.log('─'.repeat(50))
  
  try {
    execSync(`tsx "${testPath}"`, { 
      stdio: 'inherit',
      cwd: join(__dirname, '..') 
    })
    console.log(`\n✅ ${testName} 테스트 완료`)
  } catch (error) {
    // SIGINT(Ctrl+C)로 인한 종료인지 확인
    if (error instanceof Error && 'status' in error && error.status === 130) {
      console.log(`\n⚠️  ${testName} 테스트가 사용자에 의해 중단되었습니다`)
      isInterrupted = true
      return
    }
    console.error(`\n❌ ${testName} 테스트 실패`)
    throw error
  } finally {
    // 현재 테스트 이름 초기화
    currentTestName = ''
  }
}

async function runAllTests() {
  const testNames = Object.keys(AVAILABLE_TESTS) as TestName[]
  
  console.log('🧪 모든 통합 테스트 순차 실행 시작')
  console.log(`📊 총 ${testNames.length}개 테스트`)
  console.log('=' .repeat(50))
  
  let passed = 0
  let failed = 0
  const failedTests: string[] = []
  
  for (const testName of testNames) {
    // 중단 요청 체크
    if (isInterrupted) {
      console.log(`\n⏹️  테스트 실행이 중단되었습니다`)
      break
    }

    try {
      await runSingleTest(testName)
      if (!isInterrupted) {
        passed++
      }
    } catch (error) {
      if (isInterrupted) {
        console.log(`\n⏹️  테스트 실행이 중단되었습니다`)
        break
      }
      failed++
      failedTests.push(testName)
      console.error(`\n❌ ${testName} 테스트에서 오류 발생, 다음 테스트로 계속 진행합니다\n`)
    }
  }
  
  // 결과 요약
  console.log('\n' + '='.repeat(50))
  if (isInterrupted) {
    console.log('⚠️  통합 테스트 실행 중단됨')
    console.log('='.repeat(50))
    console.log(`✅ 완료: ${passed}개`)
    console.log(`❌ 실패: ${failed}개`)
    console.log(`⏹️  중단: 나머지 테스트들`)
    console.log('\n👋 사용자에 의해 테스트가 중단되었습니다.')
    process.exit(130)
  } else {
    console.log('📊 통합 테스트 실행 결과')
    console.log('='.repeat(50))
    console.log(`✅ 성공: ${passed}개`)
    console.log(`❌ 실패: ${failed}개`)
    
    if (failedTests.length > 0) {
      console.log(`\n실패한 테스트: ${failedTests.join(', ')}`)
      process.exit(1)
    } else {
      console.log('\n🎉 모든 통합 테스트가 성공했습니다!')
    }
  }
}

async function main() {
  // 시그널 핸들러 설정
  setupSignalHandlers()
  
  const args = process.argv.slice(2)
  
  // 도움말 출력
  if (args.includes('--help') || args.includes('-h')) {
    showHelp()
    process.exit(0)
  }
  
  // 특정 테스트 실행
  if (args.length > 0) {
    const testName = args[0]
    
    if (!isValidTestName(testName)) {
      console.error(`❌ 알 수 없는 테스트: ${testName}`)
      console.error(`사용 가능한 테스트: ${Object.keys(AVAILABLE_TESTS).join(', ')}`)
      process.exit(1)
    }
    
    await runSingleTest(testName)
  } else {
    // 모든 테스트 실행
    await runAllTests()
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('스크립트 실행 중 오류 발생:', error)
    process.exit(1)
  })
}