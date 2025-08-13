#!/usr/bin/env tsx

/**
 * LangSmith RAG 통합 테스트
 * 실제 RAG 파이프라인에서 LangSmith 추적이 작동하는지 확인
 */

import dotenv from 'dotenv'
import path from 'path'

// 환경 변수 로드
dotenv.config({ path: path.resolve(process.cwd(), 'env/.env.dev') })

async function testLangSmithRAGIntegration() {
  console.log('🔍 LangSmith RAG 통합 테스트 시작...')

  try {
    // 간단한 채팅 API 호출 (LangSmith 추적 포함)
    console.log('💬 채팅 요청 중...')
    const response = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: '호두는 무엇을 좋아하나요?',
        storeId: 'test-store',
        userId: 'test-user'
      })
    })

    if (response.ok) {
      const data = await response.json()
      console.log('✅ RAG 요청 성공!')
      console.log('📊 응답:', {
        answerLength: data.answer?.length || 0,
        sourcesCount: data.sources?.length || 0,
        processingTime: data.metadata?.processingTime
      })
      
      console.log('🎉 LangSmith RAG 통합 테스트 완료!')
      console.log('💡 LangSmith 대시보드에서 추적 데이터를 확인하세요.')
      
    } else {
      console.error('❌ RAG 요청 실패:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('에러 내용:', errorText)
    }

  } catch (error) {
    console.error('❌ 테스트 실행 중 오류:', error)
  }
}

// 메인 실행
testLangSmithRAGIntegration()