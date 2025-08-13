/**
 * LLMService 단위 테스트
 * 순수 LLM 기능 테스트
 */

import { LLMService } from '../../../../src/services/llm/llm.service'
import { ChatOpenAI } from '@langchain/openai'

// ChatOpenAI 모킹
jest.mock('@langchain/openai')
const MockChatOpenAI = ChatOpenAI as jest.MockedClass<typeof ChatOpenAI>

const mockConsoleError = jest.spyOn(console, 'error').mockImplementation()

describe('LLMService', () => {
  let llmService: LLMService
  let mockChatModel: jest.Mocked<ChatOpenAI>
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    process.env.OPENAI_API_KEY = 'test-api-key'

    // ChatOpenAI 모킹
    mockChatModel = {
      invoke: jest.fn()
    } as any

    MockChatOpenAI.mockImplementation(() => mockChatModel)

    llmService = new LLMService()
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('초기화', () => {
    test('OPENAI_API_KEY가 설정된 경우 정상 초기화되어야 함', () => {
      expect(() => new LLMService()).not.toThrow()
      expect(MockChatOpenAI).toHaveBeenCalledWith({
        modelName: expect.any(String),
        temperature: expect.any(Number),
        apiKey: 'test-api-key'
      })
    })

    test('OPENAI_API_KEY가 없으면 에러를 던져야 함', () => {
      delete process.env.OPENAI_API_KEY

      expect(() => new LLMService()).toThrow('OPENAI_API_KEY가 설정되지 않았습니다')
    })
  })

  describe('getChatModel', () => {
    test('ChatModel 인스턴스를 반환해야 함', () => {
      const chatModel = llmService.getChatModel()
      
      expect(chatModel).toBe(mockChatModel)
    })
  })

  describe('generate', () => {
    test('단순 문자열 응답을 올바르게 반환해야 함', async () => {
      const mockResponse = { content: '테스트 응답' } as any
      mockChatModel.invoke.mockResolvedValue(mockResponse)

      const result = await llmService.generate('테스트 질문')

      expect(mockChatModel.invoke).toHaveBeenCalledWith([
        { role: 'user', content: '테스트 질문' }
      ])
      expect(result).toBe('테스트 응답')
    })

    test('복잡한 content 타입도 문자열로 변환해야 함', async () => {
      const mockResponse = { content: { text: '복잡한 응답' } } as any
      mockChatModel.invoke.mockResolvedValue(mockResponse)

      const result = await llmService.generate('테스트 질문')

      expect(result).toBe('[object Object]')
    })

    test('배열 content도 문자열로 변환해야 함', async () => {
      const mockResponse = { content: ['응답1', '응답2'] } as any
      mockChatModel.invoke.mockResolvedValue(mockResponse)

      const result = await llmService.generate('테스트 질문')

      expect(result).toBe('응답1,응답2')
    })

    test('API 에러 시 에러가 전파되어야 함', async () => {
      mockChatModel.invoke.mockRejectedValue(new Error('API 에러'))

      await expect(llmService.generate('테스트 질문')).rejects.toThrow('API 에러')
    })
  })

  describe('generateWithMessages', () => {
    test('메시지 배열로 응답 생성해야 함', async () => {
      const messages = [
        { role: 'system', content: '시스템 메시지' },
        { role: 'user', content: '사용자 질문' }
      ]
      const mockResponse = { content: '메시지 응답' } as any
      mockChatModel.invoke.mockResolvedValue(mockResponse)

      const result = await llmService.generateWithMessages(messages)

      expect(mockChatModel.invoke).toHaveBeenCalledWith(messages)
      expect(result).toBe('메시지 응답')
    })

    test('빈 메시지 배열도 처리해야 함', async () => {
      const mockResponse = { content: '빈 배열 응답' } as any
      mockChatModel.invoke.mockResolvedValue(mockResponse)

      const result = await llmService.generateWithMessages([])

      expect(mockChatModel.invoke).toHaveBeenCalledWith([])
      expect(result).toBe('빈 배열 응답')
    })

    test('복잡한 content 타입도 문자열로 변환해야 함', async () => {
      const messages = [{ role: 'user', content: '질문' }]
      const mockResponse = { content: { type: 'complex', data: '데이터' } } as any
      mockChatModel.invoke.mockResolvedValue(mockResponse)

      const result = await llmService.generateWithMessages(messages)

      expect(typeof result).toBe('string')
    })
  })

  describe('에러 처리', () => {
    test('ChatModel 초기화 실패 시 적절한 에러 메시지를 제공해야 함', () => {
      MockChatOpenAI.mockImplementation(() => {
        throw new Error('초기화 실패')
      })

      expect(() => new LLMService()).toThrow('초기화 실패')
    })

    test('invoke 호출 실패 시 원본 에러를 전파해야 함', async () => {
      const originalError = new Error('OpenAI API 에러')
      mockChatModel.invoke.mockRejectedValue(originalError)

      await expect(llmService.generate('테스트')).rejects.toBe(originalError)
    })
  })

  describe('환경변수 처리', () => {
    test('OPENAI_API_KEY가 빈 문자열이면 에러를 던져야 함', () => {
      process.env.OPENAI_API_KEY = ''

      expect(() => new LLMService()).toThrow('OPENAI_API_KEY가 설정되지 않았습니다')
    })

    test('OPENAI_API_KEY가 공백만 있어도 정상 작동해야 함 (실제 구현)', () => {
      process.env.OPENAI_API_KEY = '   '

      // 실제로는 공백 문자열도 유효한 API 키로 간주함 (OpenAI에서 검증)
      expect(() => new LLMService()).not.toThrow()
    })
  })
})