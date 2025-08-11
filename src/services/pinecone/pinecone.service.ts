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
      
      const upsertData = {
        id: vectorData.id,
        values: vectorData.vector,
        metadata: {
          title: vectorData.metadata.title,
          content: vectorData.metadata.content,
          source: vectorData.metadata.source,
          timestamp: vectorData.metadata.timestamp || new Date().toISOString(),
          ...(vectorData.metadata.url && { url: vectorData.metadata.url }),
          ...(vectorData.metadata.breadcrumb && { breadcrumb: vectorData.metadata.breadcrumb })
        }
      }
      
      await index.upsert([upsertData])

      console.log(`        💾 벡터 저장 완료: ${vectorData.id}`)
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
            timestamp: (match.metadata as any)?.timestamp,
            url: (match.metadata as any)?.url,
            breadcrumb: (match.metadata as any)?.breadcrumb
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
   * 인덱스의 모든 벡터 삭제
   */
  async deleteAll(namespace?: string): Promise<void> {
    try {
      if (namespace) {
        // 특정 네임스페이스에 대한 Index 인스턴스 생성
        const index = this.client.getIndex().namespace(namespace)
        await index.deleteAll()
        console.log(`모든 벡터 삭제 완료: 네임스페이스 "${namespace}"`)
      } else {
        // 기본 네임스페이스 삭제
        const index = this.client.getIndex()
        await index.deleteAll()
        console.log('모든 벡터 삭제 완료: 기본 네임스페이스')
      }
    } catch (error) {
      console.error('모든 벡터 삭제 실패:', error)
      throw new Error(`벡터 인덱스 초기화에 실패했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 인덱스 통계 조회
   */
  async describeIndexStats(): Promise<any> {
    try {
      const index = this.client.getIndex()
      const stats = await index.describeIndexStats()
      return stats
    } catch (error) {
      console.error('인덱스 통계 조회 실패:', error)
      throw new Error(`인덱스 통계 조회에 실패했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 헬스체크
   */
  async healthCheck(): Promise<boolean> {
    return this.client.healthCheck()
  }
}