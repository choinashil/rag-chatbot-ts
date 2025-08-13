/**
 * LangChain 기반 RAG 서비스
 * 자동 LangSmith 추적과 스트리밍 지원
 */

import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence, RunnablePassthrough } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
import type { BaseMessage } from '@langchain/core/messages'

import { EmbeddingService } from '../openai/embedding.service'
import { PineconeService } from '../pinecone/pinecone.service'
import type { RAGRequest, RAGResponse, RAGSource, StreamingChatRequest, StreamingEvent } from '../../types'
import { RAG_CONFIG, RAG_MESSAGES, OPENAI_MODELS } from '../../constants'

export class LangChainRAGService {
  private chatModel: ChatOpenAI
  private ragChain: RunnableSequence<any, any>

  constructor(
    private embeddingService: EmbeddingService,
    private pineconeService: PineconeService
  ) {
    // LangSmith 환경 변수 확인 및 설정
    this.initializeLangSmithTracking()
    
    // LangChain OpenAI 모델 (자동 LangSmith 추적)
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다')
    }
    
    this.chatModel = new ChatOpenAI({
      modelName: OPENAI_MODELS.CHAT,
      temperature: RAG_CONFIG.DEFAULT_TEMPERATURE,
      apiKey: apiKey
    })

    // RAG 체인 구성
    this.ragChain = this.createRAGChain()
  }

  /**
   * LangChain + LangSmith 통합 추적 초기화 확인
   * 
   * 주의: LangSmith 서비스를 사용하지만 환경변수는 LANGCHAIN_XX 형식 사용
   * 이는 LangChain의 자동 LangSmith 통합 기능이 해당 변수명을 요구하기 때문입니다.
   */
  private initializeLangSmithTracking() {
    console.log('🔍 LangChain LangSmith 자동 추적 확인 중...')
    
    // LangChain이 요구하는 환경 변수 확인
    const tracingEnabled = process.env.LANGCHAIN_TRACING_V2
    const apiKey = process.env.LANGCHAIN_API_KEY
    const project = process.env.LANGCHAIN_PROJECT
    
    console.log('📋 LangChain LangSmith 통합 설정:')
    console.log('- LANGCHAIN_TRACING_V2:', tracingEnabled)
    console.log('- LANGCHAIN_API_KEY:', apiKey ? '***설정됨***' : '미설정')
    console.log('- LANGCHAIN_PROJECT:', project)
    
    if (tracingEnabled === 'true' && apiKey && project) {
      console.log('✅ LangChain LangSmith 자동 추적이 활성화됩니다')
    } else {
      console.log('⚠️  LangChain LangSmith 자동 추적이 비활성화되어 있습니다')
      console.log('   추적을 원한다면 LANGCHAIN_XX 환경변수를 설정하세요')
    }
  }

  /**
   * LangChain RAG 체인 생성
   */
  private createRAGChain() {
    // RAG 프롬프트 템플릿
    const ragPrompt = PromptTemplate.fromTemplate(`
다음 문서들을 참고하여 질문에 답변해주세요.

문서 내용:
{context}

질문: {question}

답변 시 주의사항:
1. 제공된 문서의 내용만을 바탕으로 답변하세요
2. 문서에 없는 내용은 추측하지 마세요  
3. 질문의 대상과 문서의 주제가 일치하는지 확인하세요
4. 질문의 대상과 문서의 주제가 다르다면, "제공된 문서에서는 [질문 대상]에 대한 정보를 찾을 수 없습니다"라고 답변하세요
5. 답변 마지막에 참고한 문서를 간단히 언급해주세요
6. 명확하고 간결하게 답변하세요

답변:`)

    // RAG 체인 구성 (자동 LangSmith 추적)
    return RunnableSequence.from([
      {
        context: async (input: { question: string }) => {
          // 1. 임베딩 생성
          const embeddingResult = await this.embeddingService.createEmbedding(input.question)
          
          // 2. 벡터 검색
          const searchResults = await this.pineconeService.query(
            embeddingResult.embedding,
            {
              topK: RAG_CONFIG.DEFAULT_TOP_K,
              scoreThreshold: RAG_CONFIG.DEFAULT_SCORE_THRESHOLD
            }
          )

          // 3. 컨텍스트 구성
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
      this.chatModel,
      new StringOutputParser()
    ])
  }

  /**
   * 일반 RAG 질의 (기존 인터페이스 유지)
   */
  async askQuestion(request: RAGRequest): Promise<RAGResponse> {
    const startTime = Date.now()

    try {
      console.log(`LangChain RAG 질의 시작: "${request.question}"`)

      // LangChain 체인 실행 (자동 LangSmith 추적)
      const answer = await this.ragChain.invoke({
        question: request.question
      })

      // 소스 정보를 위한 별도 검색 (메타데이터용)
      const embeddingResult = await this.embeddingService.createEmbedding(request.question)
      const searchResults = await this.pineconeService.query(
        embeddingResult.embedding,
        {
          topK: request.maxResults || RAG_CONFIG.DEFAULT_TOP_K,
          scoreThreshold: request.scoreThreshold || RAG_CONFIG.DEFAULT_SCORE_THRESHOLD
        }
      )

      const sources: RAGSource[] = searchResults.map(result => ({
        id: result.id,
        title: (result.metadata?.title && result.metadata.title.trim()) || '제목 없음',
        content: result.metadata?.content || '',
        score: result.score,
        url: result.metadata?.url || ''
      }))

      const response: RAGResponse = {
        answer: answer,
        sources: sources,
        metadata: {
          totalSources: searchResults.length,
          processingTime: Date.now() - startTime,
          model: OPENAI_MODELS.CHAT,
          timestamp: new Date().toISOString()
        }
      }

      console.log(`LangChain RAG 질의 완료 (${response.metadata.processingTime}ms)`)
      return response

    } catch (error) {
      console.error('LangChain RAG 질의 처리 실패:', error)
      throw new Error(`질의를 처리할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  /**
   * 스트리밍 RAG 질의 (임시: 일반 응답으로 변환)
   * TODO: 추후 LangChain 스트리밍으로 개선
   */
  async* askQuestionStream(request: StreamingChatRequest): AsyncGenerator<StreamingEvent, void, unknown> {
    try {
      yield {
        type: 'status',
        content: '답변 생성 중...',
        data: { timestamp: new Date().toISOString() }
      }

      // 일반 askQuestion 사용 후 토큰 단위로 전송
      const response = await this.askQuestion({ question: request.message })
      
      // 답변을 한 번에 전송
      yield {
        type: 'token',
        content: response.answer
      }

      yield {
        type: 'sources',
        data: response.sources
      }

      yield {
        type: 'done',
        data: response.metadata
      }

    } catch (error) {
      console.error('LangChain 스트리밍 RAG 질의 처리 실패:', error)
      yield {
        type: 'error',
        content: `질의를 처리할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        data: { timestamp: new Date().toISOString() }
      }
    }
  }
}