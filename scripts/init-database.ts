/**
 * 데이터베이스 초기화 스크립트
 * PostgreSQL 테이블 및 함수 생성
 */

import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { createDatabasePool } from '../src/config/database'

// 환경변수 로드
dotenv.config({ path: path.join(__dirname, '../env/.env.dev') })

async function initializeDatabase() {
  console.log('🚀 데이터베이스 초기화 시작...')
  
  const pool = createDatabasePool()
  
  try {
    // SQL 스크립트 읽기
    const sqlScriptPath = path.join(__dirname, '../sql/migrations/001_initial_schema.sql')
    const sqlScript = fs.readFileSync(sqlScriptPath, 'utf8')
    
    console.log('📝 SQL 스크립트 실행 중...')
    
    // SQL 스크립트 실행
    const client = await pool.connect()
    await client.query(sqlScript)
    client.release()
    
    console.log('✅ 데이터베이스 초기화 완료!')
    
    // 테이블 생성 확인
    await verifyTablesCreated(pool)
    
  } catch (error) {
    console.error('❌ 데이터베이스 초기화 실패:', error)
    throw error
  } finally {
    await pool.end()
  }
}

async function verifyTablesCreated(pool: any) {
  console.log('🔍 테이블 생성 확인 중...')
  
  const client = await pool.connect()
  
  try {
    // 테이블 목록 조회
    const tablesResult = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `)
    
    console.log('📋 생성된 테이블:', tablesResult.rows.map((row: any) => row.tablename))
    
    // 함수 목록 조회
    const functionsResult = await client.query(`
      SELECT proname 
      FROM pg_proc 
      WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND prokind = 'f'
      ORDER BY proname
    `)
    
    console.log('🔧 생성된 함수:', functionsResult.rows.map((row: any) => row.proname))
    
    // 뷰 목록 조회
    const viewsResult = await client.query(`
      SELECT viewname 
      FROM pg_views 
      WHERE schemaname = 'public'
      ORDER BY viewname
    `)
    
    console.log('👁️ 생성된 뷰:', viewsResult.rows.map((row: any) => row.viewname))
    
    // 샘플 세션 생성 테스트
    await testSampleData(client)
    
  } finally {
    client.release()
  }
}

async function testSampleData(client: any) {
  console.log('🧪 샘플 데이터 테스트...')
  
  try {
    // 샘플 세션 생성
    const sessionResult = await client.query(`
      INSERT INTO chat_sessions (store_id, user_id, metadata) 
      VALUES ('store_test', 'user_test', '{"test": true}')
      RETURNING id
    `)
    
    const sessionId = sessionResult.rows[0].id
    console.log('📝 테스트 세션 생성:', sessionId)
    
    // 샘플 메시지 생성 (sequence_number 자동 생성 테스트)
    await client.query(`
      INSERT INTO chat_messages (session_id, role, content, token_count) 
      VALUES ($1, 'user', '안녕하세요! 테스트 메시지입니다.', 10)
    `, [sessionId])
    
    await client.query(`
      INSERT INTO chat_messages (session_id, role, content, token_count, response_time_ms) 
      VALUES ($1, 'assistant', '안녕하세요! 도움을 드릴 수 있어서 기쁩니다.', 15, 1200)
    `, [sessionId])
    
    // 생성된 메시지 확인
    const messagesResult = await client.query(`
      SELECT role, content, sequence_number, created_at
      FROM chat_messages 
      WHERE session_id = $1 
      ORDER BY sequence_number
    `, [sessionId])
    
    console.log('💬 테스트 메시지 생성 완료:')
    messagesResult.rows.forEach((msg: any) => {
      console.log(`  ${msg.sequence_number}. [${msg.role}] ${msg.content}`)
    })
    
    // 테스트 데이터 정리
    await client.query('DELETE FROM chat_sessions WHERE store_id = $1', ['store_test'])
    console.log('🧹 테스트 데이터 정리 완료')
    
  } catch (error) {
    console.error('❌ 샘플 데이터 테스트 실패:', error)
    throw error
  }
}

// 스크립트 실행
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('🎉 데이터베이스 초기화 성공!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 데이터베이스 초기화 실패:', error)
      process.exit(1)
    })
}