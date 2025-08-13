#!/usr/bin/env tsx

/**
 * LangSmith 직접 사용 테스트
 * LANGSMITH_* 환경 변수로 직접 추적
 */

import dotenv from 'dotenv'
import path from 'path'
import { traceable } from 'langsmith/traceable'
import OpenAI from 'openai'

// 환경 변수 로드
dotenv.config({ path: path.resolve(process.cwd(), 'env/.env.dev') })

async function testLangSmithDirect() {
  console.log('🔍 LangSmith 직접 사용 테스트 시작...')
  
  // 환경 변수 확인
  console.log('📋 LangSmith 직접 사용 환경 변수:')
  console.log('- LANGSMITH_TRACING:', process.env.LANGSMITH_TRACING)
  console.log('- LANGSMITH_API_KEY:', process.env.LANGSMITH_API_KEY ? '***설정됨***' : '미설정')
  console.log('- LANGSMITH_PROJECT_NAME:', process.env.LANGSMITH_PROJECT_NAME)
  console.log('')

  try {
    // OpenAI 클라이언트 (LangChain 없이)
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    // @traceable로 함수 래핑
    const directLLMCall = traceable(
      async (question: string) => {
        const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: question }],
          temperature: 0.1
        })
        return response.choices[0].message.content
      },
      { name: 'direct_openai_call', run_type: 'llm' }
    )

    console.log('🧪 LangSmith 직접 추적 실행 중...')
    const result = await directLLMCall("LangSmith 직접 사용 테스트입니다")
    
    console.log('✅ LangSmith 직접 사용 완료!')
    console.log('📝 응답:', result?.substring(0, 100) + '...')
    console.log('')
    console.log('🎯 LangSmith 대시보드에서 "direct_openai_call" 추적을 확인하세요!')

  } catch (error) {
    console.error('❌ LangSmith 직접 사용 실패:', error)
  }
}

testLangSmithDirect()