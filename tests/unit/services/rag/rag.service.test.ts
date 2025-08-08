import { RAGService } from '../../../../src/services/rag/rag.service'
import { EmbeddingService } from '../../../../src/services/openai/embedding.service'
import { PineconeService } from '../../../../src/services/pinecone/pinecone.service'
import { ChatService } from '../../../../src/services/openai/chat.service'
import type { EmbeddingResult } from '../../../../src/types/embedding'
import type { SearchResult } from '../../../../src/types/pinecone'

// 서비스 모킹
jest.mock('../../../../src/services/openai/embedding.service')
jest.mock('../../../../src/services/pinecone/pinecone.service')
jest.mock('../../../../src/services/openai/chat.service')

const MockEmbeddingService = EmbeddingService as jest.MockedClass<typeof EmbeddingService>
const MockPineconeService = PineconeService as jest.MockedClass<typeof PineconeService>
const MockChatService = ChatService as jest.MockedClass<typeof ChatService>

describe('RAGService', () => {
  let ragService: RAGService
  let mockEmbeddingService: jest.Mocked<EmbeddingService>
  let mockPineconeService: jest.Mocked<PineconeService>
  let mockChatService: jest.Mocked<ChatService>

  beforeEach(() => {
    mockEmbeddingService = {
      createEmbedding: jest.fn()
    } as any

    mockPineconeService = {
      query: jest.fn()
    } as any

    mockChatService = {
      generateResponse: jest.fn()
    } as any

    ragService = new RAGService(
      mockEmbeddingService,
      mockPineconeService,
      mockChatService
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('askQuestion', () => {
    test('성공적인 RAG 질의응답 플로우', async () => {
      // Mock 데이터 준비
      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 5,
        model: 'text-embedding-3-small',
        text: '배너 설정 방법을 알려주세요'
      }

      const mockSearchResults: SearchResult[] = [
        {
          id: 'notion-page-1',
          score: 0.95,
          metadata: {
            title: '배너 설정하기',
            content: '배너는 설정 메뉴에서 변경할 수 있습니다.',
            source: 'notion',
            timestamp: '2025-08-08T09:00:00Z'
          }
        }
      ]

      const mockChatResponse = {
        content: '배너는 설정 메뉴에서 변경하실 수 있습니다. 자세한 내용은 "배너 설정하기" 문서를 참고해주세요.',
        finishReason: 'stop',
        tokenUsage: {
          promptTokens: 150,
          completionTokens: 50,
          totalTokens: 200
        }
      }

      // Mock 설정
      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.query.mockResolvedValue(mockSearchResults)
      mockChatService.generateResponse.mockResolvedValue(mockChatResponse)

      // 테스트 실행
      const request = { question: '배너 설정 방법을 알려주세요' }
      const result = await ragService.askQuestion(request)

      // 검증
      expect(mockEmbeddingService.createEmbedding).toHaveBeenCalledWith('배너 설정 방법을 알려주세요')
      expect(mockPineconeService.query).toHaveBeenCalledWith(
        mockEmbeddingResult.embedding,
        {
          topK: 3,
          scoreThreshold: 0.3
        }
      )
      expect(mockChatService.generateResponse).toHaveBeenCalledWith({
        messages: [
          {
            role: 'system',
            content: '당신은 제공된 문서를 바탕으로 정확하고 도움이 되는 답변을 제공하는 AI 어시스턴트입니다.'
          },
          {
            role: 'user',
            content: expect.stringContaining('배너 설정하기')
          }
        ],
        temperature: 0.3
      })

      expect(result).toEqual({
        answer: mockChatResponse.content,
        sources: [
          {
            id: 'notion-page-1',
            title: '배너 설정하기',
            content: '배너는 설정 메뉴에서 변경할 수 있습니다.',
            score: 0.95,
            url: undefined
          }
        ],
        metadata: {
          totalSources: 1,
          processingTime: expect.any(Number),
          model: 'gpt-3.5-turbo',
          timestamp: expect.any(String)
        }
      })
    })

    test('사용자 지정 옵션으로 질의', async () => {
      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 3,
        model: 'text-embedding-3-small',
        text: '테스트 질문'
      }

      const mockSearchResults: SearchResult[] = []

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.query.mockResolvedValue(mockSearchResults)

      const request = {
        question: '테스트 질문',
        maxResults: 5,
        scoreThreshold: 0.8
      }

      const result = await ragService.askQuestion(request)

      expect(mockPineconeService.query).toHaveBeenCalledWith(
        mockEmbeddingResult.embedding,
        {
          topK: 5,
          scoreThreshold: 0.8
        }
      )

      // 검색 결과가 없을 때 기본 응답
      expect(result.answer).toBe('죄송합니다. 관련된 정보를 찾을 수 없습니다. 다른 질문을 시도해보세요.')
      expect(result.sources).toHaveLength(0)
    })

    test('검색 결과 없을 때 기본 응답', async () => {
      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 3,
        model: 'text-embedding-3-small',
        text: '존재하지 않는 질문'
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.query.mockResolvedValue([])

      const request = { question: '존재하지 않는 질문' }
      const result = await ragService.askQuestion(request)

      expect(result.answer).toBe('죄송합니다. 관련된 정보를 찾을 수 없습니다. 다른 질문을 시도해보세요.')
      expect(result.sources).toHaveLength(0)
      expect(result.metadata.totalSources).toBe(0)
      
      // ChatService가 호출되지 않아야 함
      expect(mockChatService.generateResponse).not.toHaveBeenCalled()
    })

    test('여러 문서가 검색된 경우', async () => {
      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 5,
        model: 'text-embedding-3-small',
        text: '설정 방법'
      }

      const mockSearchResults: SearchResult[] = [
        {
          id: 'notion-page-1',
          score: 0.95,
          metadata: {
            title: '기본 설정',
            content: '기본 설정 방법입니다.',
            source: 'notion',
            url: 'https://notion.so/page1'
          }
        },
        {
          id: 'notion-page-2',
          score: 0.85,
          metadata: {
            title: '고급 설정',
            content: '고급 설정 방법입니다.',
            source: 'notion'
          }
        }
      ]

      const mockChatResponse = {
        content: '설정에는 기본 설정과 고급 설정이 있습니다.',
        finishReason: 'stop',
        tokenUsage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 }
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.query.mockResolvedValue(mockSearchResults)
      mockChatService.generateResponse.mockResolvedValue(mockChatResponse)

      const request = { question: '설정 방법' }
      const result = await ragService.askQuestion(request)

      expect(result.sources).toHaveLength(2)
      expect(result.sources[0]).toEqual({
        id: 'notion-page-1',
        title: '기본 설정',
        content: '기본 설정 방법입니다.',
        score: 0.95,
        url: 'https://notion.so/page1'
      })
      expect(result.sources[1]).toEqual({
        id: 'notion-page-2',
        title: '고급 설정',
        content: '고급 설정 방법입니다.',
        score: 0.85,
        url: undefined
      })
      expect(result.metadata.totalSources).toBe(2)
    })

    test('임베딩 생성 실패 시 에러 전파', async () => {
      mockEmbeddingService.createEmbedding.mockRejectedValue(new Error('임베딩 생성 실패'))

      const request = { question: '테스트 질문' }

      await expect(ragService.askQuestion(request)).rejects.toThrow(
        '질의를 처리할 수 없습니다: 임베딩 생성 실패'
      )

      expect(mockPineconeService.query).not.toHaveBeenCalled()
      expect(mockChatService.generateResponse).not.toHaveBeenCalled()
    })

    test('벡터 검색 실패 시 에러 전파', async () => {
      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 3,
        model: 'text-embedding-3-small',
        text: '테스트'
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.query.mockRejectedValue(new Error('벡터 검색 실패'))

      const request = { question: '테스트 질문' }

      await expect(ragService.askQuestion(request)).rejects.toThrow(
        '질의를 처리할 수 없습니다: 벡터 검색 실패'
      )

      expect(mockChatService.generateResponse).not.toHaveBeenCalled()
    })

    test('채팅 응답 생성 실패 시 에러 전파', async () => {
      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 3,
        model: 'text-embedding-3-small',
        text: '테스트'
      }

      const mockSearchResults: SearchResult[] = [
        {
          id: 'test-1',
          score: 0.9,
          metadata: { title: '테스트', content: '테스트 내용', source: 'notion' }
        }
      ]

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.query.mockResolvedValue(mockSearchResults)
      mockChatService.generateResponse.mockRejectedValue(new Error('채팅 응답 실패'))

      const request = { question: '테스트 질문' }

      await expect(ragService.askQuestion(request)).rejects.toThrow(
        '질의를 처리할 수 없습니다: 채팅 응답 실패'
      )
    })

    test('메타데이터에 제목이 없는 경우 기본값 사용', async () => {
      const mockEmbeddingResult: EmbeddingResult = {
        embedding: new Array(1536).fill(0.1),
        tokenCount: 3,
        model: 'text-embedding-3-small',
        text: '테스트'
      }

      // Pinecone에서 반환하는 메타데이터에는 title이 빈 문자열로 올 수 있음
      const mockSearchResults = [
        {
          id: 'test-1',
          score: 0.9,
          metadata: {
            title: '', // 빈 제목
            content: '내용만 있는 문서',
            source: 'notion'
          }
        }
      ] as any[] // any로 캐스팅하여 타입 에러 회피

      const mockChatResponse = {
        content: '테스트 응답',
        finishReason: 'stop',
        tokenUsage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 }
      }

      mockEmbeddingService.createEmbedding.mockResolvedValue(mockEmbeddingResult)
      mockPineconeService.query.mockResolvedValue(mockSearchResults)
      mockChatService.generateResponse.mockResolvedValue(mockChatResponse)

      const request = { question: '테스트 질문' }
      const result = await ragService.askQuestion(request)

      expect(result.sources[0]?.title).toBe('제목 없음')
    })
  })
})