// Pinecone 서비스 - 핵심 벡터 작업 구현
import type { VectorData, SearchResult, QueryOptions } from '../../types/pinecone'
import { PINECONE_CONFIG, PINECONE_ERRORS } from '../../constants/pinecone.constants'
import { PineconeClient } from './pinecone.client'

export class PineconeService {
  public client: PineconeClient

  constructor(client: PineconeClient) {
    this.client = client
  }

  /**
   * 벡터 저장 (upsert)
   */
  async upsert(vectorData: VectorData): Promise<void> {
    try {
      const index = this.client.getIndex()
      
      await index.upsert([{
        id: vectorData.id,
        values: vectorData.vector,
        metadata: {
          title: vectorData.metadata.title,
          content: vectorData.metadata.content,
          source: vectorData.metadata.source,
          timestamp: vectorData.metadata.timestamp || new Date().toISOString()
        }
      }])

      console.log(`벡터 저장 완료: ${vectorData.id}`)
    } catch (error) {
      console.error('벡터 저장 실패:', error)
      throw new Error(`${PINECONE_ERRORS.UPSERT_FAILED}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 벡터 검색 (query)
   */
  async query(queryVector: number[], options: QueryOptions = {}): Promise<SearchResult[]> {
    const {
      topK = PINECONE_CONFIG.DEFAULT_TOP_K,
      scoreThreshold = PINECONE_CONFIG.DEFAULT_SCORE_THRESHOLD
    } = options

    try {
      const index = this.client.getIndex()
      
      const queryResult = await index.query({
        vector: queryVector,
        topK,
        includeMetadata: true
      })

      // 임계값 필터링 및 결과 변환
      const results: SearchResult[] = queryResult.matches
        .filter(match => match.score && match.score >= scoreThreshold)
        .map(match => ({
          id: match.id,
          score: match.score || 0,
          metadata: {
            title: (match.metadata as any)?.title || '',
            content: (match.metadata as any)?.content || '',
            source: (match.metadata as any)?.source || '',
            timestamp: (match.metadata as any)?.timestamp
          }
        }))

      console.log(`벡터 검색 완료: ${results.length}개 결과 (임계값: ${scoreThreshold})`)
      return results
    } catch (error) {
      console.error('벡터 검색 실패:', error)
      throw new Error(`${PINECONE_ERRORS.QUERY_FAILED}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 문서 삭제
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const index = this.client.getIndex()
      await index.deleteOne(documentId)
      console.log(`문서 삭제 완료: ${documentId}`)
    } catch (error) {
      console.error('문서 삭제 실패:', error)
      throw new Error(`문서 삭제에 실패했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    return this.client.healthCheck()
  }
}