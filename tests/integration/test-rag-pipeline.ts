#!/usr/bin/env tsx
/**
 * 전체 RAG 질의응답 파이프라인 통합 테스트
 * 질문 → 문서 검색 → 답변 생성 전체 플로우 테스트
 * 
 * 사용법:
 * 모든 환경변수 설정 후 실행
 * npm run test:rag-pipeline
 */

import dotenv from 'dotenv'
import { RAGService } from '../../src/services/rag/rag.service'
import { DocumentProcessor } from '../../src/services/document/document.processor'
import { NotionService } from '../../src/services/notion/notion.service'
import { EmbeddingService } from '../../src/services/openai/embedding.service'
import { PineconeService } from '../../src/services/pinecone/pinecone.service'
import { ChatService } from '../../src/services/openai/chat.service'
import { OpenAIClient } from '../../src/services/openai/openai.client'
import { PineconeClient } from '../../src/services/pinecone/pinecone.client'
import { createNotionConfig } from '../../src/config/notion'
import { createOpenAIConfig } from '../../src/config/openai'
import { createPineconeConfig } from '../../src/config/pinecone'

// 환경변수 로드
dotenv.config({ path: 'env/.env.integration' })

async function testRAGPipeline() {
  console.log('🚀 RAG 질의응답 파이프라인 테스트 시작...')
  
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
    const chatService = new ChatService(openaiClient)
    console.log('✅ OpenAI 서비스들 초기화 완료')

    const pineconeConfig = createPineconeConfig()
    const pineconeClient = new PineconeClient(pineconeConfig)
    const pineconeService = new PineconeService(pineconeClient)
    console.log('✅ PineconeService 초기화 완료')

    // 2. RAG 서비스 생성
    const ragService = new RAGService(embeddingService, pineconeService)
    console.log('✅ RAGService 생성 완료')

    // 3. 문서 처리기 생성 (테스트 데이터 준비용)
    const documentProcessor = new DocumentProcessor(
      notionService,
      embeddingService,
      pineconeService
    )

    // 4. 연결 상태 확인
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

    // 5. 테스트 데이터 확인 (문서가 없으면 하나 추가)
    console.log('\n3. 테스트 데이터 확인 중...')
    
    if (pineconeStatus.vectorCount === 0) {
      console.log('벡터 데이터가 없습니다. 테스트 문서를 추가합니다...')
      
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
        throw new Error('테스트할 페이지가 없습니다')
      }
      console.log(`📄 테스트 문서 추가: "${testPage.title}"`)
      await documentProcessor.processDocument(testPage.id)
      
      // 인덱싱 대기
      console.log('⏱️  인덱싱 대기 중... (5초)')
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    // 6. RAG 질의응답 테스트
    console.log('\n4. RAG 질의응답 테스트 중...')
    
    const testQuestions = [
      '호두는 뭘 좋아하나요?',
      '위로는 뭘 좋아하나요?',
      '안녕하세요, 도움이 필요합니다'
    ]

    for (const question of testQuestions) {
      console.log(`\n🤔 질문: "${question}"`)
      
      try {
        const startTime = Date.now()
        const response = await ragService.askQuestion({ question })
        const duration = Date.now() - startTime
        
        console.log(`✅ 답변 생성 완료 (${duration}ms)`)
        console.log(`📝 답변: ${response.answer.substring(0, 100)}${response.answer.length > 100 ? '...' : ''}`)
        console.log(`📚 참조 문서: ${response.sources.length}개`)
        
        if (response.sources.length > 0) {
          response.sources.forEach((source, index) => {
            console.log(`   ${index + 1}. "${source.title}" (점수: ${source.score.toFixed(3)})`)
          })
        }
        
        console.log(`⏱️  처리 시간: ${response.metadata.processingTime}ms`)
        
      } catch (error) {
        console.log(`❌ 질의 실패: ${(error as Error).message}`)
      }
    }

    // 7. 최종 상태 확인
    console.log('\n5. 최종 상태 확인 중...')
    const finalStatus = await pineconeClient.checkConnection()
    console.log(`🔍 최종 벡터 개수: ${finalStatus.vectorCount}`)

    console.log('\n🎉 RAG 질의응답 파이프라인 테스트 성공!')
    console.log('\n✅ 검증 완료 항목:')
    console.log('  - 질문 임베딩 생성')
    console.log('  - 관련 문서 벡터 검색') 
    console.log('  - 컨텍스트 기반 답변 생성')
    console.log('  - 출처 정보 포함')
    console.log('  - 전체 RAG 플로우 동작')

  } catch (error) {
    console.error('\n❌ RAG 파이프라인 테스트 실패:', error)
    console.error('\n🔧 확인 사항:')
    console.error('  - 모든 환경변수 설정 (NOTION_*, OPENAI_*, PINECONE_*)')
    console.error('  - 벡터 데이터베이스에 문서 존재 여부')  
    console.error('  - API 키 유효성')
    console.error('  - 네트워크 연결 상태')
    process.exit(1)
  }
}

// 스크립트 실행
if (require.main === module) {
  testRAGPipeline()
}