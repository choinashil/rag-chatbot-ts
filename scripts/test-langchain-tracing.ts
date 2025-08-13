#!/usr/bin/env tsx

/**
 * LangChain의 LangSmith 자동 추적 테스트
 * LANGCHAIN_TRACING_V2=true 환경에서 LangChain 구성 요소가 제대로 추적되는지 확인
 */

import dotenv from 'dotenv'
import path from 'path'
import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'

// 환경 변수 로드
dotenv.config({ path: path.resolve(process.cwd(), 'env/.env.dev') })

async function testLangChainTracing() {
  console.log('🔍 LangChain LangSmith 자동 추적 테스트 시작...')
  
  // 환경 변수 확인
  console.log('📋 LangChain 추적 환경 변수:')
  console.log('- LANGCHAIN_TRACING_V2:', process.env.LANGCHAIN_TRACING_V2)
  console.log('- LANGCHAIN_API_KEY:', process.env.LANGCHAIN_API_KEY ? '***설정됨***' : '미설정')
  console.log('- LANGCHAIN_PROJECT:', process.env.LANGCHAIN_PROJECT)
  console.log('')

  try {
    // LangChain 모델 생성
    const chatModel = new ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0.1,
      apiKey: process.env.OPENAI_API_KEY!
    })

    // 간단한 프롬프트 템플릿
    const prompt = PromptTemplate.fromTemplate(`
다음 질문에 간단히 답변해주세요:
질문: {question}
답변:`)

    // RunnableSequence로 체인 구성
    const chain = RunnableSequence.from([
      prompt,
      chatModel,
      new StringOutputParser()
    ])

    console.log('🧪 LangChain 체인 실행 중...')
    console.log('(LangSmith 추적이 활성화되어 있다면 자동으로 기록됩니다)')
    
    // 체인 실행
    const result = await chain.invoke({
      question: "안녕하세요, LangSmith 추적 테스트입니다 333"
    })

    console.log('✅ LangChain 체인 실행 완료!')
    console.log('📝 응답:', result.substring(0, 100) + '...')
    console.log('')
    console.log('🎯 LangSmith 대시보드 확인:')
    console.log('- 프로젝트:', process.env.LANGCHAIN_PROJECT)
    console.log('- URL: https://smith.langchain.com/')
    console.log('- 위 대시보드에서 방금 실행한 체인의 추적 데이터를 확인하세요!')

  } catch (error) {
    console.error('❌ LangChain 추적 테스트 실패:', error)
  }
}

// 메인 실행
testLangChainTracing()