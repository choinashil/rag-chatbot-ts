/**
 * 세션 및 메시지 데이터 확인 스크립트
 */

import dotenv from 'dotenv'
import path from 'path'
import { createDatabasePool, checkDatabaseConnection } from '../src/config/database'

// 환경변수 로드
dotenv.config({ path: path.join(__dirname, '../env/.env.dev') })

async function checkSessionData() {
  console.log('🔍 세션 데이터 확인 중...')
  
  try {
    const pool = createDatabasePool()
    const isConnected = await checkDatabaseConnection(pool)
    
    if (!isConnected) {
      console.error('❌ 데이터베이스 연결 실패')
      process.exit(1)
    }

    const client = await pool.connect()
    
    try {
      // 테이블 존재 여부 확인
      console.log('\n=== 테이블 존재 확인 ===')
      const tableCheck = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('chat_sessions', 'chat_messages')
        ORDER BY table_name
      `)
      console.log('존재하는 테이블:', tableCheck.rows.map(r => r.table_name))
      
      if (tableCheck.rows.length === 0) {
        console.log('⚠️ 세션 관련 테이블이 존재하지 않습니다. 마이그레이션을 실행해주세요.')
        await pool.end()
        return
      }

      // 세션 데이터 확인
      console.log('\n=== 세션 데이터 확인 ===')
      const sessions = await client.query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(*) FILTER (WHERE is_active = true) as active_sessions,
          COUNT(*) FILTER (WHERE expires_at > NOW()) as non_expired_sessions
        FROM chat_sessions
      `)
      console.log('세션 통계:', sessions.rows[0])
      
      const recentSessions = await client.query(`
        SELECT id, store_id, user_id, created_at, last_active_at, is_active
        FROM chat_sessions 
        ORDER BY created_at DESC 
        LIMIT 5
      `)
      console.log('최근 세션 5개:', recentSessions.rows)

      // 메시지 데이터 확인
      console.log('\n=== 메시지 데이터 확인 ===')
      const messages = await client.query(`
        SELECT 
          COUNT(*) as total_messages,
          COUNT(*) FILTER (WHERE role = 'user') as user_messages,
          COUNT(*) FILTER (WHERE role = 'assistant') as assistant_messages,
          COUNT(*) FILTER (WHERE langsmith_trace_id IS NOT NULL) as messages_with_trace
        FROM chat_messages
      `)
      console.log('메시지 통계:', messages.rows[0])
      
      const recentMessages = await client.query(`
        SELECT session_id, role, content, created_at, langsmith_trace_id
        FROM chat_messages 
        ORDER BY created_at DESC 
        LIMIT 5
      `)
      console.log('최근 메시지 5개:', recentMessages.rows)
      
    } finally {
      client.release()
    }
    
    await pool.end()
    console.log('\n✅ 데이터 확인 완료')
    
  } catch (error) {
    console.error('💥 데이터 확인 중 오류:', error)
    process.exit(1)
  }
}

checkSessionData()