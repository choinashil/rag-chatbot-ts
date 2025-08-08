import { PineconeClient } from '../../../../src/services/pinecone/pinecone.client'
import type { PineconeConfig } from '../../../../src/types/pinecone'

jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn().mockImplementation(() => ({
    index: jest.fn()
  }))
}))

describe('PineconeClient', () => {
  let pineconeClient: PineconeClient
  let mockPineconeInstance: any
  let mockIndex: any

  const testConfig: PineconeConfig = {
    apiKey: 'test-api-key',
    indexName: 'test-index'
  }

  beforeEach(() => {
    mockIndex = {
      describeIndexStats: jest.fn()
    }

    mockPineconeInstance = {
      index: jest.fn().mockReturnValue(mockIndex)
    }

    const { Pinecone } = require('@pinecone-database/pinecone')
    Pinecone.mockImplementation(() => mockPineconeInstance)

    pineconeClient = new PineconeClient(testConfig)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getIndex', () => {
    test('인덱스 인스턴스를 반환함', () => {
      const index = pineconeClient.getIndex()

      expect(mockPineconeInstance.index).toHaveBeenCalledWith('test-index')
      expect(index).toBe(mockIndex)
    })
  })

  describe('checkConnection', () => {
    test('연결 상태 확인이 성공적으로 수행됨', async () => {
      const mockStats = {
        totalRecordCount: 1000
      }
      mockIndex.describeIndexStats.mockResolvedValue(mockStats)

      const result = await pineconeClient.checkConnection()

      expect(result).toEqual({
        connected: true,
        indexName: 'test-index',
        vectorCount: 1000
      })
      expect(mockIndex.describeIndexStats).toHaveBeenCalled()
    })

    test('연결 실패 시 에러 정보를 포함한 결과를 반환함', async () => {
      const testError = new Error('연결 실패')
      mockIndex.describeIndexStats.mockRejectedValue(testError)

      const result = await pineconeClient.checkConnection()

      expect(result).toEqual({
        connected: false,
        indexName: 'test-index',
        error: '연결 실패'
      })
    })
  })

  describe('healthCheck', () => {
    test('헬스체크 성공 시 true를 반환함', async () => {
      mockIndex.describeIndexStats.mockResolvedValue({ totalRecordCount: 100 })

      const result = await pineconeClient.healthCheck()

      expect(result).toBe(true)
    })

    test('헬스체크 실패 시 false를 반환함', async () => {
      mockIndex.describeIndexStats.mockRejectedValue(new Error('API 오류'))

      const result = await pineconeClient.healthCheck()

      expect(result).toBe(false)
    })
  })
})