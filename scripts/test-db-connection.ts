/**
 * 데이터베이스 연결 테스트 스크립트
 */

import dotenv from 'dotenv'
import path from 'path'
import { createDatabasePool, checkDatabaseConnection } from '../src/config/database'

// 환경변수 로드
dotenv.config({ path: path.join(__dirname, '../env/.env.dev') })

async function testDatabaseConnection() {
  console.log('🔍 데이터베이스 연결 테스트 시작...')
  
  console.log('📋 연결 정보:', {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ? '***' : 'undefined'
  })

  try {
    const pool = createDatabasePool()
    const isConnected = await checkDatabaseConnection(pool)
    
    if (isConnected) {
      console.log('✅ 데이터베이스 연결 성공!')
      
      // 기본 쿼리 테스트
      const client = await pool.connect()
      const result = await client.query('SELECT version() as version, NOW() as current_time')
      console.log('📊 데이터베이스 정보:', result.rows[0])
      client.release()
      
      await pool.end()
      process.exit(0)
    } else {
      console.error('❌ 데이터베이스 연결 실패')
      process.exit(1)
    }
  } catch (error) {
    console.error('💥 연결 테스트 중 오류:', error)
    process.exit(1)
  }
}

testDatabaseConnection()