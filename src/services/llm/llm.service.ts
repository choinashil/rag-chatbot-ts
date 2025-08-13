/**
 * LLM (Large Language Model) 서비스
 * 순수 LLM 기능만 제공 - ChatModel 관리 전담
 */

import { ChatOpenAI } from '@langchain/openai'
import { RAG_CONFIG, OPENAI_MODELS } from '../../constants'

export interface LLMServiceInterface {
  generate(prompt: string): Promise<string>
  generateWithMessages(messages: any[]): Promise<string>
  getChatModel(): ChatOpenAI
}

export class LLMService implements LLMServiceInterface {
  private chatModel!: ChatOpenAI

  constructor() {
    this.initializeChatModel()
  }

  /**
   * OpenAI 채팅 모델 초기화
   */
  private initializeChatModel(): void {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다')
    }

    this.chatModel = new ChatOpenAI({
      modelName: OPENAI_MODELS.CHAT,
      temperature: RAG_CONFIG.DEFAULT_TEMPERATURE,
      apiKey: apiKey
    })
  }

  /**
   * 순수 LLM 기능: 프롬프트 → 답변
   */
  async generate(prompt: string): Promise<string> {
    const response = await this.chatModel.invoke([
      { role: 'user', content: prompt }
    ])
    return typeof response.content === 'string' ? response.content : String(response.content)
  }

  /**
   * 메시지 기반 생성
   */
  async generateWithMessages(messages: any[]): Promise<string> {
    const response = await this.chatModel.invoke(messages)
    return typeof response.content === 'string' ? response.content : String(response.content)
  }

  /**
   * LangChain 체인용 ChatModel 반환
   */
  getChatModel(): ChatOpenAI {
    return this.chatModel
  }
}