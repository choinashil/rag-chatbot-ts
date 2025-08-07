#!/usr/bin/env tsx
// tiktoken vs 기존 방식 성능 비교 테스트

import { estimateTokenCount } from '../src/utils/token.utils'
import { EMBEDDING_LIMITS } from '../src/constants/embedding.constants'

// 기존 추정 방식 함수
function estimateTokenCountLegacy(text: string): number {
  if (!text || text.trim().length === 0) {
    return 0
  }
  
  const charCount = text.length
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length
  
  // 한국어 특성을 고려한 보수적 추정
  const estimatedByChars = charCount * 0.35 // 한국어는 토큰 밀도가 높음
  const estimatedByWords = wordCount * 1.5
  
  return Math.ceil(Math.max(estimatedByChars, estimatedByWords))
}

async function performanceTest() {
  console.log('⚡ tiktoken vs 기존 방식 성능 비교 테스트\n')

  // 다양한 길이의 한국어 테스트 텍스트
  const testTexts = {
    short: '안녕하세요. 간단한 테스트입니다.',
    medium: '안녕하세요. 저는 RAG 챗봇을 개발하고 있습니다. 벡터 데이터베이스를 사용하여 문서 검색을 구현하고 있어요. TypeScript와 Fastify를 사용하고 있습니다.',
    long: `
      RAG(Retrieval-Augmented Generation)는 정보 검색과 텍스트 생성을 결합한 인공지능 기술입니다.
      이 기술은 대규모 언어 모델(LLM)의 한계를 보완하기 위해 개발되었습니다.
      기존의 언어 모델은 훈련 데이터에만 의존하여 답변을 생성하기 때문에,
      최신 정보나 특정 도메인의 전문 지식에 대한 정확한 답변을 제공하기 어려웠습니다.
      RAG 시스템은 이러한 문제를 해결하기 위해 두 가지 주요 구성 요소를 결합합니다:
      1) 정보 검색(Retrieval) 시스템: 질문과 관련된 문서나 정보를 데이터베이스에서 검색
      2) 생성(Generation) 모델: 검색된 정보를 바탕으로 자연스럽고 정확한 답변 생성
      이 과정에서 벡터 임베딩이 핵심적인 역할을 합니다.
    `.trim().repeat(3), // 더 긴 텍스트
    veryLong: '이것은 매우 긴 한국어 텍스트입니다. 성능 테스트를 위해 반복됩니다. '.repeat(1000)
  }

  const iterations = 100 // 테스트 반복 횟수

  for (const [name, text] of Object.entries(testTexts)) {
    console.log(`\n📝 ${name.toUpperCase()} 텍스트 테스트 (${text.length}자)`)
    console.log('=' .repeat(60))

    // tiktoken 방식 성능 측정
    const tiktokenStart = performance.now()
    let tiktokenResult = 0
    for (let i = 0; i < iterations; i++) {
      tiktokenResult = estimateTokenCount(text)
    }
    const tiktokenEnd = performance.now()
    const tiktokenTime = tiktokenEnd - tiktokenStart

    // 기존 방식 성능 측정  
    const legacyStart = performance.now()
    let legacyResult = 0
    for (let i = 0; i < iterations; i++) {
      legacyResult = estimateTokenCountLegacy(text)
    }
    const legacyEnd = performance.now()
    const legacyTime = legacyEnd - legacyStart

    // 결과 출력
    console.log(`tiktoken 방식:`)
    console.log(`  - 토큰 수: ${tiktokenResult}`)
    console.log(`  - 총 시간: ${tiktokenTime.toFixed(2)}ms (${iterations}회)`)
    console.log(`  - 평균 시간: ${(tiktokenTime / iterations).toFixed(3)}ms/회`)

    console.log(`기존 방식:`)
    console.log(`  - 토큰 수: ${legacyResult}`) 
    console.log(`  - 총 시간: ${legacyTime.toFixed(2)}ms (${iterations}회)`)
    console.log(`  - 평균 시간: ${(legacyTime / iterations).toFixed(3)}ms/회`)

    console.log(`성능 비교:`)
    console.log(`  - 속도 차이: ${(tiktokenTime / legacyTime).toFixed(1)}배 느림`)
    console.log(`  - 정확도 차이: tiktoken ${tiktokenResult} vs 추정 ${legacyResult} (차이: ${Math.abs(tiktokenResult - legacyResult)})`)
    console.log(`  - 정확도 오차: ${(Math.abs(tiktokenResult - legacyResult) / tiktokenResult * 100).toFixed(1)}%`)
  }

  // 메모리 사용량 체크
  console.log('\n💾 메모리 사용량 비교')
  console.log('=' .repeat(60))
  
  const beforeMemory = process.memoryUsage()
  
  // tiktoken 대량 사용
  for (let i = 0; i < 1000; i++) {
    estimateTokenCount(testTexts.medium)
  }
  
  const afterTiktokenMemory = process.memoryUsage()
  
  // 기존 방식 대량 사용
  for (let i = 0; i < 1000; i++) {
    estimateTokenCountLegacy(testTexts.medium)
  }
  
  const afterLegacyMemory = process.memoryUsage()

  console.log(`초기 메모리: ${(beforeMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)
  console.log(`tiktoken 후: ${(afterTiktokenMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)  
  console.log(`기존 방식 후: ${(afterLegacyMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`)

  // 권장사항
  console.log('\n🎯 권장사항')
  console.log('=' .repeat(60))
  console.log('성능 우선 (실시간 처리, 대량 텍스트): 기존 추정 방식')
  console.log('정확도 우선 (배치 처리, 정밀한 토큰 계산): tiktoken')
  console.log('혼합 방식: 짧은 텍스트는 기존 방식, 긴 텍스트는 tiktoken')
}

performanceTest().catch(console.error)