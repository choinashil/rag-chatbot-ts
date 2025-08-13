import { PineconeService } from '../../../../src/services/vector/pinecone.service'
import { PineconeClient } from '../../../../src/services/vector/pinecone.client'
import type { VectorData } from '../../../../src/types/pinecone'

jest.mock('../../../../src/services/vector/pinecone.client')
const MockPineconeClient = PineconeClient as jest.MockedClass<typeof PineconeClient>

describe('PineconeService', () => {
  let pineconeService: PineconeService
  let mockClient: jest.Mocked<PineconeClient>
  let mockIndex: any

  beforeEach(() => {
    mockIndex = {
      upsert: jest.fn(),
      query: jest.fn(),
      deleteOne: jest.fn()
    }

    mockClient = {
      getIndex: jest.fn().mockReturnValue(mockIndex),
      checkConnection: jest.fn(),
      healthCheck: jest.fn()
    } as any

    MockPineconeClient.mockImplementation(() => mockClient)
    pineconeService = new PineconeService(mockClient)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('upsert', () => {
    test('벡터 데이터 저장이 성공적으로 수행됨', async () => {
      const vectorData: VectorData = {
        id: 'test-document-1',
        vector: new Array(1536).fill(0.1),
        metadata: {
          title: '테스트 문서',
          content: '테스트 내용입니다.',
          source: 'test',
          timestamp: '2025-01-01T00:00:00Z'
        }
      }

      mockIndex.upsert.mockResolvedValue(undefined)

      await expect(pineconeService.upsert(vectorData)).resolves.toBeUndefined()
      
      expect(mockClient.getIndex).toHaveBeenCalled()
      expect(mockIndex.upsert).toHaveBeenCalledWith([{
        id: 'test-document-1',
        values: vectorData.vector,
        metadata: {
          title: '테스트 문서',
          content: '테스트 내용입니다.',
          source: 'test',
          timestamp: '2025-01-01T00:00:00Z'
        }
      }])
    })

    test('벡터 저장 실패 시 에러가 발생함', async () => {
      const vectorData: VectorData = {
        id: 'test-document-1',
        vector: new Array(1536).fill(0.1),
        metadata: {
          title: '테스트 문서',
          content: '테스트 내용',
          source: 'test'
        }
      }

      const testError = new Error('Pinecone API 오류')
      mockIndex.upsert.mockRejectedValue(testError)

      await expect(pineconeService.upsert(vectorData)).rejects.toThrow('벡터 저장에 실패했습니다: Pinecone API 오류')
    })
  })

  describe('query', () => {
    test('벡터 검색이 성공적으로 수행됨', async () => {
      const queryVector = new Array(1536).fill(0.1)
      const mockResult = {
        matches: [
          {
            id: 'doc-1',
            score: 0.95,
            metadata: {
              title: '검색 결과 1',
              content: '검색된 내용 1',
              source: 'test',
              timestamp: '2025-01-01T00:00:00Z'
            }
          }
        ]
      }

      mockIndex.query.mockResolvedValue(mockResult)

      const result = await pineconeService.query(queryVector)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'doc-1',
        score: 0.95,
        metadata: {
          title: '검색 결과 1',
          content: '검색된 내용 1',
          source: 'test',
          timestamp: '2025-01-01T00:00:00Z'
        }
      })
      expect(mockIndex.query).toHaveBeenCalledWith({
        vector: queryVector,
        topK: 5,
        includeMetadata: true
      })
    })

    test('점수 임계값 이하 결과는 필터링됨', async () => {
      const queryVector = new Array(1536).fill(0.1)
      const mockResult = {
        matches: [
          {
            id: 'doc-1',
            score: 0.95,
            metadata: { title: '높은 점수', content: '', source: '', timestamp: '' }
          },
          {
            id: 'doc-2',
            score: 0.3,
            metadata: { title: '낮은 점수', content: '', source: '', timestamp: '' }
          }
        ]
      }

      mockIndex.query.mockResolvedValue(mockResult)

      const result = await pineconeService.query(queryVector, { 
        scoreThreshold: 0.5 
      })

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('doc-1')
    })

    test('벡터 검색 실패 시 에러가 발생함', async () => {
      const queryVector = new Array(1536).fill(0.1)
      const testError = new Error('검색 API 오류')
      
      mockIndex.query.mockRejectedValue(testError)

      await expect(pineconeService.query(queryVector)).rejects.toThrow('벡터 검색에 실패했습니다: 검색 API 오류')
    })
  })

  describe('deleteDocument', () => {
    test('문서 삭제가 성공적으로 수행됨', async () => {
      mockIndex.deleteOne.mockResolvedValue(undefined)

      await expect(pineconeService.deleteDocument('test-doc-1')).resolves.toBeUndefined()
      
      expect(mockClient.getIndex).toHaveBeenCalled()
      expect(mockIndex.deleteOne).toHaveBeenCalledWith('test-doc-1')
    })

    test('문서 삭제 실패 시 에러가 발생함', async () => {
      const testError = new Error('삭제 API 오류')
      mockIndex.deleteOne.mockRejectedValue(testError)

      await expect(pineconeService.deleteDocument('test-doc-1')).rejects.toThrow('문서 삭제에 실패했습니다: 삭제 API 오류')
    })
  })

  describe('healthCheck', () => {
    test('헬스체크가 클라이언트로 위임됨', async () => {
      mockClient.healthCheck.mockResolvedValue(true)

      const result = await pineconeService.healthCheck()

      expect(result).toBe(true)
      expect(mockClient.healthCheck).toHaveBeenCalled()
    })
  })
})