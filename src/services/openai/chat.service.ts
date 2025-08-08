import { OpenAIClient } from './openai.client'
import { OPENAI_DEFAULTS } from '../../constants'

export interface ChatRequest {
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  temperature?: number
  maxTokens?: number
}

export interface ChatResponse {
  content: string
  finishReason: string
  tokenUsage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export class ChatService {
  constructor(private openaiClient: OpenAIClient) {}

  async generateResponse(request: ChatRequest): Promise<ChatResponse> {
    try {
      const client = this.openaiClient.getClient()
      
      const response = await client.chat.completions.create({
        model: this.openaiClient.getConfig().models.chat,
        messages: request.messages,
        temperature: request.temperature ?? OPENAI_DEFAULTS.CHAT_TEMPERATURE,
        max_tokens: request.maxTokens ?? OPENAI_DEFAULTS.CHAT_MAX_TOKENS
      })

      const choice = response.choices[0]
      if (!choice || !choice.message.content) {
        throw new Error('OpenAI 응답에 내용이 없습니다')
      }

      return {
        content: choice.message.content,
        finishReason: choice.finish_reason || 'unknown',
        tokenUsage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        }
      }
    } catch (error) {
      console.error('채팅 응답 생성 실패:', error)
      throw new Error(`채팅 응답을 생성할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }
}