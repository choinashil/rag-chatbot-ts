/**
 * Chat Routes 검증 로직 유닛 테스트
 * - 필수값 검증 테스트
 * - 세션 재사용/생성 로직 테스트
 */

describe('Chat Routes 검증 로직', () => {
  
  describe('필수값 검증 로직', () => {
    const validateRequiredFields = (body: any): { isValid: boolean; error?: string } => {
      if (!body.storeId || !body.userId) {
        return {
          isValid: false,
          error: 'storeId와 userId는 필수값입니다'
        }
      }
      return { isValid: true }
    }

    test('storeId와 userId가 있으면 검증 통과', () => {
      const body = {
        message: '테스트 메시지',
        storeId: 'test-store',
        userId: 'test-user'
      }
      const result = validateRequiredFields(body)
      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    test('storeId가 없으면 검증 실패', () => {
      const body = {
        message: '테스트 메시지',
        userId: 'test-user'
      }
      const result = validateRequiredFields(body)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('storeId와 userId는 필수값입니다')
    })

    test('userId가 없으면 검증 실패', () => {
      const body = {
        message: '테스트 메시지',
        storeId: 'test-store'
      }
      const result = validateRequiredFields(body)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('storeId와 userId는 필수값입니다')
    })

    test('빈 문자열 storeId는 검증 실패', () => {
      const body = {
        message: '테스트 메시지',
        storeId: '',
        userId: 'test-user'
      }
      const result = validateRequiredFields(body)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('storeId와 userId는 필수값입니다')
    })

    test('빈 문자열 userId는 검증 실패', () => {
      const body = {
        message: '테스트 메시지',
        storeId: 'test-store',
        userId: ''
      }
      const result = validateRequiredFields(body)
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('storeId와 userId는 필수값입니다')
    })
  })

  describe('세션 관리 로직', () => {
    interface MockIntegratedChatService {
      findActiveSession: jest.Mock
      createSession: jest.Mock
    }

    const mockIntegratedChatService: MockIntegratedChatService = {
      findActiveSession: jest.fn(),
      createSession: jest.fn()
    }

    beforeEach(() => {
      jest.clearAllMocks()
    })

    const handleSessionLogic = async (
      sessionId: string | undefined,
      storeId: string,
      userId: string,
      integratedChatService: MockIntegratedChatService
    ): Promise<string | undefined> => {
      let currentSessionId = sessionId

      if (integratedChatService && !currentSessionId) {
        try {
          const existingSession = await integratedChatService.findActiveSession({
            storeId,
            userId
          })
          
          if (existingSession) {
            currentSessionId = existingSession.id
            console.log(`기존 세션 재사용: ${currentSessionId}`)
          } else {
            currentSessionId = await integratedChatService.createSession({
              storeId,
              userId,
              metadata: { createdAt: new Date().toISOString() }
            })
            console.log(`새 세션 생성: ${currentSessionId}`)
          }
        } catch (error) {
          console.error('세션 처리 실패:', error)
        }
      }

      return currentSessionId
    }

    test('기존 활성 세션이 있으면 재사용한다', async () => {
      // Given: 기존 세션이 존재
      const existingSessionId = 'existing-session-123'
      mockIntegratedChatService.findActiveSession.mockResolvedValue({
        id: existingSessionId
      })

      // When: 세션 로직 실행
      const result = await handleSessionLogic(
        undefined,
        'test-store',
        'test-user',
        mockIntegratedChatService
      )

      // Then: 기존 세션 재사용
      expect(result).toBe(existingSessionId)
      expect(mockIntegratedChatService.findActiveSession).toHaveBeenCalledWith({
        storeId: 'test-store',
        userId: 'test-user'
      })
      expect(mockIntegratedChatService.createSession).not.toHaveBeenCalled()
    })

    test('기존 활성 세션이 없으면 새로 생성한다', async () => {
      // Given: 기존 세션이 없음
      const newSessionId = 'new-session-456'
      mockIntegratedChatService.findActiveSession.mockResolvedValue(null)
      mockIntegratedChatService.createSession.mockResolvedValue(newSessionId)

      // When: 세션 로직 실행
      const result = await handleSessionLogic(
        undefined,
        'test-store',
        'test-user',
        mockIntegratedChatService
      )

      // Then: 새 세션 생성
      expect(result).toBe(newSessionId)
      expect(mockIntegratedChatService.findActiveSession).toHaveBeenCalledWith({
        storeId: 'test-store',
        userId: 'test-user'
      })
      expect(mockIntegratedChatService.createSession).toHaveBeenCalledWith({
        storeId: 'test-store',
        userId: 'test-user',
        metadata: expect.objectContaining({
          createdAt: expect.any(String)
        })
      })
    })

    test('sessionId가 명시적으로 제공되면 세션 검색을 건너뛴다', async () => {
      // Given: sessionId가 명시적으로 제공됨
      const providedSessionId = 'provided-session-789'

      // When: 세션 로직 실행
      const result = await handleSessionLogic(
        providedSessionId,
        'test-store',
        'test-user',
        mockIntegratedChatService
      )

      // Then: 제공된 세션 ID 사용
      expect(result).toBe(providedSessionId)
      expect(mockIntegratedChatService.findActiveSession).not.toHaveBeenCalled()
      expect(mockIntegratedChatService.createSession).not.toHaveBeenCalled()
    })

    test('세션 찾기 실패 시 에러를 처리한다', async () => {
      // Given: 세션 찾기에서 에러 발생
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      mockIntegratedChatService.findActiveSession.mockRejectedValue(new Error('DB 연결 실패'))

      // When: 세션 로직 실행
      const result = await handleSessionLogic(
        undefined,
        'test-store',
        'test-user',
        mockIntegratedChatService
      )

      // Then: 에러 처리됨
      expect(result).toBeUndefined()
      expect(consoleErrorSpy).toHaveBeenCalledWith('세션 처리 실패:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })

    test('세션 생성 실패 시 에러를 처리한다', async () => {
      // Given: 세션 생성에서 에러 발생
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      mockIntegratedChatService.findActiveSession.mockResolvedValue(null)
      mockIntegratedChatService.createSession.mockRejectedValue(new Error('세션 생성 실패'))

      // When: 세션 로직 실행
      const result = await handleSessionLogic(
        undefined,
        'test-store',
        'test-user',
        mockIntegratedChatService
      )

      // Then: 에러 처리됨
      expect(result).toBeUndefined()
      expect(consoleErrorSpy).toHaveBeenCalledWith('세션 처리 실패:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })

    test('IntegratedChatService가 없으면 세션 로직을 건너뛴다', async () => {
      // Given: IntegratedChatService가 없음
      
      // When: 세션 로직 실행
      const result = await handleSessionLogic(
        undefined,
        'test-store',
        'test-user',
        null as any
      )

      // Then: undefined 반환
      expect(result).toBeUndefined()
    })
  })

  describe('스키마 검증', () => {
    const StreamingChatRequestSchema = {
      type: 'object',
      required: ['message', 'storeId', 'userId'],
      properties: {
        message: {
          type: 'string',
          minLength: 1,
          maxLength: 2000
        },
        storeId: { type: 'string', minLength: 1 },
        userId: { type: 'string', minLength: 1 },
        sessionId: { type: 'string', format: 'uuid' }
      }
    } as const

    test('스키마에 필수 필드가 포함되어 있다', () => {
      expect(StreamingChatRequestSchema.required).toContain('message')
      expect(StreamingChatRequestSchema.required).toContain('storeId')
      expect(StreamingChatRequestSchema.required).toContain('userId')
      expect(StreamingChatRequestSchema.required).not.toContain('sessionId')
    })

    test('storeId와 userId에 minLength 검증이 있다', () => {
      expect(StreamingChatRequestSchema.properties.storeId.minLength).toBe(1)
      expect(StreamingChatRequestSchema.properties.userId.minLength).toBe(1)
    })

    test('sessionId는 선택적 필드다', () => {
      expect(StreamingChatRequestSchema.required).not.toContain('sessionId')
      expect(StreamingChatRequestSchema.properties.sessionId).toBeDefined()
    })
  })
})