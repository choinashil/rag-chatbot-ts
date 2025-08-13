// 문서 처리 파이프라인 - 노션 문서를 벡터로 변환하여 Pinecone에 저장
import { createHash } from 'crypto'
import type { BatchResult, CollectionMethod, ProcessingResult } from '../../types/document'
import type { CrawledDocument } from '../../types/html'
import type { NotionPage, PageCollectionOptions } from '../../types/notion'
import type { VectorData } from '../../types/pinecone'
import type { EmbeddingService } from '../embedding/embedding.service'
import { NotionMapper } from '../notion/notion.mapper'
import type { NotionService } from '../notion/notion.service'
import type { PineconeService } from '../vector/pinecone.service'

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

      // 2. 임베딩을 위한 텍스트 구성 (제목 + 내용)
      let embeddingText = notionPage.content.trim()
      if (!embeddingText) {
        // 내용이 비어있으면 제목을 사용
        embeddingText = notionPage.title.trim()
        console.log(`페이지 내용이 비어있어 제목 사용: "${notionPage.title}"`)
      } else if (notionPage.title.trim()) {
        // 제목과 내용 모두 있으면 함께 사용
        embeddingText = `${notionPage.title}\n\n${embeddingText}`
      }

      // 문서 내용을 임베딩으로 변환
      const embeddingResult = await this.embeddingService.createEmbedding(
        embeddingText,
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
   * 페이지 기반으로 재귀적으로 문서를 처리하여 Pinecone에 저장
   */
  async processPageRecursively(
    rootPageId: string,
    options: PageCollectionOptions = {}
  ): Promise<ProcessingResult> {
    try {
      console.log(`  🔄 페이지 기반 문서 처리 시작: ${rootPageId}`)

      // 1. 노션에서 페이지 재귀 수집
      const collectionResult = await this.notionService.collectFromPage(rootPageId, options)
      console.log(`  📄 ${collectionResult.totalPages}개 페이지 수집 완료, 벡터화 시작`)

      // 2. 수집된 페이지들을 벡터화하여 저장
      const processingResult: ProcessingResult = {
        processedPages: 0,
        skippedPages: 0,
        totalVectors: 0,
        errors: [],
        discoveredDatabases: collectionResult.discoveredDatabases
      }

      for (const [index, page] of collectionResult.pages.entries()) {
        try {
          console.log(`    [${index + 1}/${collectionResult.totalPages}] 벡터화 중: ${page.title}`)
          await this.processPageWithMetadata(page, 'page', options.currentDepth || 0)
          console.log(`    ✅ 완료: ${page.title}`)
          processingResult.processedPages++
          processingResult.totalVectors++
        } catch (error) {
          console.error(`    ❌ 실패: ${page.title} - ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
          processingResult.errors.push({
            pageId: page.id,
            title: page.title,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
          })
          processingResult.skippedPages++
        }
      }

      console.log(`  ✅ 페이지 기반 처리 완료: ${processingResult.processedPages}개 성공, ${processingResult.skippedPages}개 실패`)
      return processingResult
    } catch (error) {
      console.error('페이지 기반 문서 처리 실패:', error)
      throw new Error(`페이지 기반 처리에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  /**
   * 수집 방식을 선택하여 문서 처리
   */
  async processCollectionMethod(
    method: CollectionMethod,
    id: string,
    options: PageCollectionOptions = {}
  ): Promise<ProcessingResult> {
    if (method === 'page') {
      return this.processPageRecursively(id, options)
    } else {
      // 기존 데이터베이스 방식 처리
      return this.processDatabaseMethod(id)
    }
  }

  /**
   * 페이지를 메타데이터와 함께 처리
   */
  private async processPageWithMetadata(
    page: NotionPage, 
    collectionMethod: CollectionMethod,
    depthLevel: number,
    parentPageId?: string
  ): Promise<void> {
    try {
      // 페이지 블록에서 링크 추출
      const blocks = await this.notionService.getPageBlocks(page.id)
      const extractedLinks = NotionMapper.extractAllLinksFromBlocks(blocks)

      // 문서 매핑은 메타데이터 생성을 위해서만 사용 (아래 벡터 데이터에서 직접 메타데이터 구성)

      // 임베딩을 위한 텍스트 구성 (제목 + 내용)
      let embeddingText = page.content.trim()
      if (!embeddingText) {
        // 내용이 비어있으면 제목을 사용
        embeddingText = page.title.trim()
        console.log(`페이지 내용이 비어있어 제목 사용: "${page.title}"`)
      } else if (page.title.trim()) {
        // 제목과 내용 모두 있으면 함께 사용
        embeddingText = `${page.title}\n\n${embeddingText}`
      }

      // 임베딩 생성
      const embeddingResult = await this.embeddingService.createEmbedding(
        embeddingText,
        `notion-${page.id}`
      )

      // 벡터 데이터 구성 (확장된 메타데이터 포함)
      const vectorData: VectorData = {
        id: `notion-${page.id}`,
        vector: embeddingResult.embedding,
        metadata: {
          title: page.title,
          content: page.content,
          source: 'notion',
          timestamp: new Date().toISOString(),
          // 새로운 메타데이터
          pageUrl: page.url,
          pageTitle: page.title,
          collectionMethod,
          ...(parentPageId && { parentPageId }),
          depthLevel,
          ...(extractedLinks.length > 0 && { 
            links: extractedLinks.map(link => `${link.text}: ${link.url}`).join('; ')
          })
        }
      }

      // Pinecone에 저장
      await this.pineconeService.upsert(vectorData)
      console.log(`        💾 벡터 저장 완료: ${page.title} (깊이: ${depthLevel})`)

    } catch (error) {
      console.error(`페이지 메타데이터 처리 실패: ${page.title}`, error)
      throw error
    }
  }

  /**
   * 데이터베이스 방식 처리
   * 
   * 노션 데이터베이스를 기준으로 한 문서 수집 방식입니다.
   * - 지정된 데이터베이스 내의 모든 페이지를 플랫하게 수집
   * - 데이터베이스 구조가 명확한 경우에 적합
   * - 빠른 수집과 단순한 구조가 필요한 경우 사용
   * 
   * vs 페이지 방식: 계층 구조보다는 데이터베이스 단위의 체계적인 수집에 특화
   */
  private async processDatabaseMethod(databaseId: string): Promise<ProcessingResult> {
    try {
      console.log(`  📊 데이터베이스 방식 처리 시작: ${databaseId}`)
      
      const pages = await this.notionService.getPagesFromDatabase(databaseId)
      const result: ProcessingResult = {
        processedPages: 0,
        skippedPages: 0,
        totalVectors: 0,
        errors: [],
        discoveredDatabases: [databaseId]
      }

      console.log(`  📄 ${pages.length}개 페이지 처리 시작`)
      for (const [index, page] of pages.entries()) {
        try {
          console.log(`    [${index + 1}/${pages.length}] 처리 중: ${page.title}`)
          // 페이지 상세 정보 조회 (내용 포함)
          const fullPage = await this.notionService.getPage(page.id)
          await this.processPageWithMetadata(fullPage, 'database', 0)
          console.log(`    ✅ 완료: ${page.title}`)
          result.processedPages++
          result.totalVectors++
        } catch (error) {
          console.error(`    ❌ 실패: ${page.title} - ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
          result.errors.push({
            pageId: page.id,
            title: page.title,
            error: error instanceof Error ? error.message : '알 수 없는 오류'
          })
          result.skippedPages++
        }
      }

      return result
    } catch (error) {
      console.error('데이터베이스 방식 처리 실패:', error)
      throw error
    }
  }


  /**
   * HTML 문서를 처리하여 Pinecone에 저장 (MVP 버전)
   */
  async processHtmlDocument(crawledDoc: CrawledDocument): Promise<void> {
    try {
      console.log(`HTML 문서 처리 시작: ${crawledDoc.title}`)

      // 1. 임베딩 생성 (제목 + 내용)
      const embeddingText = `${crawledDoc.title}\n\n${crawledDoc.content}`
      const embedding = await this.embeddingService.createEmbedding(
        embeddingText,
        `html-${this.generateSimpleId(crawledDoc.url)}`
      )
      console.log(`임베딩 생성 완료: ${embedding.embedding.length}차원`)

      // 2. 벡터 데이터 구성 (전체 내용 저장 - 소규모에 최적)
      const vectorData: VectorData = {
        id: `html-${this.generateSimpleId(crawledDoc.url)}`,
        vector: embedding.embedding,
        metadata: {
          title: crawledDoc.title,
          content: crawledDoc.content, // 전체 내용 저장 (100개 문서에 최적)
          source: 'html',
          url: crawledDoc.url,
          breadcrumb: crawledDoc.breadcrumb.join(' > '), // breadcrumb 추가
          timestamp: new Date().toISOString()
        }
      }

      // 3. Pinecone 저장
      await this.pineconeService.upsert(vectorData)
      console.log(`HTML 벡터 저장 완료: ${vectorData.id}`)

      console.log(`✅ HTML 문서 처리 완료: ${crawledDoc.title}`)
    } catch (error) {
      console.error(`❌ HTML 문서 처리 실패 (${crawledDoc.url}):`, error)
      throw new Error(`HTML 문서 처리에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  /**
   * 여러 HTML 문서를 순차적으로 처리 (배치 처리)
   */
  async processHtmlDocuments(documents: CrawledDocument[]): Promise<BatchResult> {
    console.log(`🔄 HTML 문서 배치 처리 시작: ${documents.length}개 문서`)
    
    const result: BatchResult = {
      total: documents.length,
      processed: 0,
      failed: 0,
      errors: []
    }

    for (const [index, doc] of documents.entries()) {
      try {
        // 진행률 표시 개선
        console.log(`📄 [${index + 1}/${documents.length}] 처리 중: ${doc.title}`)
        console.log(`   진행률: ${Math.round((index / documents.length) * 100)}%`)
        
        await this.processHtmlDocument(doc)
        result.processed++
        
        console.log(`   ✅ 완료: ${doc.title}`)
        console.log(`   📊 누적: 성공 ${result.processed}개, 실패 ${result.failed}개`)
        console.log('') // 구분선
      } catch (error) {
        console.error(`   ❌ 실패: ${doc.title}`, error)
        result.failed++
        result.errors.push({
          url: doc.url,
          title: doc.title,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        })
        console.log('') // 구분선
      }
    }

    console.log(`🎉 HTML 문서 배치 처리 완료`)
    console.log(`   📊 최종 결과: 성공 ${result.processed}개, 실패 ${result.failed}개`)
    
    return result
  }

  /**
   * URL 기반 고유 ID 생성
   */
  private generateSimpleId(url: string): string {
    // URL의 해시를 생성하여 고유성 보장
    const hash = createHash('md5').update(url).digest('hex')
    return hash.substring(0, 16) // 16자리 해시 사용
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

