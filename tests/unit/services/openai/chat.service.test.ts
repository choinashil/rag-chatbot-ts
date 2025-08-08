import { ChatService } from '../../../../src/services/openai/chat.service'
import { OpenAIClient } from '../../../../src/services/openai/openai.client'

// OpenAI 클라이언트 모킹
jest.mock('../../../../src/services/openai/openai.client')

const MockOpenAIClient = OpenAIClient as jest.MockedClass<typeof OpenAIClient>

describe('ChatService', () => {
  let chatService: ChatService
  let mockOpenAIClient: jest.Mocked<OpenAIClient>
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }

    mockOpenAIClient = {
      getClient: jest.fn().mockReturnValue(mockClient),
      getConfig: jest.fn().mockReturnValue({
        models: { chat: 'gpt-3.5-turbo' }
      })
    } as any

    chatService = new ChatService(mockOpenAIClient)
  })

  describe('generateResponse', () => {
    test('채팅 응답 생성 성공', async () => {
      const mockResponse = {
        choices: [{
          message: { content: '안녕하세요! 무엇을 도와드릴까요?' },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 15,
          total_tokens: 35
        }
      }

      mockClient.chat.completions.create.mockResolvedValue(mockResponse)

      const request = {
        messages: [
          { role: 'user' as const, content: '안녕하세요' }
        ]
      }

      const result = await chatService.generateResponse(request)

      expect(result).toEqual({
        content: '안녕하세요! 무엇을 도와드릴까요?',
        finishReason: 'stop',
        tokenUsage: {
          promptTokens: 20,
          completionTokens: 15,
          totalTokens: 35
        }
      })

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: request.messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    })

    test('사용자 지정 옵션으로 응답 생성', async () => {
      const mockResponse = {
        choices: [{
          message: { content: '테스트 응답' },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        }
      }

      mockClient.chat.completions.create.mockResolvedValue(mockResponse)

      const request = {
        messages: [
          { role: 'system' as const, content: '시스템 메시지' },
          { role: 'user' as const, content: '질문' }
        ],
        temperature: 0.3,
        maxTokens: 500
      }

      await chatService.generateResponse(request)

      expect(mockClient.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-3.5-turbo',
        messages: request.messages,
        temperature: 0.3,
        max_tokens: 500
      })
    })

    test('빈 응답 처리', async () => {
      const mockResponse = {
        choices: [{
          message: { content: null },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 }
      }

      mockClient.chat.completions.create.mockResolvedValue(mockResponse)

      const request = {
        messages: [{ role: 'user' as const, content: '테스트' }]
      }

      await expect(chatService.generateResponse(request)).rejects.toThrow(
        'OpenAI 응답에 내용이 없습니다'
      )
    })

    test('빈 선택지 배열 처리', async () => {
      const mockResponse = {
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 }
      }

      mockClient.chat.completions.create.mockResolvedValue(mockResponse)

      const request = {
        messages: [{ role: 'user' as const, content: '테스트' }]
      }

      await expect(chatService.generateResponse(request)).rejects.toThrow(
        'OpenAI 응답에 내용이 없습니다'
      )
    })

    test('API 호출 실패 처리', async () => {
      mockClient.chat.completions.create.mockRejectedValue(new Error('API 오류'))

      const request = {
        messages: [{ role: 'user' as const, content: '테스트' }]
      }

      await expect(chatService.generateResponse(request)).rejects.toThrow(
        '채팅 응답을 생성할 수 없습니다: API 오류'
      )
    })

    test('사용량 정보 없음 처리', async () => {
      const mockResponse = {
        choices: [{
          message: { content: '테스트 응답' },
          finish_reason: 'stop'
        }]
        // usage 정보 없음
      }

      mockClient.chat.completions.create.mockResolvedValue(mockResponse)

      const request = {
        messages: [{ role: 'user' as const, content: '테스트' }]
      }

      const result = await chatService.generateResponse(request)

      expect(result.tokenUsage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      })
    })

    test('finish_reason 없음 처리', async () => {
      const mockResponse = {
        choices: [{
          message: { content: '테스트 응답' }
          // finish_reason 없음
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      }

      mockClient.chat.completions.create.mockResolvedValue(mockResponse)

      const request = {
        messages: [{ role: 'user' as const, content: '테스트' }]
      }

      const result = await chatService.generateResponse(request)

      expect(result.finishReason).toBe('unknown')
    })
  })
})