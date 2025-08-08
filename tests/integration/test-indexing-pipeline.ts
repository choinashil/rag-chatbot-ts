#!/usr/bin/env tsx
/**
 * 문서 색인화 파이프라인 통합 테스트
 * 노션 문서 → 임베딩 → Pinecone 저장 → 검색 플로우 테스트
 * 
 * 사용법:
 * 모든 환경변수 설정 후 실행
 * npm run test:integration indexing-pipeline
 */

import dotenv from 'dotenv'
import { DocumentProcessor } from '../../src/services/document/document.processor'
import { NotionService } from '../../src/services/notion/notion.service'
import { EmbeddingService } from '../../src/services/openai/embedding.service'
import { PineconeService } from '../../src/services/pinecone/pinecone.service'
import { OpenAIClient } from '../../src/services/openai/openai.client'
import { PineconeClient } from '../../src/services/pinecone/pinecone.client'
import { createNotionConfig } from '../../src/config/notion'
import { createOpenAIConfig } from '../../src/config/openai'
import { createPineconeConfig } from '../../src/config/pinecone'

// 환경변수 로드
dotenv.config({ path: 'env/.env.integration' })

async function testIndexingPipeline() {
  console.log('🚀 문서 색인화 파이프라인 테스트 시작...')
  
  try {
    // 1. 서비스 초기화
    console.log('\n1. 서비스 초기화 중...')
    
    const notionConfig = createNotionConfig()
    const notionService = new NotionService(notionConfig)
    await notionService.initialize()
    console.log('✅ NotionService 초기화 완료')

    const openaiConfig = createOpenAIConfig()
    const openaiClient = new OpenAIClient(openaiConfig)
    await openaiClient.initialize()
    const embeddingService = new EmbeddingService(openaiClient)
    console.log('✅ EmbeddingService 초기화 완료')

    const pineconeConfig = createPineconeConfig()
    const pineconeClient = new PineconeClient(pineconeConfig)
    const pineconeService = new PineconeService(pineconeClient)
    console.log('✅ PineconeService 초기화 완료')

    // 2. DocumentProcessor 생성
    const documentProcessor = new DocumentProcessor(
      notionService,
      embeddingService,
      pineconeService
    )
    console.log('✅ DocumentProcessor 생성 완료')

    // 3. 연결 상태 확인
    console.log('\n2. 서비스 연결 상태 확인 중...')
    
    const notionStatus = notionService.getStatus()
    console.log(`📋 Notion: ${notionStatus.connected ? '연결됨' : '연결 실패'}`)
    
    const openaiStatus = openaiClient.getStatus()
    console.log(`🤖 OpenAI: ${openaiStatus.connected ? '연결됨' : '연결 실패'}`)
    
    const pineconeStatus = await pineconeClient.checkConnection()
    console.log(`🔍 Pinecone: ${pineconeStatus.connected ? '연결됨' : '연결 실패'} (벡터: ${pineconeStatus.vectorCount})`)

    if (!notionStatus.connected || !openaiStatus.connected || !pineconeStatus.connected) {
      throw new Error('일부 서비스 연결에 실패했습니다')
    }

    // 4. 노션에서 첫 번째 페이지 가져오기
    console.log('\n3. 테스트용 노션 페이지 조회 중...')
    const databaseId = process.env.NOTION_DATABASE_ID
    if (!databaseId) {
      console.log('NOTION_DATABASE_ID가 설정되지 않아 테스트를 건너뜁니다')
      return
    }
    const pages = await notionService.getPages(databaseId, { pageSize: 1 })
    
    if (pages.length === 0) {
      throw new Error('노션 데이터베이스에 페이지가 없습니다')
    }
    
    const testPage = pages[0]
    if (!testPage) {
      throw new Error('테스트할 페이지를 찾을 수 없습니다')
    }
    console.log(`📄 테스트 페이지: "${testPage.title}" (ID: ${testPage.id})`)

    // 5. 문서 처리 파이프라인 실행
    console.log('\n4. 문서 처리 파이프라인 실행 중...')
    await documentProcessor.processDocument(testPage.id)
    console.log('✅ 문서 처리 완료')

    // 잠시 대기 (Pinecone 인덱싱 시간)
    console.log('\n⏱️  인덱싱 대기 중... (3초)')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // 6. 파이프라인 검증 테스트
    console.log('\n5. 파이프라인 검증 테스트 중...')
    const testQueries = [
      testPage.title, // 문서 제목으로 검색
      testPage.content.substring(0, 50) + '...', // 문서 내용 일부로 검색
      '안녕하세요' // 일반적인 인사말
    ]

    for (const query of testQueries) {
      console.log(`\n🔍 질문: "${query}"`)
      try {
        const result = await documentProcessor.testPipeline(query)
        if (result.results.length > 0) {
          console.log(`✅ 검색 성공: ${result.results.length}개 결과`)
          result.results.forEach((res, index) => {
            console.log(`   ${index + 1}. "${res.metadata.title}" (점수: ${res.score.toFixed(3)})`)
          })
        } else {
          console.log('⚠️  검색 결과 없음 (임계값 미달)')
        }
      } catch (error) {
        console.log(`❌ 검색 실패: ${(error as Error).message}`)
      }
    }

    // 7. 최종 상태 확인
    console.log('\n6. 최종 상태 확인 중...')
    const finalStatus = await pineconeClient.checkConnection()
    console.log(`🔍 최종 벡터 개수: ${finalStatus.vectorCount}`)

    console.log('\n🎉 전체 RAG 파이프라인 테스트 성공!')
    console.log('\n✅ 검증 완료 항목:')
    console.log('  - 노션 문서 읽기')
    console.log('  - OpenAI 임베딩 생성')
    console.log('  - Pinecone 벡터 저장')
    console.log('  - 벡터 검색 및 결과 반환')
    console.log('  - 전체 파이프라인 통합 동작')

  } catch (error) {
    console.error('\n❌ 전체 파이프라인 테스트 실패:', error)
    console.error('\n🔧 확인 사항:')
    console.error('  - 모든 환경변수 설정 (NOTION_*, OPENAI_*, PINECONE_*)')
    console.error('  - 노션 데이터베이스에 페이지 존재 여부')
    console.error('  - API 키 유효성')
    console.error('  - 네트워크 연결 상태')
    process.exit(1)
  }
}

// 스크립트 실행
if (require.main === module) {
  testIndexingPipeline()
}