/**
 * 세션 기반 API 실제 서버 통합 테스트
 * 서버 시작 후 실제 HTTP 요청으로 API 검증
 */

import dotenv from 'dotenv'
import path from 'path'
import { FastifyInstance } from 'fastify'
import { buildApp } from '../src/server'

// 환경변수 로드
dotenv.config({ path: path.join(__dirname, '../env/.env.dev') })

interface TestResult {
  name: string
  success: boolean
  error?: string
  data?: any
}

async function testSessionIntegration() {
  console.log('🧪 세션 기반 API 통합 테스트 시작...')
  
  let app: FastifyInstance | null = null
  const results: TestResult[] = []
  let testSessionId: string | null = null

  try {
    // 1. 서버 시작
    console.log('\n1️⃣ Fastify 서버 시작')
    app = await buildApp()
    
    // 서버가 세션 API를 지원하는지 확인
    if (!app.integratedChatService) {
      console.log('⚠️  데이터베이스 연결이 없어 세션 API 테스트를 건너뜁니다')
      return
    }
    
    console.log('✅ 서버 시작 완료')

    // 2. 새 세션 생성 테스트
    console.log('\n2️⃣ 새 세션 생성 테스트')
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/session-chat/sessions',
        payload: {
          storeId: 'integration-test-store',
          userId: 'integration-test-user',
          metadata: {
            testType: 'integration-test',
            timestamp: new Date().toISOString()
          }
        }
      })

      if (response.statusCode === 201) {
        const body = JSON.parse(response.body)
        testSessionId = body.sessionId
        
        results.push({
          name: '세션 생성',
          success: true,
          data: { sessionId: testSessionId, statusCode: response.statusCode }
        })
        
        console.log('✅ 세션 생성 성공:', testSessionId)
      } else {
        throw new Error(`세션 생성 실패: ${response.statusCode} - ${response.body}`)
      }
    } catch (error) {
      results.push({
        name: '세션 생성',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      console.error('❌ 세션 생성 실패:', error)
    }

    // 3. 세션 정보 조회 테스트
    if (testSessionId) {
      console.log('\n3️⃣ 세션 정보 조회 테스트')
      try {
        const response = await app.inject({
          method: 'GET',
          url: `/api/session-chat/sessions/${testSessionId}`
        })

        if (response.statusCode === 200) {
          const body = JSON.parse(response.body)
          
          results.push({
            name: '세션 조회',
            success: true,
            data: { 
              sessionId: body.session.id,
              messageCount: body.recentMessages.length,
              statusCode: response.statusCode
            }
          })
          
          console.log('✅ 세션 조회 성공:', {
            sessionId: body.session.id,
            storeId: body.session.store_id,
            messageCount: body.recentMessages.length
          })
        } else {
          throw new Error(`세션 조회 실패: ${response.statusCode} - ${response.body}`)
        }
      } catch (error) {
        results.push({
          name: '세션 조회',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
        console.error('❌ 세션 조회 실패:', error)
      }
    }

    // 4. 세션 기반 채팅 테스트 (OpenAI 클라이언트가 있을 때만)
    if (testSessionId && app.openaiClient) {
      console.log('\n4️⃣ 세션 기반 채팅 테스트')
      try {
        const response = await app.inject({
          method: 'POST',
          url: `/api/session-chat/${testSessionId}`,
          payload: {
            message: '안녕하세요! 통합 테스트 메시지입니다.',
            businessMetadata: {
              inquiryCategory: '통합테스트',
              priority: '보통',
              topicTags: ['테스트', 'API', '통합']
            }
          }
        })

        if (response.statusCode === 200) {
          const body = JSON.parse(response.body)
          
          results.push({
            name: '세션 기반 채팅',
            success: true,
            data: {
              sessionId: body.sessionId,
              responseTime: body.responseTime,
              answerLength: body.answer?.length || 0,
              statusCode: response.statusCode
            }
          })
          
          console.log('✅ 세션 기반 채팅 성공:', {
            sessionId: body.sessionId,
            responseTime: body.responseTime,
            answerLength: body.answer?.length || 0
          })
        } else {
          throw new Error(`세션 채팅 실패: ${response.statusCode} - ${response.body}`)
        }
      } catch (error) {
        results.push({
          name: '세션 기반 채팅',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
        console.error('❌ 세션 기반 채팅 실패:', error)
      }
    } else if (testSessionId && !app.openaiClient) {
      console.log('⚠️  OpenAI 클라이언트 없음 - 채팅 테스트 건너뜀')
      results.push({
        name: '세션 기반 채팅',
        success: true,
        data: { skipped: 'OpenAI 클라이언트 없음' }
      })
    }

    // 5. 세션 통계 조회 테스트
    if (testSessionId) {
      console.log('\n5️⃣ 세션 통계 조회 테스트')
      try {
        const response = await app.inject({
          method: 'GET',
          url: `/api/session-chat/${testSessionId}/stats`
        })

        if (response.statusCode === 200) {
          const stats = JSON.parse(response.body)
          
          results.push({
            name: '세션 통계 조회',
            success: true,
            data: {
              messageCount: stats.messageCount,
              totalTokens: stats.totalTokens,
              avgResponseTime: stats.avgResponseTime,
              statusCode: response.statusCode
            }
          })
          
          console.log('✅ 세션 통계 조회 성공:', {
            messageCount: stats.messageCount,
            totalTokens: stats.totalTokens,
            avgResponseTime: Math.round(stats.avgResponseTime)
          })
        } else {
          throw new Error(`세션 통계 조회 실패: ${response.statusCode} - ${response.body}`)
        }
      } catch (error) {
        results.push({
          name: '세션 통계 조회',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
        console.error('❌ 세션 통계 조회 실패:', error)
      }
    }

    // 6. 에러 케이스 테스트
    console.log('\n6️⃣ 에러 케이스 테스트')
    
    // 6-1. 잘못된 UUID 형식 (400 validation error)
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/session-chat/sessions/non-existent-session-id'
      })

      if (response.statusCode === 400) {
        results.push({
          name: '잘못된 UUID 형식 (400)',
          success: true,
          data: { statusCode: response.statusCode }
        })
        console.log('✅ UUID 검증 에러 처리 정상')
      } else {
        throw new Error(`예상되지 않은 응답: ${response.statusCode}`)
      }
    } catch (error) {
      results.push({
        name: '잘못된 UUID 형식 (400)',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      console.error('❌ UUID 검증 테스트 실패:', error)
    }

    // 6-2. 잘못된 요청 데이터
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/session-chat/sessions',
        payload: {
          // storeId 누락
          userId: 'test-user'
        }
      })

      if (response.statusCode === 400) {
        results.push({
          name: '잘못된 요청 데이터 (400)',
          success: true,
          data: { statusCode: response.statusCode }
        })
        console.log('✅ 400 에러 처리 정상')
      } else {
        throw new Error(`예상되지 않은 응답: ${response.statusCode}`)
      }
    } catch (error) {
      results.push({
        name: '잘못된 요청 데이터 (400)',
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      console.error('❌ 400 에러 테스트 실패:', error)
    }

    // 7. 테스트 데이터 정리
    if (testSessionId && app.databasePool) {
      console.log('\n7️⃣ 테스트 데이터 정리')
      try {
        const pool = app.databasePool
        const client = await pool.connect()
        
        // 테스트 메시지 삭제
        await client.query('DELETE FROM chat_messages WHERE session_id = $1', [testSessionId])
        
        // 테스트 세션 삭제
        await client.query('DELETE FROM chat_sessions WHERE id = $1', [testSessionId])
        
        client.release()
        console.log('🧹 테스트 데이터 정리 완료')
        
        results.push({
          name: '테스트 데이터 정리',
          success: true
        })
      } catch (error) {
        console.warn('⚠️  테스트 데이터 정리 중 오류:', error)
        results.push({
          name: '테스트 데이터 정리',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

  } catch (error) {
    console.error('💥 테스트 실행 중 예외 발생:', error)
    results.push({
      name: '전체 테스트 실행',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    // 서버 종료
    if (app) {
      await app.close()
      console.log('🔌 서버 종료')
    }
  }

  // 8. 테스트 결과 요약
  console.log('\n📊 테스트 결과 요약')
  console.log('='.repeat(50))
  
  const passed = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌'
    console.log(`${status} ${result.name}`)
    if (result.error) {
      console.log(`   오류: ${result.error}`)
    }
    if (result.data && !result.error) {
      console.log(`   데이터: ${JSON.stringify(result.data)}`)
    }
  })
  
  console.log('\n' + '='.repeat(50))
  console.log(`📈 성공: ${passed}개`)
  console.log(`📉 실패: ${failed}개`)
  console.log(`📊 총계: ${results.length}개`)
  
  if (failed === 0) {
    console.log('\n🎉 모든 세션 API 통합 테스트가 성공했습니다!')
    return true
  } else {
    console.log('\n💥 일부 테스트가 실패했습니다.')
    return false
  }
}

// 스크립트 실행
if (require.main === module) {
  testSessionIntegration()
    .then((success) => {
      process.exit(success ? 0 : 1)
    })
    .catch((error) => {
      console.error('\n💥 세션 API 통합 테스트 실패:', error)
      process.exit(1)
    })
}