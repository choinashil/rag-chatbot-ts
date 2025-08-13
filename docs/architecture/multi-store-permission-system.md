# 멀티 스토어 권한 시스템 아키텍처

> 웹 빌더 서비스의 복잡한 다중 스토어 관리 구조를 위한 권한 및 데이터 분리 전략

## 비즈니스 요구사항 분석

### 사용자-스토어 관계
```
사용자 A:
  - 스토어 1: 소유자 (owner)
  - 스토어 2: 관리자 (admin)  
  - 스토어 3: 관리자 (admin)

스토어 1:
  - 사용자 A: 소유자
  - 사용자 B: 관리자
  - 사용자 C: 관리자
```

### 데이터 접근 권한
| 데이터 유형 | 접근 범위 | 용도 |
|------------|-----------|------|
| **과금 데이터** | 스토어 단위 | 토큰 사용량, 세션 수, 비용 청구 |
| **개인 세션** | 사용자 단위 (프라이버시) | 개별 질문/답변, 개인 히스토리 |
| **통계 데이터** | 스토어+사용자 조합 | 역할별 활동 패턴, 주제별 분석 |

### 프라이버시 정책
- **기본 원칙**: 개인이 물어본 내용은 본인만 조회 가능
- **예외 사항**: 
  - 사용자가 명시적으로 공유 설정한 경우 (`privacy_level: 'team'`)
  - 스토어 전체 공개 설정한 경우 (`privacy_level: 'store'`)
- **관리자 권한**: 통계는 볼 수 있지만 개별 질문 내용은 볼 수 없음

## 테이블 설계

### chat_sessions 테이블
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) NOT NULL,                   -- 과금/통계 단위
  user_id VARCHAR(255) NOT NULL,                    -- 프라이버시 단위  
  created_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  
  -- 멀티 스토어 관리를 위한 추가 필드
  session_context JSONB DEFAULT '{}',              -- 스토어별 컨텍스트
  privacy_level VARCHAR(20) DEFAULT 'private',     -- 'private', 'team', 'store'
  
  -- 데이터 안정성 강화 필드
  deleted_at TIMESTAMP                              -- 소프트 삭제 (실수 복구 + 감사 목적)
  
  -- user_role 제거: 인증 시스템에서 user_id로 실시간 조회
  -- 장점: 
  --   1. 데이터 일관성: 인증 시스템이 단일 진실 소스
  --   2. 실시간 반영: 역할 변경이 즉시 반영됨
  --   3. 저장 공간 절약: 중복 데이터 제거
);

-- chat_messages 테이블
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  token_count INTEGER,
  response_time_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  langsmith_trace_id VARCHAR(255),
  parent_message_id UUID REFERENCES chat_messages(id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- 데이터 품질 및 안정성 강화 필드
  sequence_number INTEGER NOT NULL,                 -- 메시지 순서 보장 (동시성 처리 + 세션 복원)
  is_deleted BOOLEAN DEFAULT false,                 -- 소프트 삭제 (실수 복구 + 감사 목적)
  deleted_at TIMESTAMP                              -- 삭제 시간 (데이터 보관 정책용, 선택적)
);
```

### 인덱스 전략
```sql
-- 세션 관련 인덱스 (멀티 스토어 권한 + 공유 기능)
CREATE INDEX idx_sessions_active ON chat_sessions(expires_at, is_active);
CREATE INDEX idx_sessions_store ON chat_sessions(store_id, created_at);     -- 과금/통계용
CREATE INDEX idx_sessions_user ON chat_sessions(user_id, created_at);       -- 개인 데이터용
CREATE INDEX idx_sessions_store_user ON chat_sessions(store_id, user_id);   -- 교차 분석용
CREATE INDEX idx_sessions_privacy ON chat_sessions(user_id, privacy_level); -- 프라이버시 필터링용

-- 메시지 관련 인덱스 (순서 보장 + 성능 최적화)
CREATE INDEX idx_messages_session_seq ON chat_messages(session_id, sequence_number); -- 메시지 순서 조회
CREATE INDEX idx_messages_session_time ON chat_messages(session_id, created_at);     -- 시간순 조회 (기존 호환)
CREATE INDEX idx_messages_langsmith ON chat_messages(langsmith_trace_id);            -- LangSmith 연동
CREATE INDEX idx_messages_active ON chat_messages(session_id, is_deleted);           -- 소프트 삭제 필터링
```

## API 설계

### 요청 형식
```typescript
POST /api/chat/stream
{
  "message": string,        // 필수: 사용자 메시지
  "sessionId"?: string,     // 선택: 기존 세션 ID
  "storeId": string,        // 필수: 과금/통계 단위
  "userId": string,         // 필수: 프라이버시 단위
  // userRole 제거: 인증 시스템에서 userId + storeId로 실시간 조회
}
```

### 권한 검증 로직
```typescript
// 세션 접근 권한 확인
async function validateSessionAccess(
  sessionId: string, 
  storeId: string, 
  userId: string
): Promise<boolean> {
  const session = await db.query(`
    SELECT privacy_level, user_id, store_id
    FROM chat_sessions 
    WHERE id = $1 AND store_id = $2
  `, [sessionId, storeId])
  
  if (!session) return false
  
  // 인증 시스템에서 사용자 역할 조회
  const userRole = await authService.getUserRoleInStore(userId, storeId)
  if (!userRole) return false // 해당 스토어 접근 권한 없음
  
  switch (session.privacy_level) {
    case 'private':
      return session.user_id === userId
    case 'team':
      return session.store_id === storeId && ['owner', 'admin'].includes(userRole)
    case 'store':
      return session.store_id === storeId && ['owner', 'admin'].includes(userRole)
    default:
      return false
  }
}
```

## 비즈니스 메타데이터 용도

### 1. 과금 분석 (스토어 단위)
```typescript
{
  store_tier: "premium",           // 스토어 등급별 사용 패턴
  monthly_token_limit: 100000,     // 월 한도 대비 사용률
  overage_alert: true              // 초과 사용 알림
}
```

### 2. 서비스 개선 (질문 유형 분석)
```typescript
{
  inquiry_category: "배송문의",     // 자주 묻는 질문 분류
  satisfaction_score: 4,           // 답변 만족도 추적
  resolution_status: "해결됨",      // 문제 해결률
  follow_up_needed: false          // 추가 지원 필요 여부
}
```

### 3. 사용자 패턴 분석
```typescript
{
  user_role_context: "as_owner",   // 소유자/관리자별 질문 패턴
  topic_tags: ["결제", "배송"],     // 관심 주제 추적
  usage_frequency: "daily",        // 사용 빈도
  peak_hours: [9, 14, 18]         // 주 사용 시간대
}
```

### 4. 비즈니스 인사이트
```typescript
{
  conversion_stage: "trial",       // 고객 전환 단계
  feature_interest: ["analytics"], // 관심 기능
  support_priority: "high",        // 지원 우선순위
  churn_risk: "low"               // 이탈 위험도
}
```

## 데이터 조회 패턴

### 스토어 대시보드 (과금/통계)
```sql
-- 스토어별 월간 토큰 사용량
SELECT 
  DATE_TRUNC('month', created_at) as month,
  SUM(token_count) as total_tokens,
  COUNT(DISTINCT user_id) as active_users
FROM chat_messages m
JOIN chat_sessions s ON m.session_id = s.id  
WHERE s.store_id = 'store123'
GROUP BY month;
```

### 개인 히스토리 (프라이버시)
```sql
-- 사용자 개인 세션 목록
SELECT s.id, s.created_at, s.last_active_at
FROM chat_sessions s
WHERE s.user_id = 'user456' 
  AND (s.privacy_level = 'private' OR s.user_id = 'user456');
```

### 교차 분석 (비즈니스 인사이트)
```sql
-- 스토어 내 소유자/관리자별 질문 주제 분포
-- 주의: user_role은 인증 시스템에서 실시간 조회 필요
SELECT 
  s.user_id,
  -- auth_service.get_user_role(s.user_id, s.store_id) as user_role,
  m.metadata->>'inquiry_category' as category,
  COUNT(*) as question_count
FROM chat_sessions s
JOIN chat_messages m ON s.id = m.session_id
WHERE s.store_id = 'store123' 
  AND m.role = 'user'
GROUP BY s.user_id, category;
```

---
**작성일**: 2025-08-13 12:00 KST  
**작성자**: Development Team  
**관련 문서**: 
- `../decisions/10-session-and-data-storage-strategy.md`
- `../development-plans/250813-1200-langchain-hybrid-enhancement.md`