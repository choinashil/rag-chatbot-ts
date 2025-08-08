// 문서 처리 파이프라인 - 노션 문서를 벡터로 변환하여 Pinecone에 저장
import type { NotionService } from '../notion/notion.service'
import type { EmbeddingService } from '../openai/embedding.service'
import type { PineconeService } from '../pinecone/pinecone.service'
import type { VectorData } from '../../types/pinecone'
import type { NotionPage } from '../../types/notion'

export class DocumentProcessor {
  constructor(
    private notionService: NotionService,
    private embeddingService: EmbeddingService,
    private pineconeService: PineconeService
  ) {}

  /**
   * 단일 노션 문서를 처리하여 Pinecone에 저장
   */
  async processDocument(pageId: string): Promise<void> {
    try {
      console.log(`문서 처리 시작: ${pageId}`)

      // 1. 노션에서 페이지 내용 가져오기
      const notionPage = await this.notionService.getPage(pageId)
      console.log(`노션 페이지 조회 완료: ${notionPage.title}`)

      // 2. 문서 내용을 임베딩으로 변환
      const embeddingResult = await this.embeddingService.createEmbedding(
        notionPage.content,
        `notion-${pageId}`
      )
      console.log(`임베딩 생성 완료: ${embeddingResult.embedding.length}차원`)

      // 3. 벡터 데이터 구성
      const vectorData: VectorData = {
        id: `notion-${pageId}`,
        vector: embeddingResult.embedding,
        metadata: {
          title: notionPage.title,
          content: notionPage.content,
          source: 'notion',
          timestamp: new Date().toISOString()
        }
      }

      // 4. Pinecone에 벡터 저장
      await this.pineconeService.upsert(vectorData)
      console.log(`벡터 저장 완료: ${vectorData.id}`)

      console.log(`✅ 문서 처리 완료: ${notionPage.title}`)
    } catch (error) {
      console.error(`❌ 문서 처리 실패 (${pageId}):`, error)
      throw new Error(`문서 처리에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  /**
   * 처리된 문서를 검색하여 파이프라인 검증
   */
  async testPipeline(query: string): Promise<{ query: string, results: any[] }> {
    try {
      console.log(`파이프라인 테스트 시작: "${query}"`)

      // 질문을 임베딩으로 변환
      const queryEmbedding = await this.embeddingService.createEmbedding(query)
      console.log(`질문 임베딩 생성 완료`)

      // Pinecone에서 유사 문서 검색
      const searchResults = await this.pineconeService.query(queryEmbedding.embedding, {
        topK: 3,
        scoreThreshold: 0.7
      })

      console.log(`검색 결과: ${searchResults.length}개 문서`)
      searchResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.metadata.title} (점수: ${result.score.toFixed(3)})`)
      })

      return {
        query,
        results: searchResults
      }
    } catch (error) {
      console.error('파이프라인 테스트 실패:', error)
      throw error
    }
  }
}