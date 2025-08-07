#!/usr/bin/env tsx
// 임베딩 서비스 실제 연동 테스트 스크립트
import dotenv from 'dotenv'
import { OpenAIClient } from '../src/services/openai/openai.client'
import { EmbeddingService } from '../src/services/openai/embedding.service'
import { createOpenAIConfig } from '../src/config/openai'

// 환경변수 로드
dotenv.config({ path: 'env/.env.dev' })

async function testEmbeddingIntegration() {
  console.log('🔢 임베딩 서비스 연동 테스트 시작...\n')

  try {
    // 1. OpenAI 클라이언트 초기화
    console.log('1. OpenAI 클라이언트 초기화...')
    const config = createOpenAIConfig()
    const openaiClient = new OpenAIClient(config)
    await openaiClient.initialize()
    console.log('   ✅ OpenAI 클라이언트 초기화 완료')

    // 2. 임베딩 서비스 생성
    console.log('\n2. 임베딩 서비스 생성...')
    const embeddingService = new EmbeddingService(openaiClient)
    console.log('   ✅ 임베딩 서비스 생성 완료')

    // 3. 단일 텍스트 임베딩 테스트
    console.log('\n3. 단일 텍스트 임베딩 생성 테스트...')
    const singleText = 'TypeScript는 JavaScript의 상위집합으로, 정적 타입을 지원하는 프로그래밍 언어입니다.'
    console.log(`   입력 텍스트: "${singleText}"`)
    
    const singleResult = await embeddingService.createEmbedding({
      text: singleText,
      id: 'test-single'
    })
    
    console.log(`   ✅ 임베딩 생성 성공!`)
    console.log(`   - 벡터 차원: ${singleResult.embedding.length}`)
    console.log(`   - 사용 토큰: ${singleResult.tokenCount}`)
    console.log(`   - 모델: ${singleResult.model}`)
    console.log(`   - 벡터 샘플: [${singleResult.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)

    // 4. 캐시 테스트 (같은 텍스트 재요청)
    console.log('\n4. 캐시 기능 테스트...')
    const startTime = Date.now()
    const cachedResult = await embeddingService.createEmbedding({
      text: singleText,
      id: 'test-cached'
    })
    const endTime = Date.now()
    
    console.log(`   ✅ 캐시에서 임베딩 반환 (${endTime - startTime}ms)`)
    console.log(`   - 동일한 벡터인지 확인: ${JSON.stringify(cachedResult.embedding) === JSON.stringify(singleResult.embedding) ? '✅ 동일' : '❌ 다름'}`)

    // 5. 배치 임베딩 테스트
    console.log('\n5. 배치 임베딩 생성 테스트...')
    const batchTexts = [
      { text: 'React는 사용자 인터페이스를 만들기 위한 JavaScript 라이브러리입니다.', id: 'react' },
      { text: 'Next.js는 React 기반의 풀스택 웹 애플리케이션 프레임워크입니다.', id: 'nextjs' },
      { text: 'Fastify는 Node.js를 위한 빠르고 효율적인 웹 프레임워크입니다.', id: 'fastify' }
    ]
    
    console.log(`   ${batchTexts.length}개 텍스트 배치 처리...`)
    const batchResult = await embeddingService.createBatchEmbeddings({ texts: batchTexts })
    
    console.log(`   ✅ 배치 임베딩 완료!`)
    console.log(`   - 성공: ${batchResult.results.length}개`)
    console.log(`   - 실패: ${batchResult.errors.length}개`)
    console.log(`   - 총 토큰: ${batchResult.totalTokens}`)
    console.log(`   - 요청 횟수: ${batchResult.requestCount}`)

    // 6. 긴 텍스트 처리 테스트
    console.log('\n6. 긴 텍스트 청크 분할 테스트...')
    const longText = `
      RAG(Retrieval-Augmented Generation)는 정보 검색과 텍스트 생성을 결합한 인공지능 기술입니다. 
      이 기술은 대규모 언어 모델(LLM)의 한계를 보완하기 위해 개발되었습니다. 
      기존의 언어 모델은 훈련 데이터에만 의존하여 답변을 생성하기 때문에, 
      최신 정보나 특정 도메인의 전문 지식에 대한 정확한 답변을 제공하기 어려웠습니다.
      
      RAG 시스템은 이러한 문제를 해결하기 위해 두 가지 주요 구성 요소를 결합합니다:
      1) 정보 검색(Retrieval) 시스템: 질문과 관련된 문서나 정보를 데이터베이스에서 검색
      2) 생성(Generation) 모델: 검색된 정보를 바탕으로 자연스럽고 정확한 답변 생성
      
      이 과정에서 벡터 임베딩이 핵심적인 역할을 합니다. 모든 문서는 고차원 벡터로 변환되어 저장되고,
      사용자의 질문도 같은 방식으로 벡터화하여 유사도를 계산합니다.
    `.trim()
    
    console.log(`   긴 텍스트 길이: ${longText.length}자`)
    const longTextResults = await embeddingService.createEmbeddingForLongText(longText, 'long-text-test')
    
    console.log(`   ✅ 긴 텍스트 처리 완료!`)
    console.log(`   - 생성된 청크 수: ${longTextResults.length}`)
    longTextResults.forEach((result, index) => {
      console.log(`   - 청크 ${index + 1}: ${result.tokenCount}토큰, ID: ${result.id}`)
    })

    // 7. 사용량 정보 확인
    console.log('\n7. 사용량 정보...')
    const usage = embeddingService.getUsage()
    console.log(`   - 총 요청: ${usage.requestCount}회`)
    console.log(`   - 총 토큰: ${usage.totalTokens.toLocaleString()}개`)
    console.log(`   - 예상 비용: $${usage.estimatedCost.toFixed(6)}`)
    console.log(`   - 마지막 업데이트: ${usage.timestamp.toLocaleString()}`)

    // 8. 캐시 통계
    console.log('\n8. 캐시 통계...')
    const cacheStats = embeddingService.getCacheStats()
    console.log(`   - 캐시 항목 수: ${cacheStats.size}`)
    console.log(`   - 최대 캐시 크기: ${cacheStats.maxSize}`)

    // 9. 벡터 유사도 비교 테스트
    console.log('\n9. 벡터 유사도 비교 테스트...')
    const text1 = 'JavaScript는 웹 개발을 위한 프로그래밍 언어입니다.'
    const text2 = 'TypeScript는 JavaScript의 확장된 프로그래밍 언어입니다.'
    const text3 = '오늘 날씨가 정말 좋습니다.'

    const embedding1 = await embeddingService.createEmbedding({ text: text1, id: 'js' })
    const embedding2 = await embeddingService.createEmbedding({ text: text2, id: 'ts' })
    const embedding3 = await embeddingService.createEmbedding({ text: text3, id: 'weather' })

    // 코사인 유사도 계산
    const similarity12 = cosineSimilarity(embedding1.embedding, embedding2.embedding)
    const similarity13 = cosineSimilarity(embedding1.embedding, embedding3.embedding)
    const similarity23 = cosineSimilarity(embedding2.embedding, embedding3.embedding)

    console.log(`   JavaScript vs TypeScript 유사도: ${similarity12.toFixed(4)} (높아야 함)`)
    console.log(`   JavaScript vs 날씨 유사도: ${similarity13.toFixed(4)} (낮아야 함)`)
    console.log(`   TypeScript vs 날씨 유사도: ${similarity23.toFixed(4)} (낮아야 함)`)

    if (similarity12 > 0.8) {
      console.log(`   ✅ JavaScript와 TypeScript가 높은 유사도를 보입니다!`)
    }
    if (similarity13 < 0.5 && similarity23 < 0.5) {
      console.log(`   ✅ 관련 없는 텍스트들이 낮은 유사도를 보입니다!`)
    }

    console.log('\n🎉 임베딩 서비스 연동 테스트 완료!')
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('API 키')) {
        console.log('\n💡 해결 방법:')
        console.log('1. OPENAI_API_KEY 환경변수가 올바르게 설정되어 있는지 확인')
        console.log('2. API 키가 유효하고 충분한 권한이 있는지 확인')
      } else if (error.message.includes('토큰 제한')) {
        console.log('\n💡 해결 방법:')
        console.log('1. 입력 텍스트 길이를 줄여보세요')
        console.log('2. 텍스트 분할 기능이 올바르게 작동하는지 확인')
      }
    }
  }
}

// 코사인 유사도 계산 헬퍼 함수
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('벡터 차원이 일치하지 않습니다')
  }

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0
  }

  return dotProduct / (magnitudeA * magnitudeB)
}

// 스크립트 실행
testEmbeddingIntegration().catch(console.error)