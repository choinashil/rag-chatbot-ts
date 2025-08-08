#!/usr/bin/env tsx
// OpenAI API 실제 연동 테스트 스크립트
import dotenv from 'dotenv'
import { OpenAIClient } from '../../src/services/openai/openai.client'
import { createOpenAIConfig } from '../../src/config/openai'

// 환경변수 로드
dotenv.config({ path: 'env/.env.integration' })

async function testOpenAIIntegration() {
  console.log('🤖 OpenAI API 연동 테스트 시작...\n')

  try {
    // 1. 환경변수 확인
    console.log('1. 환경변수 확인:')
    const hasApiKey = !!process.env.OPENAI_API_KEY
    
    console.log(`   ✅ OPENAI_API_KEY: ${hasApiKey ? '설정됨' : '❌ 없음'}`)
    
    if (!hasApiKey) {
      console.log('\n❌ 필수 환경변수가 설정되지 않았습니다.')
      console.log('다음 환경변수를 env/.env.dev 파일에 추가해주세요:')
      console.log('OPENAI_API_KEY=sk-proj-your_api_key_here')
      return
    }

    // 2. OpenAI 클라이언트 초기화
    console.log('\n2. OpenAI 클라이언트 초기화...')
    const config = createOpenAIConfig()
    const openaiClient = new OpenAIClient(config)
    
    await openaiClient.initialize()
    console.log('   ✅ 초기화 성공!')

    // 3. 연결 상태 확인
    console.log('\n3. 연결 상태 확인:')
    const status = openaiClient.getStatus()
    console.log(`   연결 상태: ${status.connected ? '✅ 연결됨' : '❌ 연결 안됨'}`)
    console.log(`   마지막 확인: ${status.lastCheck}`)
    console.log(`   사용 가능한 모델 수: ${status.modelsAvailable.length}개`)
    if (status.metadata?.organization) {
      console.log(`   조직: ${status.metadata.organization}`)
    }
    console.log(`   현재 임베딩 모델: ${status.metadata?.currentModel}`)

    // 4. 사용 가능한 모델 목록 (처음 10개만)
    console.log('\n4. 사용 가능한 모델 목록 (처음 10개):')
    const displayModels = status.modelsAvailable.slice(0, 10)
    displayModels.forEach((model, index) => {
      const isEmbedding = model.includes('embedding')
      const isGPT = model.includes('gpt')
      const icon = isEmbedding ? '📊' : isGPT ? '💬' : '🔧'
      console.log(`   ${index + 1}. ${icon} ${model}`)
    })
    
    if (status.modelsAvailable.length > 10) {
      console.log(`   ... 그 외 ${status.modelsAvailable.length - 10}개 모델`)
    }

    // 5. 설정 정보 확인
    console.log('\n5. 설정 정보:')
    const clientConfig = openaiClient.getConfig()
    console.log(`   타임아웃: ${clientConfig.timeout}ms`)
    console.log(`   최대 재시도: ${clientConfig.maxRetries}회`)
    console.log(`   임베딩 모델: ${clientConfig.models.embedding}`)
    console.log(`   채팅 모델: ${clientConfig.models.chat}`)

    console.log('\n🎉 OpenAI API 연동 테스트 완료!')
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('API 키')) {
        console.log('\n💡 해결 방법:')
        console.log('1. OpenAI API 키가 올바른지 확인 (sk-proj-로 시작)')
        console.log('2. API 키에 충분한 권한이 있는지 확인')
      } else if (error.message.includes('연결')) {
        console.log('\n💡 해결 방법:')
        console.log('1. 인터넷 연결 상태 확인')
        console.log('2. OpenAI API 서비스 상태 확인')
        console.log('3. 방화벽/프록시 설정 확인')
      }
    }
  }
}

// 스크립트 실행
testOpenAIIntegration().catch(console.error)