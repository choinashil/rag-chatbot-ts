#!/usr/bin/env tsx
/**
 * 벡터 검색 디버깅 스크립트
 * 임계값 없이 벡터 검색을 수행하여 실제 유사도 점수를 확인
 */

import dotenv from 'dotenv'
import { EmbeddingService } from '../src/services/openai/embedding.service'
import { PineconeService } from '../src/services/pinecone/pinecone.service'
import { OpenAIClient } from '../src/services/openai/openai.client'
import { PineconeClient } from '../src/services/pinecone/pinecone.client'
import { createOpenAIConfig } from '../src/config/openai'
import { createPineconeConfig } from '../src/config/pinecone'

// 환경변수 로드
dotenv.config({ path: 'env/.env.integration' })

async function debugVectorSearch() {
  console.log('🔍 벡터 검색 디버깅 시작...')
  
  try {
    // 서비스 초기화
    console.log('\n1. 서비스 초기화 중...')
    const openaiConfig = createOpenAIConfig()
    const openaiClient = new OpenAIClient(openaiConfig)
    await openaiClient.initialize()
    const embeddingService = new EmbeddingService(openaiClient)

    const pineconeConfig = createPineconeConfig()
    const pineconeClient = new PineconeClient(pineconeConfig)
    const pineconeService = new PineconeService(pineconeClient)

    console.log('✅ 서비스 초기화 완료')

    // 현재 벡터 개수 확인
    const status = await pineconeClient.checkConnection()
    console.log(`📊 현재 벡터 개수: ${status.vectorCount}`)

    // 테스트 질문들
    const testQuestions = [
      '호두는 뭘 좋아하나요?',
      '호두',
      '좋아하는 것',
      '산책',
      '여자',
      '나이',
      '위로는 뭘 좋아하나요?'
    ]

    for (const question of testQuestions) {
      console.log(`\n🔍 질문: "${question}"`)
      
      // 임베딩 생성
      const embeddingResult = await embeddingService.createEmbedding(question)
      console.log(`임베딩 생성 완료: ${embeddingResult.tokenCount} 토큰`)

      // 임계값 없이 검색 (TOP_K=5)
      const searchResults = await pineconeService.query(
        embeddingResult.embedding,
        {
          topK: 5,
          scoreThreshold: 0.0 // 임계값 제거
        }
      )

      if (searchResults.length > 0) {
        console.log(`📋 검색 결과: ${searchResults.length}개`)
        searchResults.forEach((result, index) => {
          console.log(`  ${index + 1}. ID: ${result.id}`)
          console.log(`     제목: "${result.metadata.title}"`)
          console.log(`     유사도: ${result.score.toFixed(4)}`)
          console.log(`     내용: ${result.metadata.content.substring(0, 50)}...`)
        })
        
        // 기존 임계값(0.7)과 비교
        const highScoreResults = searchResults.filter(r => r.score >= 0.7)
        console.log(`📊 임계값 0.7 이상: ${highScoreResults.length}개`)
        
        const mediumScoreResults = searchResults.filter(r => r.score >= 0.5 && r.score < 0.7)
        console.log(`📊 임계값 0.5-0.7: ${mediumScoreResults.length}개`)
        
      } else {
        console.log('❌ 검색 결과 없음')
      }
    }

    console.log('\n🎉 벡터 검색 디버깅 완료!')

  } catch (error) {
    console.error('\n❌ 디버깅 실패:', error)
    process.exit(1)
  }
}

// 스크립트 실행
if (require.main === module) {
  debugVectorSearch()
}