/**
 * LangSmith 연결 테스트 스크립트
 */

import dotenv from 'dotenv'
import path from 'path'
import { 
  validateLangSmithConfig, 
  createLangSmithClient, 
  checkLangSmithConnection,
  trackRAGMetrics,
  RAGMetrics 
} from '../src/config/langsmith'

// 환경변수 로드
dotenv.config({ path: path.join(__dirname, '../env/.env.dev') })

async function testLangSmith() {
  console.log('🔍 LangSmith 연결 테스트 시작...')
  
  // 1. 설정 검증
  console.log('📋 LangSmith 설정 검증...')
  if (!validateLangSmithConfig()) {
    console.error('❌ LangSmith 설정이 올바르지 않습니다')
    process.exit(1)
  }

  // 2. 클라이언트 생성
  console.log('🚀 LangSmith 클라이언트 생성...')
  const client = createLangSmithClient()

  // 3. 연결 테스트
  console.log('🔗 LangSmith 연결 테스트...')
  const isConnected = await checkLangSmithConnection(client)
  
  if (!isConnected) {
    console.error('❌ LangSmith 연결 실패')
    process.exit(1)
  }

  // 4. 샘플 메트릭 추적 테스트
  console.log('📊 샘플 메트릭 추적 테스트...')
  const sampleMetrics: RAGMetrics = {
    question: 'LangSmith 연결 테스트 질문입니다',
    retrievedDocsCount: 3,
    responseTimeMs: 1500,
    tokenUsage: 250,
    relevanceScore: 0.85,
    satisfactionScore: 4
  }

  try {
    await trackRAGMetrics(client, 'test-session-id', sampleMetrics)
    console.log('✅ 샘플 메트릭 추적 성공!')
  } catch (error) {
    console.error('❌ 샘플 메트릭 추적 실패:', error)
  }

  console.log('🎉 LangSmith 연결 테스트 완료!')
}

// 스크립트 실행
if (require.main === module) {
  testLangSmith()
    .then(() => {
      console.log('✅ 모든 LangSmith 테스트 통과!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 LangSmith 테스트 실패:', error)
      process.exit(1)
    })
}