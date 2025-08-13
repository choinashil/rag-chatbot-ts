/**
 * PostgreSQL 데이터베이스 설정
 * 멀티 스토어 세션 관리 및 하이브리드 데이터 저장을 위한 DB 연결 설정
 */

import { Pool, PoolConfig } from 'pg'

/**
 * PostgreSQL 연결 풀 생성
 * AWS RDS와 로컬 개발 환경 모두 지원
 */
export const createDatabasePool = (): Pool => {
  const poolConfig: PoolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'sixshop-ai-agent',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    
    // SSL 설정 (AWS RDS용)
    ssl: process.env.DB_HOST?.includes('rds.amazonaws.com') ? {
      rejectUnauthorized: false  // AWS RDS SSL 인증서 설정
    } : false,
    
    // 연결 풀 설정
    max: parseInt(process.env.DB_POOL_MAX || '20'),          // 최대 연결 수
    min: parseInt(process.env.DB_POOL_MIN || '2'),           // 최소 연결 수
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),    // 유휴 연결 타임아웃
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'), // 연결 타임아웃
    
    // 연결 유지 설정
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    
    // 애플리케이션 이름 (모니터링용)
    application_name: 'sixshop-ai-agent'
  }

  return new Pool(poolConfig)
}

/**
 * 데이터베이스 연결 상태 확인
 */
export const checkDatabaseConnection = async (pool: Pool): Promise<boolean> => {
  try {
    const client = await pool.connect()
    await client.query('SELECT NOW()')
    client.release()
    console.log('✅ PostgreSQL 연결 성공')
    return true
  } catch (error) {
    console.error('❌ PostgreSQL 연결 실패:', error)
    return false
  }
}

/**
 * 데이터베이스 풀 정상 종료
 */
export const closeDatabasePool = async (pool: Pool): Promise<void> => {
  try {
    await pool.end()
    console.log('✅ PostgreSQL 연결 풀 종료')
  } catch (error) {
    console.error('❌ PostgreSQL 연결 풀 종료 실패:', error)
  }
}

/**
 * 트랜잭션 헬퍼 함수
 * 하이브리드 데이터 저장에서 사용
 */
export const withTransaction = async <T>(
  pool: Pool,
  callback: (client: any) => Promise<T>
): Promise<T> => {
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}