import { EmbeddingService } from '../openai/embedding.service'
import { PineconeService } from '../pinecone/pinecone.service'
import { ChatService } from '../openai/chat.service'
import { OpenAIClient } from '../openai/openai.client'
import type { RAGRequest, RAGResponse, RAGSource, RAGContext, StreamingEvent, StreamingChatRequest } from '../../types'
import { RAG_CONFIG, RAG_MESSAGES, OPENAI_MODELS } from '../../constants'

export class RAGService {
  constructor(
    private embeddingService: EmbeddingService,
    private pineconeService: PineconeService,
    private chatService: ChatService,
    private openaiClient: OpenAIClient
  ) {}

  async askQuestion(request: RAGRequest): Promise<RAGResponse> {
    const startTime = Date.now()

    try {
      console.log(`RAG 질의 시작: "${request.question}"`)

      // 1. 질문을 임베딩으로 변환
      const embeddingResult = await this.embeddingService.createEmbedding(request.question)
      console.log('질문 임베딩 생성 완료')

      // 2. 관련 문서 검색
      const searchResults = await this.pineconeService.query(
        embeddingResult.embedding,
        {
          topK: request.maxResults || RAG_CONFIG.DEFAULT_TOP_K,
          scoreThreshold: request.scoreThreshold || RAG_CONFIG.DEFAULT_SCORE_THRESHOLD
        }
      )
      console.log(`관련 문서 검색 완료: ${searchResults.length}개 문서`)

      // 3. 검색 결과가 없으면 기본 응답
      if (searchResults.length === 0) {
        return {
          answer: RAG_MESSAGES.NO_RESULTS,
          sources: [],
          metadata: {
            totalSources: 0,
            processingTime: Date.now() - startTime,
            model: OPENAI_MODELS.CHAT,
            timestamp: new Date().toISOString()
          }
        }
      }

      // 4. RAG 컨텍스트 구성
      const context = this.buildContext(searchResults)

      // 5. 프롬프트 생성 및 답변 요청
      const prompt = this.buildPrompt(request.question, context)
      const chatResponse = await this.chatService.generateResponse({
        messages: [
          {
            role: 'system',
            content: RAG_MESSAGES.SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: RAG_CONFIG.DEFAULT_TEMPERATURE
      })
      console.log('답변 생성 완료')

      // 6. 응답 구성
      const response: RAGResponse = {
        answer: chatResponse.content,
        sources: context.sources,
        metadata: {
          totalSources: searchResults.length,
          processingTime: Date.now() - startTime,
          model: OPENAI_MODELS.CHAT,
          timestamp: new Date().toISOString()
        }
      }

      console.log(`RAG 질의 완료 (${response.metadata.processingTime}ms)`)
      return response

    } catch (error) {
      console.error('RAG 질의 처리 실패:', error)
      throw new Error(`질의를 처리할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }

  private buildContext(searchResults: Array<{ id: string; score: number; metadata: any }>): RAGContext {
    const sources: RAGSource[] = searchResults.map(result => ({
      id: result.id,
      title: (result.metadata.title && result.metadata.title.trim()) || '제목 없음',
      content: result.metadata.content || '',
      score: result.score,
      url: result.metadata.url
    }))

    const combinedContent = sources
      .map((source, index) => `[문서 ${index + 1}] ${source.title}\n${source.content}`)
      .join('\n\n')

    return { sources, combinedContent }
  }

  private buildPrompt(question: string, context: RAGContext): string {
    return `다음 문서들을 참고하여 질문에 답변해주세요.

문서 내용:
${context.combinedContent}

질문: ${question}

답변 시 주의사항:
1. 제공된 문서의 내용만을 바탕으로 답변하세요
2. 문서에 없는 내용은 추측하지 마세요  
3. 질문의 대상(누구/무엇에 대한 질문인지)과 문서의 주제가 일치하는지 확인하세요
4. 질문의 대상과 문서의 주제가 다르다면, "제공된 문서에서는 [질문 대상]에 대한 정보를 찾을 수 없습니다"라고 답변하세요
5. 답변 마지막에 참고한 문서를 간단히 언급해주세요
6. 명확하고 간결하게 답변하세요

답변:`
  }

  async* askQuestionStream(request: StreamingChatRequest): AsyncGenerator<StreamingEvent, void, unknown> {
    const startTime = Date.now()

    try {
      yield {
        type: 'status',
        content: '질문 분석 중...',
        data: { timestamp: new Date().toISOString() }
      }

      // 1. 질문을 임베딩으로 변환
      const embeddingResult = await this.embeddingService.createEmbedding(request.message)
      
      yield {
        type: 'status',
        content: '관련 문서 검색 중...',
        data: { timestamp: new Date().toISOString() }
      }

      // 2. 관련 문서 검색
      const searchResults = await this.pineconeService.query(
        embeddingResult.embedding,
        {
          topK: RAG_CONFIG.DEFAULT_TOP_K,
          scoreThreshold: RAG_CONFIG.DEFAULT_SCORE_THRESHOLD
        }
      )

      // 3. 검색 결과가 없으면 기본 응답
      if (searchResults.length === 0) {
        yield {
          type: 'token',
          content: RAG_MESSAGES.NO_RESULTS
        }
        
        yield {
          type: 'sources',
          data: []
        }
        
        yield { type: 'done' }
        return
      }

      // 4. RAG 컨텍스트 구성
      const context = this.buildContext(searchResults)
      
      yield {
        type: 'status',
        content: '답변 생성 중...',
        data: { timestamp: new Date().toISOString() }
      }

      // 5. OpenAI 스트리밍 요청
      const prompt = this.buildPrompt(request.message, context)
      const client = this.openaiClient.getClient()
      
      const stream = await client.chat.completions.create({
        model: OPENAI_MODELS.CHAT,
        messages: [
          {
            role: 'system',
            content: RAG_MESSAGES.SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: RAG_CONFIG.DEFAULT_TEMPERATURE,
        stream: true
      })

      // 6. 스트리밍 토큰 전송
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) {
          yield {
            type: 'token',
            content: content
          }
        }
      }

      // 7. 출처 정보 전송
      yield {
        type: 'sources',
        data: context.sources
      }

      // 8. 완료 신호
      yield {
        type: 'done',
        data: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      }

    } catch (error) {
      console.error('스트리밍 RAG 질의 처리 실패:', error)
      yield {
        type: 'error',
        content: `질의를 처리할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        data: { timestamp: new Date().toISOString() }
      }
    }
  }
}