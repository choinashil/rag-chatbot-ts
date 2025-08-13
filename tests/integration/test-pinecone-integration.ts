#!/usr/bin/env tsx
/**
 * Pinecone 통합 테스트 스크립트
 * 실제 Pinecone API와 통신하여 기본 벡터 작업을 테스트
 * 
 * 사용법:
 * PINECONE_API_KEY와 PINECONE_INDEX_NAME 환경변수 설정 후 실행
 * npm run test:pinecone-integration
 */

import dotenv from 'dotenv'
import { PineconeService } from '../../src/services/vector/pinecone.service'
import { PineconeClient } from '../../src/services/vector/pinecone.client'
import { EmbeddingService } from '../../src/services/openai/embedding.service'
import { OpenAIClient } from '../../src/services/openai/openai.client'
import { createPineconeConfig } from '../../src/config/pinecone'
import { createOpenAIConfig } from '../../src/config/openai'
import type { VectorData } from '../../src/types/pinecone'

// 환경변수 로드
dotenv.config({ path: 'env/.env.integration' })

async function testPineconeIntegration() {
  console.log('🔄 Pinecone 통합 테스트 시작...')
  
  try {
    // 1. 서비스 초기화
    console.log('\\n1. 서비스 초기화 중...')
    const pineconeConfig = createPineconeConfig()
    const pineconeClient = new PineconeClient(pineconeConfig)
    const pineconeService = new PineconeService(pineconeClient)
    
    const openaiConfig = createOpenAIConfig()
    const openaiClient = new OpenAIClient(openaiConfig)
    await openaiClient.initialize()
    const embeddingService = new EmbeddingService(openaiClient)
    
    console.log(`✅ Pinecone 인덱스: ${pineconeConfig.indexName}`)
    console.log('✅ OpenAI 임베딩 서비스 초기화 완료')

    // 2. 연결 상태 확인
    console.log('\\n2. 연결 상태 확인 중...')
    const connectionStatus = await pineconeClient.checkConnection()
    if (!connectionStatus.connected) {
      throw new Error(`Pinecone 연결 실패: ${connectionStatus.error}`)
    }
    console.log(`✅ Pinecone 연결 성공 - 벡터 개수: ${connectionStatus.vectorCount}`)

    // 3. 테스트 임베딩 생성
    console.log('\\n3. 테스트 임베딩 생성 중...')
    const testText = 'RAG 챗봇 테스트 문서입니다. Pinecone과 OpenAI 연동을 확인합니다.'
    const embeddingResult = await embeddingService.createEmbedding(testText, 'pinecone-test-doc')
    console.log(`✅ 임베딩 생성 완료 - 차원: ${embeddingResult.embedding.length}`)

    // 4. 벡터 데이터 준비
    console.log('\\n4. 테스트 벡터 데이터 준비 중...')
    const testId = `test-doc-${Date.now()}`
    const vectorData: VectorData = {
      id: testId,
      vector: embeddingResult.embedding,
      metadata: {
        title: 'Pinecone 통합 테스트 문서',
        content: testText,
        source: 'integration-test',
        timestamp: new Date().toISOString()
      }
    }
    console.log(`✅ 테스트 문서 ID: ${testId}`)

    // 5. 벡터 업서트 테스트
    console.log('\\n5. 벡터 저장 테스트 중...')
    await pineconeService.upsert(vectorData)
    console.log('✅ 벡터 저장 완료')
    
    // 잠시 대기 (인덱싱 시간)
    console.log('⏱️  인덱싱 대기 중... (3초)')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 6. 벡터 검색 테스트
    console.log('\\n6. 벡터 검색 테스트 중...')
    const searchResults = await pineconeService.query(embeddingResult.embedding, {
      topK: 3,
      scoreThreshold: 0.7
    })
    
    console.log(`✅ 검색 결과: ${searchResults.length}개`)
    searchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ID: ${result.id}, 점수: ${result.score.toFixed(4)}`)
      console.log(`     제목: ${result.metadata.title}`)
    })

    // 7. 벡터 삭제 테스트
    console.log('\\n7. 테스트 벡터 삭제 중...')
    await pineconeService.deleteDocument(testId)
    console.log('✅ 테스트 벡터 삭제 완료')

    // 8. 최종 상태 확인
    console.log('\\n8. 최종 상태 확인 중...')
    const finalStatus = await pineconeClient.checkConnection()
    console.log(`✅ 최종 벡터 개수: ${finalStatus.vectorCount}`)

    console.log('\\n🎉 Pinecone 통합 테스트 성공!')
    console.log('\\n✅ 테스트 완료 항목:')
    console.log('  - Pinecone 연결 및 상태 확인')
    console.log('  - OpenAI 임베딩 생성')
    console.log('  - 벡터 저장 (upsert)')
    console.log('  - 벡터 검색 (query)')
    console.log('  - 벡터 삭제 (delete)')

  } catch (error) {
    console.error('\\n❌ Pinecone 통합 테스트 실패:', error)
    console.error('\\n🔧 확인 사항:')
    console.error('  - PINECONE_API_KEY 환경변수 설정')
    console.error('  - PINECONE_INDEX_NAME 환경변수 설정') 
    console.error('  - OPENAI_API_KEY 환경변수 설정')
    console.error('  - Pinecone 인덱스 존재 여부')
    console.error('  - 네트워크 연결 상태')
    process.exit(1)
  }
}

// 스크립트 실행
if (require.main === module) {
  testPineconeIntegration()
}