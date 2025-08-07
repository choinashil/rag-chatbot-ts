#!/usr/bin/env tsx
// tiktoken 정확성 테스트 스크립트

import { estimateTokenCount } from '../src/utils/token.utils'

async function testTiktoken() {
  console.log('🔢 tiktoken 정확성 테스트 시작...\n')

  // 테스트 텍스트들 (한국어 위주)
  const testTexts = [
    '안녕하세요',
    '이것은 한국어 테스트입니다.',
    'TypeScript는 JavaScript의 상위집합으로, 정적 타입을 지원하는 프로그래밍 언어입니다.',
    '안녕하세요. 저는 RAG 챗봇을 개발하고 있습니다. 벡터 데이터베이스를 사용하여 문서 검색을 구현하고 있어요.',
    `
    RAG(Retrieval-Augmented Generation)는 정보 검색과 텍스트 생성을 결합한 인공지능 기술입니다.
    이 기술은 대규모 언어 모델(LLM)의 한계를 보완하기 위해 개발되었습니다.
    기존의 언어 모델은 훈련 데이터에만 의존하여 답변을 생성하기 때문에,
    최신 정보나 특정 도메인의 전문 지식에 대한 정확한 답변을 제공하기 어려웠습니다.
    `.trim(),
    'Hello world! This is an English test sentence.',
    '混在テキスト mixing Korean 한국어 and Japanese 日本語 with English.',
  ]

  console.log('텍스트별 토큰 수 계산 결과:')
  console.log('=' .repeat(80))

  testTexts.forEach((text, index) => {
    const tokenCount = estimateTokenCount(text)
    const charCount = text.length
    const wordsCount = text.split(/\s+/).length
    const tokensPerChar = (tokenCount / charCount).toFixed(3)

    console.log(`\n${index + 1}. 텍스트: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`)
    console.log(`   - 문자 수: ${charCount}`)
    console.log(`   - 단어 수: ${wordsCount}`) 
    console.log(`   - 토큰 수: ${tokenCount}`)
    console.log(`   - 토큰/문자 비율: ${tokensPerChar}`)
  })

  console.log('\n' + '='.repeat(80))
  console.log('📊 분석 결과:')
  
  // 한국어와 영어 비교
  const koreanText = '안녕하세요. 저는 RAG 챗봇을 개발하고 있습니다. 벡터 데이터베이스를 사용하여 문서 검색을 구현하고 있어요.'
  const englishText = 'Hello. I am developing a RAG chatbot. I am implementing document search using a vector database.'
  
  const koreanTokens = estimateTokenCount(koreanText)
  const englishTokens = estimateTokenCount(englishText)
  
  console.log(`\n한국어 텍스트 (${koreanText.length}자): ${koreanTokens} 토큰`)
  console.log(`영어 텍스트 (${englishText.length}자): ${englishTokens} 토큰`)
  console.log(`토큰 효율성 비교: 한국어 ${(koreanTokens/koreanText.length).toFixed(3)} vs 영어 ${(englishTokens/englishText.length).toFixed(3)}`)

  // 토큰 제한 테스트
  console.log('\n📏 토큰 제한 테스트:')
  const longText = '이것은 긴 한국어 텍스트입니다. '.repeat(1000)
  const longTokens = estimateTokenCount(longText)
  console.log(`긴 텍스트 (${longText.length}자): ${longTokens.toLocaleString()} 토큰`)
  console.log(`8191 토큰 제한 ${longTokens > 8191 ? '초과' : '이내'}`)

  console.log('\n✅ tiktoken 테스트 완료!')
}

testTiktoken().catch(console.error)