# IntegratedChatService 아키텍처 설계

> 채팅 관련 서비스들을 통합 관리하는 파사드 패턴 구현

## 1. 개요

IntegratedChatService는 세션 관리, 채팅 분석, LLM 모니터링 등 채팅과 관련된 모든 기능을 하나의 통합 인터페이스로 제공하는 서비스 레이어입니다.

## 2. 아키텍처 계층 구조

```
API Layer (chat.routes.ts)
    ↓ (단일 의존성)
Application Layer (IntegratedChatService) ← 파사드 패턴
    ↓ (내부 의존성들)
Domain Services
    ├─ SessionService (PostgreSQL 세션/메시지 관리)
    ├─ ChatAnalyticsService (채팅 통계 분석)  
    └─ LLMMonitoringService (LangSmith 추적)
    ↓
Data Layer (PostgreSQL, LangSmith)
```

## 3. 설계 목적 및 장점

### 3.1 파사드 패턴 적용
- **단일 접점**: API 레이어에서 하나의 서비스만 의존
- **복잡성 은닉**: 3개 하위 서비스의 복잡한 조율 로직을 내부에 캡슐화
- **인터페이스 단순화**: API는 비즈니스 로직 대신 HTTP 처리에만 집중

### 3.2 트랜잭션 및 일관성 관리
```typescript
async logChatInteraction(data: ChatInteractionData): Promise<void> {
  try {
    // 1️⃣ 핵심 기능: PostgreSQL 저장 (실패 시 전체 실패)
    const userMessageId = await this.sessionService.saveMessage(...)
    const assistantMessageId = await this.sessionService.saveMessage(...)
    
    // 2️⃣ 부가 기능: LangSmith 추적 (실패해도 핵심 기능 보존)
    this.monitoringService.trackAIInteraction(...).catch(error => {
      console.error('❌ LangSmith 추적 실패 (PostgreSQL은 보존됨):', error)
    })
  } catch (error) {
    // 핵심 실패만 상위로 전파
    throw error
  }
}
```

### 3.3 에러 처리 전략
- **핵심 vs 부가 기능 분리**: PostgreSQL 저장은 필수, LangSmith 추적은 선택
- **부분 실패 허용**: LangSmith 실패가 전체 채팅 기능을 중단시키지 않음
- **복구 가능성**: 각 서비스별 독립적인 에러 처리 및 재시도 로직

### 3.4 확장성
```typescript
// 새 기능 추가 시 - API 변경 없음
async logChatInteraction(data: ChatInteractionData): Promise<void> {
  // 기존 로직
  await this.sessionService.saveMessage(...)
  await this.monitoringService.trackAI(...)
  
  // 새 기능 추가
  await this.notificationService.sendRealTimeUpdate(...) // 실시간 알림
  await this.recommendationService.updateUserProfile(...) // 추천 시스템
  await this.complianceService.auditLog(...) // 컴플라이언스 로그
}
```

## 4. 주요 메서드 및 책임

### 4.1 세션 관리
- `createSession(sessionData)`: 새 세션 생성
- `findActiveSession(criteria)`: 기존 활성 세션 찾기
- `getSessionContext(sessionId)`: 세션 컨텍스트 조회

### 4.2 채팅 상호작용 로깅
- `logChatInteraction(data)`: 통합 채팅 추적 (PostgreSQL + LangSmith)
- 사용자/어시스턴트 메시지 순차 저장
- 비동기 모니터링 데이터 전송

### 4.3 분석 및 통계
- `getSessionStats(sessionId)`: 세션별 통계
- `getStoreDailyStats(storeId, date)`: 스토어별 일일 통계
- `getPerformanceMetrics(storeId, days)`: 성능 메트릭

## 5. 의존성 관리

### 5.1 생성자 의존성 주입
```typescript
constructor(pool: Pool) {
  this.sessionService = new SessionService(pool)
  this.analyticsService = new ChatAnalyticsService(pool)
  this.monitoringService = new LLMMonitoringService()
}
```

### 5.2 서비스 레이어 분리
- **SessionService**: 데이터베이스 세션/메시지 CRUD
- **ChatAnalyticsService**: 통계 계산 및 분석
- **LLMMonitoringService**: 외부 모니터링 시스템 연동

## 6. 테스트 전략

### 6.1 단위 테스트
- 각 하위 서비스를 Mock으로 대체
- IntegratedChatService의 조율 로직만 테스트
- 에러 처리 시나리오별 테스트

### 6.2 통합 테스트
```typescript
describe('IntegratedChatService 통합 테스트', () => {
  test('채팅 상호작용 전체 플로우', async () => {
    // Given: 세션 데이터
    const sessionId = await service.createSession({...})
    
    // When: 채팅 상호작용 로그
    await service.logChatInteraction({
      sessionId,
      userMessage: '테스트 메시지',
      assistantResponse: '테스트 응답'
    })
    
    // Then: PostgreSQL과 LangSmith 모두 확인
    expect(postgresqlData).toBeDefined()
    expect(langsmithData).toBeDefined()
  })
})
```

## 7. 성능 고려사항

### 7.1 비동기 처리
- LangSmith 추적을 비동기로 처리하여 응답 속도 향상
- PostgreSQL 저장 완료 후 즉시 응답, 모니터링은 백그라운드 실행

### 7.2 연결 풀 관리
- 단일 PostgreSQL 연결 풀을 모든 하위 서비스가 공유
- 연결 리소스 효율적 사용

## 8. 보안 고려사항

### 8.1 데이터 격리
- 세션별 데이터 접근 권한 확인
- 스토어별 데이터 격리 보장

### 8.2 민감 정보 처리
- LangSmith 전송 시 개인정보 필터링
- 메타데이터만 전송, 실제 메시지 내용은 해시화

## 9. 모니터링 및 관찰성

### 9.1 로깅
- 각 단계별 상세 로그 기록
- 에러 발생 시 컨텍스트 정보 포함
- 성능 메트릭 (응답 시간, 토큰 사용량) 추적

### 9.2 알림
- 핵심 기능 실패 시 즉시 알림
- 부가 기능 실패는 로그로만 기록

## 10. 향후 확장 계획

### 10.1 실시간 기능
- WebSocket 연동을 위한 실시간 세션 관리
- 타이핑 인디케이터, 읽음 상태 관리

### 10.2 고급 분석
- 감정 분석 결과 추가
- 대화 품질 평가 메트릭
- A/B 테스트 지원

### 10.3 멀티 테넌트 지원
- 스토어별 독립적인 설정 관리
- 테넌트별 리소스 사용량 추적

---
**작성일**: 2025-08-13  
**작성자**: Claude Code Assistant  
**다음 리뷰**: 세션 관리 기능 확장 시 (2025-09-13)