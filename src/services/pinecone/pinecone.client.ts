// Pinecone 클라이언트
import { Pinecone } from '@pinecone-database/pinecone'
import type { PineconeConfig, PineconeServiceStatus } from '../../types/pinecone'
import { PINECONE_CONFIG, PINECONE_ERRORS } from '../../constants/pinecone.constants'

export class PineconeClient {
  private client: Pinecone
  private indexName: string

  constructor(config: PineconeConfig) {
    this.client = new Pinecone({
      apiKey: config.apiKey
    })
    this.indexName = config.indexName
  }

  /**
   * Pinecone 인덱스 접근
   */
  getIndex() {
    return this.client.index(this.indexName)
  }

  /**
   * 연결 상태 확인
   */
  async checkConnection(): Promise<PineconeServiceStatus> {
    try {
      const index = this.getIndex()
      const stats = await index.describeIndexStats()
      
      return {
        connected: true,
        indexName: this.indexName,
        vectorCount: stats.totalRecordCount ?? 0
      }
    } catch (error) {
      console.error('Pinecone 연결 확인 실패:', error)
      return {
        connected: false,
        indexName: this.indexName,
        error: error instanceof Error ? error.message : PINECONE_ERRORS.CONNECTION_FAILED
      }
    }
  }

  /**
   * 기본 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    const status = await this.checkConnection()
    return status.connected
  }
}