/**
 * SessionService 유닛 테스트
 * 세션 CRUD 및 생명주기 관리 테스트
 */

import { Pool, PoolClient } from 'pg'
import { SessionService } from '../../../../src/services/session/session.service'
import { SessionData, MessageData } from '../../../../src/types/session'
import * as databaseConfig from '../../../../src/config/database'

jest.mock('../../../../src/config/database', () => ({
  withTransaction: jest.fn()
}))
jest.mock('uuid', () => ({
  v4: jest.fn()
}))

describe('SessionService', () => {
  let sessionService: SessionService
  let mockPool: jest.Mocked<Pool>
  let mockClient: { query: jest.MockedFunction<any>; release: jest.MockedFunction<any> }

  beforeEach(() => {
    mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    }

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient)
    } as any

    sessionService = new SessionService(mockPool)

    const mockUuid = require('uuid')
    mockUuid.v4.mockReturnValue('mock-session-id')

    const mockWithTransaction = databaseConfig.withTransaction as jest.Mock
    mockWithTransaction.mockImplementation(async (pool: Pool, callback: (client: PoolClient) => Promise<any>) => {
      return await callback(mockClient as any)
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createSession', () => {
    test('새 세션을 성공적으로 생성해야 함', async () => {
      const sessionData: SessionData = {
        storeId: 'test-store',
        userId: 'test-user',
        metadata: {
          source: 'web',
          userAgent: 'test-agent'
        }
      }

      mockClient.query.mockResolvedValue({ rows: [], rowCount: 1 })

      const sessionId = await sessionService.createSession(sessionData)

      expect(sessionId).toBe('mock-session-id')
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_sessions'),
        [
          'mock-session-id',
          'test-store',
          'test-user',
          '{"source":"web","userAgent":"test-agent"}'
        ]
      )
    })

    test('메타데이터가 없는 경우 빈 객체로 처리해야 함', async () => {
      const sessionData: SessionData = {
        storeId: 'test-store',
        userId: 'test-user'
      }

      mockClient.query.mockResolvedValue({ rows: [], rowCount: 1 })

      await sessionService.createSession(sessionData)

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO chat_sessions'),
        [
          'mock-session-id',
          'test-store',
          'test-user',
          '{}'
        ]
      )
    })

    test('데이터베이스 에러 시 예외를 발생시켜야 함', async () => {
      const sessionData: SessionData = {
        storeId: 'test-store',
        userId: 'test-user'
      }

      const mockError = new Error('Database connection failed')
      mockClient.query.mockRejectedValue(mockError)

      await expect(sessionService.createSession(sessionData)).rejects.toThrow('Database connection failed')
    })
  })

  describe('getSessionContext', () => {
    test('세션 정보와 메시지를 성공적으로 조회해야 함', async () => {
      const sessionId = 'test-session-id'
      const mockSessionData = {
        id: sessionId,
        store_id: 'test-store',
        user_id: 'test-user',
        created_at: '2024-01-01T00:00:00Z',
        metadata: '{}'
      }
      const mockMessages = [
        {
          id: 'msg-1',
          role: 'user',
          content: '안녕하세요',
          sequence_number: 1,
          created_at: '2024-01-01T00:01:00Z'
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '안녕하세요! 도움을 드릴까요?',
          sequence_number: 2,
          created_at: '2024-01-01T00:01:30Z'
        }
      ]

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockSessionData] })
        .mockResolvedValueOnce({ rows: mockMessages.reverse() }) // DESC 순서로

      const result = await sessionService.getSessionContext(sessionId, 5)

      expect(result.session).toEqual(mockSessionData)
      expect(result.recentMessages).toHaveLength(2)
      expect(result.recentMessages[0].role).toBe('user')
      expect(result.recentMessages[1].role).toBe('assistant')
      expect(mockClient.release).toHaveBeenCalled()
    })

    test('세션이 존재하지 않으면 에러를 발생시켜야 함', async () => {
      const sessionId = 'non-existent-session'
      mockClient.query.mockResolvedValueOnce({ rows: [] })

      await expect(sessionService.getSessionContext(sessionId))
        .rejects.toThrow('세션을 찾을 수 없습니다: non-existent-session')
      
      expect(mockClient.release).toHaveBeenCalled()
    })

    test('메시지 제한 수를 올바르게 적용해야 함', async () => {
      const sessionId = 'test-session-id'
      const mockSessionData = { id: sessionId, store_id: 'test-store' }
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [mockSessionData] })
        .mockResolvedValueOnce({ rows: [] })

      await sessionService.getSessionContext(sessionId, 10)

      expect(mockClient.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('LIMIT $2'),
        [sessionId, 10]
      )
    })
  })

  describe('saveMessage', () => {
    test('메시지를 성공적으로 저장해야 함', async () => {
      const messageData: MessageData = {
        sessionId: 'test-session-id',
        role: 'user',
        content: '안녕하세요',
        tokenCount: 5,
        responseTimeMs: 100,
        langsmithTraceId: 'trace-123',
        metadata: { source: 'web' }
      }

      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // updateSessionActivity
        .mockResolvedValueOnce({ rows: [{ id: 'mock-message-id' }] }) // saveMessage

      const messageId = await sessionService.saveMessage(messageData)

      expect(messageId).toBe('mock-message-id')
      expect(mockClient.query).toHaveBeenCalledTimes(2)
      
      // 첫 번째 호출: 세션 활성화 시간 업데이트
      expect(mockClient.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining('UPDATE chat_sessions'),
        ['test-session-id']
      )
      
      // 두 번째 호출: 메시지 저장
      expect(mockClient.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('INSERT INTO chat_messages'),
        [
          'mock-session-id',
          'test-session-id',
          'user',
          '안녕하세요',
          5,
          100,
          'trace-123',
          undefined,
          '{"source":"web"}'
        ]
      )
    })

    test('옵션 필드들이 없어도 정상 처리되어야 함', async () => {
      const messageData: MessageData = {
        sessionId: 'test-session-id',
        role: 'assistant',
        content: '안녕하세요!'
      }

      mockClient.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: 'mock-message-id' }] })

      const messageId = await sessionService.saveMessage(messageData)

      expect(messageId).toBe('mock-message-id')
      expect(mockClient.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining('INSERT INTO chat_messages'),
        [
          'mock-session-id',
          'test-session-id',
          'assistant',
          '안녕하세요!',
          undefined,
          undefined,
          undefined,
          undefined,
          '{}'
        ]
      )
    })
  })

  describe('cleanupExpiredSessions', () => {
    test('만료된 세션 정리를 성공적으로 수행해야 함', async () => {
      mockClient.query.mockResolvedValue({ 
        rows: [{ cleaned_count: 5 }] 
      })

      const result = await sessionService.cleanupExpiredSessions()

      expect(result).toBe(5)
      expect(mockClient.query).toHaveBeenCalledWith(`
        SELECT cleanup_expired_sessions() as cleaned_count
      `)
      expect(mockClient.release).toHaveBeenCalled()
    })

    test('정리할 세션이 없으면 0을 반환해야 함', async () => {
      mockClient.query.mockResolvedValue({ 
        rows: [{ cleaned_count: 0 }] 
      })

      const result = await sessionService.cleanupExpiredSessions()

      expect(result).toBe(0)
    })
  })

  describe('hardDeleteOldData', () => {
    test('오래된 데이터 완전 삭제를 성공적으로 수행해야 함', async () => {
      mockClient.query.mockResolvedValue({ 
        rows: [{ deleted_count: 3 }] 
      })

      const result = await sessionService.hardDeleteOldData()

      expect(result).toBe(3)
      expect(mockClient.query).toHaveBeenCalledWith(`
        SELECT hard_delete_old_data() as deleted_count
      `)
      expect(mockClient.release).toHaveBeenCalled()
    })
  })
})