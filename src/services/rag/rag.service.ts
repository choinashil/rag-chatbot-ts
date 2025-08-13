/**
 * RAG (Retrieval-Augmented Generation) 서비스
 * LangChain 체이닝 + 추적 유지하는 RAG 기능 제공
 */

import { PromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'

import { EmbeddingService } from '../openai/embedding.service'
import { PineconeService } from '../pinecone/pinecone.service'
import { LLMService } from '../llm/llm.service'
import { MonitoringService } from '../monitoring/monitoring.service'
import type { RAGRequest, RAGResponse, RAGSource, StreamingChatRequest, StreamingEvent } from '../../types'
import { RAG_CONFIG, RAG_MESSAGES, OPENAI_MODELS } from '../../constants'
import { RAG_PROMPT_TEMPLATE } from '../../prompts/rag-prompts'

export class RAGService {
  private ragChain: RunnableSequence<any, any>
  private llmService: LLMService
  private monitoringService: MonitoringService

  constructor(
    private embeddingService: EmbeddingService,
    private pineconeService: PineconeService
  ) {
    // 의존성 서비스 초기화  
    this.llmService = new LLMService()
    this.monitoringService = new MonitoringService()
    this.ragChain = this.createRAGChain()
  }


  /**
   * RAG 체인 생성
   */
  private createRAGChain(): RunnableSequence<any, any> {
    const ragPrompt = PromptTemplate.fromTemplate(RAG_PROMPT_TEMPLATE)

    return RunnableSequence.from([
      {
        context: async (input: { question: string }) => {
          // 임베딩 + 벡터 검색 로직
          const embeddingResult = await this.embeddingService.createEmbedding(input.question)
          const searchResults = await this.pineconeService.query(
            embeddingResult.embedding,
            {
              topK: RAG_CONFIG.DEFAULT_TOP_K,
              scoreThreshold: RAG_CONFIG.DEFAULT_SCORE_THRESHOLD
            }
          )

          // 컨텍스트 구성 후 반환
          if (searchResults.length === 0) {
            return RAG_MESSAGES.NO_RESULTS
          }

          return searchResults
            .map((result, index) => `[문서 ${index + 1}] ${result.metadata?.title || '제목 없음'}\n${result.metadata?.content || ''}`)
            .join('\n\n')
        },
        question: new RunnablePassthrough()
      },
      ragPrompt,
      this.llmService.getChatModel(),
      new StringOutputParser()
    ])
  }

  /**
   * LangChain 체이닝 유지
   */
  async askQuestion(request: RAGRequest): Promise<RAGResponse> {
    const startTime = Date.now()

    try {
      console.log(`RAG 질의 시작: "${request.question}"`)

      // LangChain 체인 실행
      const answer = await this.ragChain.invoke({
        question: request.question
      })

      // 소스 정보는 별도 수집
      const sources = await this.getSourcesForQuestion(request)

      const response: RAGResponse = {
        answer: answer,
        sources: sources,
        metadata: {
          totalSources: sources.length,
          processingTime: Date.now() - startTime,
          model: OPENAI_MODELS.CHAT,
          timestamp: new Date().toISOString(),
          monitoringEnabled: this.monitoringService.isMonitoringEnabled()
        }
      }

      console.log(`RAG 질의 완료 (${response.metadata.processingTime}ms)`)
      return response

    } catch (error) {
      console.error('RAG 질의 처리 실패:', error)
      throw new Error(`질의를 처리할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  /**
   * 질문에 대한 소스 정보 수집
   */
  private async getSourcesForQuestion(request: RAGRequest): Promise<RAGSource[]> {
    const embeddingResult = await this.embeddingService.createEmbedding(request.question)
    const searchResults = await this.pineconeService.query(
      embeddingResult.embedding,
      {
        topK: request.maxResults || RAG_CONFIG.DEFAULT_TOP_K,
        scoreThreshold: request.scoreThreshold || RAG_CONFIG.DEFAULT_SCORE_THRESHOLD
      }
    )

    return searchResults.map(result => ({
      id: result.id,
      title: (result.metadata?.title && result.metadata.title.trim()) || '제목 없음',
      content: result.metadata?.content || '',
      score: result.score,
      url: result.metadata?.url || ''
    }))
  }


  /**
   * 스트리밍 RAG 질의 - LangChain 체인 스트리밍 사용
   */
  async* askQuestionStream(request: StreamingChatRequest): AsyncGenerator<StreamingEvent, void, unknown> {
    try {
      yield { type: 'status', content: '답변 생성 중...' }

      // LangChain 체인 스트리밍
      const stream = await this.ragChain.stream({
        question: request.message
      })

      for await (const chunk of stream) {
        if (chunk) {
          yield { type: 'token', content: chunk }
        }
      }

      // 소스 정보 별도 전송
      const sources = await this.getSourcesForQuestion({ question: request.message })
      yield { type: 'sources', data: sources }
      yield { type: 'done' }

    } catch (error) {
      console.error('스트리밍 RAG 질의 처리 실패:', error)
      yield {
        type: 'error', 
        content: `질의를 처리할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      }
    }
  }
}