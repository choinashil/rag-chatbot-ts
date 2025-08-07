// Pinecone 설정 관리
import type { PineconeConfig } from '../types/pinecone'

export function createPineconeConfig(): PineconeConfig {
  const apiKey = process.env.PINECONE_API_KEY
  const indexName = process.env.PINECONE_INDEX_NAME
  
  if (!apiKey) {
    throw new Error('PINECONE_API_KEY 환경변수가 설정되지 않았습니다')
  }
  
  if (!indexName) {
    throw new Error('PINECONE_INDEX_NAME 환경변수가 설정되지 않았습니다')
  }

  return {
    apiKey,
    indexName
  }
}