/**
 * 세션 기반 API 실제 동작 테스트 스크립트
 * 데이터베이스 연동 및 API 기능 검증
 */

import dotenv from 'dotenv'
import path from 'path'
import { createDatabasePool, checkDatabaseConnection } from '../src/config/database'
import { ChatService } from '../src/services/chat/chat.service'

// 환경변수 로드
dotenv.config({ path: path.join(__dirname, '../env/.env.dev') })

async function testSessionAPI() {
  console.log('🧪 세션 API 테스트 시작...')
  
  // 1. 데이터베이스 연결 테스트
  console.log('\n1️⃣ 데이터베이스 연결 테스트')
  const pool = createDatabasePool()
  const isConnected = await checkDatabaseConnection(pool)
  
  if (!isConnected) {
    console.error('❌ 데이터베이스 연결 실패')
    process.exit(1)
  }
  
  // 2. ChatService 초기화
  console.log('\n2️⃣ ChatService 초기화')
  const trackingService = new ChatService(pool)
  console.log('✅ ChatService 초기화 완료')
  
  try {
    // 3. 새 세션 생성 테스트
    console.log('\n3️⃣ 새 세션 생성 테스트')
    const sessionId = await trackingService.createSession({
      storeId: 'test-store-script',
      userId: 'test-user-script',
      metadata: {
        testType: 'script-test',
        timestamp: new Date().toISOString(),
        userAgent: 'test-script/1.0'
      }
    })
    
    console.log('✅ 세션 생성 성공:', sessionId)
    
    // 4. 세션 정보 조회 테스트
    console.log('\n4️⃣ 세션 정보 조회 테스트')
    const sessionContext = await trackingService.getSessionContext(sessionId)
    console.log('✅ 세션 조회 성공:', {
      sessionId: sessionContext.session.id,
      storeId: sessionContext.session.store_id,
      userId: sessionContext.session.user_id,
      messageCount: sessionContext.recentMessages.length
    })
    
    // 5. 채팅 상호작용 로그 테스트
    console.log('\n5️⃣ 채팅 상호작용 로그 테스트')
    await trackingService.logChatInteraction({
      sessionId,
      userMessage: '스크립트 테스트 메시지입니다. 안녕하세요!',
      assistantResponse: '안녕하세요! 스크립트 테스트 응답입니다. 도움을 드릴까요?',
      tokenUsage: 25,
      responseTimeMs: 800,
      businessMetadata: {
        inquiryCategory: '스크립트테스트',
        priority: '보통',
        topicTags: ['테스트', '스크립트'],
        retrievedDocsCount: 2,
        relevanceScore: 0.75,
        satisfactionScore: 4
      }
    })
    
    console.log('✅ 채팅 상호작용 로그 저장 성공')
    
    // 6. 세션 통계 조회 테스트
    console.log('\n6️⃣ 세션 통계 조회 테스트')
    const stats = await trackingService.getSessionStats(sessionId)
    console.log('✅ 세션 통계 조회 성공:', {
      messageCount: stats.messageCount,
      totalTokens: stats.totalTokens,
      avgResponseTime: stats.avgResponseTime,
      lastActiveAt: stats.lastActiveAt
    })
    
    // 7. 업데이트된 세션 컨텍스트 확인
    console.log('\n7️⃣ 업데이트된 세션 컨텍스트 확인')
    const updatedContext = await trackingService.getSessionContext(sessionId, 10)
    console.log('✅ 메시지 저장 확인:', {
      sessionId,
      messageCount: updatedContext.recentMessages.length,
      messages: updatedContext.recentMessages.map(msg => ({
        role: msg.role,
        content: msg.content.substring(0, 30) + '...',
        sequenceNumber: msg.sequence_number
      }))
    })
    
    // 8. 다중 메시지 테스트 (대화 시뮬레이션)
    console.log('\n8️⃣ 다중 메시지 테스트')
    const conversations = [
      {
        user: '상품 배송은 언제 되나요?',
        assistant: '주문하신 상품은 영업일 기준 2-3일 내에 배송됩니다.',
        category: '배송문의'
      },
      {
        user: '환불은 어떻게 하나요?',
        assistant: '환불은 마이페이지에서 신청하시거나 고객센터로 연락주세요.',
        category: '환불문의'
      },
      {
        user: '감사합니다!',
        assistant: '도움이 되어 기쁩니다. 추가 문의사항이 있으시면 언제든 연락해주세요.',
        category: '감사인사'
      }
    ]
    
    for (const [index, conv] of conversations.entries()) {
      await trackingService.logChatInteraction({
        sessionId,
        userMessage: conv.user,
        assistantResponse: conv.assistant,
        tokenUsage: Math.floor(Math.random() * 30) + 10,
        responseTimeMs: Math.floor(Math.random() * 1000) + 500,
        businessMetadata: {
          inquiryCategory: conv.category,
          priority: '보통',
          retrievedDocsCount: Math.floor(Math.random() * 3) + 1,
          relevanceScore: Math.random() * 0.3 + 0.7
        }
      })
      
      console.log(`  ${index + 1}. ${conv.category} 대화 저장 완료`)
    }
    
    // 9. 최종 세션 통계 확인
    console.log('\n9️⃣ 최종 세션 통계 확인')
    const finalStats = await trackingService.getSessionStats(sessionId)
    console.log('✅ 최종 통계:', {
      총메시지수: finalStats.messageCount,
      총토큰수: finalStats.totalTokens,
      평균응답시간: Math.round(finalStats.avgResponseTime),
      마지막활동: finalStats.lastActiveAt
    })
    
    // 10. 정리 작업 (선택적)
    console.log('\n🔟 테스트 데이터 정리')
    const client = await pool.connect()
    try {
      // 테스트 메시지 삭제
      const deleteMessagesResult = await client.query(
        'DELETE FROM chat_messages WHERE session_id = $1',
        [sessionId]
      )
      
      // 테스트 세션 삭제
      const deleteSessionResult = await client.query(
        'DELETE FROM chat_sessions WHERE id = $1',
        [sessionId]
      )
      
      console.log('🧹 테스트 데이터 정리 완료:', {
        삭제된_메시지: deleteMessagesResult.rowCount,
        삭제된_세션: deleteSessionResult.rowCount
      })
    } finally {
      client.release()
    }
    
    console.log('\n🎉 모든 테스트 성공!')
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error)
    throw error
  } finally {
    await pool.end()
    console.log('🔌 데이터베이스 연결 종료')
  }
}

// 스크립트 실행
if (require.main === module) {
  testSessionAPI()
    .then(() => {
      console.log('\n✅ 세션 API 테스트 완료!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 세션 API 테스트 실패:', error)
      process.exit(1)
    })
}