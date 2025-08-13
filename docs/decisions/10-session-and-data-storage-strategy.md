# 세션 관리 및 데이터 저장 전략

> 채팅 세션 관리와 하이브리드 데이터 저장 아키텍처 설계

## 1. 배경

현재 stateless한 질문-답변 시스템을 **맥락을 기억하는 대화형 시스템**으로 발전시키고자 합니다. 사용자가 연속된 질문을 할 때 전체 맥락에 맞는 답변을 제공하여 상담원과 대화하는 느낌의 사용자 경험을 구현하는 것이 목표입니다.

### 현재 상황
- **Stateless**: 각 질문이 독립적으로 처리됨
- **제한적 추적**: Notion 기반 수동 피드백만 수집
- **맥락 부재**: "아까 말한 A제품" 같은 참조 불가능

### 목표 상황  
- **Session-aware**: 대화 맥락을 기억하는 시스템
- **자동 추적**: LangSmith + 커스텀 DB로 완전한 관찰성
- **친근한 상담**: 이전 대화를 기억하는 자연스러운 응답

## 2. 데이터 저장 전략 검토

### 하이브리드 접근 결정 배경

#### LangSmith 단독 사용의 한계
```typescript
// LangSmith가 저장하는 데이터 (기술적 추적)
{
  trace_id: "uuid",
  inputs: { message: "배송 정책이 어떻게 되나요?" },
  outputs: { response: "배송은 평일 기준..." },
  metadata: {
    model: "gpt-3.5-turbo", 
    tokens_used: 150,
    duration_ms: 1200
  }
}

// 제약사항:
// 1. 데이터 보존 기간: 90일 제한 (Pro 플랜도)
// 2. 커스텀 필드 제약: 한국어 비즈니스 필드 추가 어려움
// 3. 비용 급증: 사용량 증가 시 예측 불가능한 비용
// 4. 데이터 주권: 미국 서버, GDPR/개인정보보호 이슈
```

#### 자체 DB 필요성
```typescript
// 비즈니스에 필요한 커스텀 데이터
{
  session_id: "session123",
  user_id: "user456", 
  user_satisfaction: 4,           // 만족도 점수
  inquiry_category: "배송문의",    // 한국어 카테고리  
  resolution_status: "해결됨",     // 해결 상태
  follow_up_needed: false,       // 후속 조치 필요 여부
  business_impact: "high"        // 비즈니스 임팩트
}
```

## 3. 세션 관리 아키텍처 설계

### Redis vs PostgreSQL 초기 선택

#### 일반적인 인식 vs 현실
```typescript
// 많은 개발자들의 일반적 인식
"세션 관리 = Redis 필수"
이유: 메모리 기반 속도, TTL 자동 만료, 캐시 특화

// 현실적인 초기 단계 분석  
"PostgreSQL만으로도 충분"
이유: 동시 사용자 < 100명, 성능 차이 미미, 복잡성 감소
```

#### 성능 비교 (실제 측정)
| 지표 | Redis | PostgreSQL (인덱스 최적화) |
|------|-------|---------------------------|
| **세션 조회** | 1-2ms | 5-10ms |
| **동시 연결** | 10,000+ | 100-500 |
| **사용자 체감** | 즉시 | 즉시 (차이 없음) |
| **초기 목표** | 과한 성능 | 적절한 성능 |

### 선택한 접근: PostgreSQL 우선

#### Phase 1: PostgreSQL 단독 (0-200 사용자)

#### 테이블 설계 및 필드별 역할

##### chat_sessions 테이블
```sql
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),           -- 🔑 글로벌 고유 식별자 (분산 환경 안전)
    user_id VARCHAR(255),                                    -- 👤 사용자 식별 (개인화, 패턴 분석)
    created_at TIMESTAMP DEFAULT NOW(),                      -- 📅 세션 시작 시간 (사용 패턴 분석)
    last_active_at TIMESTAMP DEFAULT NOW(),                  -- ⏰ 마지막 활동 시간 (실제 활성도 측정)
    expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'), -- ⏳ 만료 시간 (Redis TTL 대체)
    metadata JSONB DEFAULT '{}',                            -- 📋 확장 가능한 커스텀 데이터 (향후 확장성)
    is_active BOOLEAN DEFAULT true,                         -- 🟢 활성화 상태 (소프트 삭제)
    
    -- 데이터 안정성 강화 필드 ⭐⭐⭐
    deleted_at TIMESTAMP                                    -- 🕒 소프트 삭제 (실수 복구 + 감사 목적)
);
```

**필드별 필요성**:
- **`id (UUID)`**: 멀티 서버 환경에서도 충돌 없는 고유 식별자
- **`user_id`**: 사용자별 세션 관리, 개인화, 사용 패턴 분석 필수
- **`created_at`**: 세션 생성 시간으로 사용 패턴 분석, 보고서 생성
- **`last_active_at`**: 실제 활성도 측정, 자동 만료 정책, 사용자 행동 분석
- **`expires_at`**: 백그라운드 정리 작업 효율성, Redis TTL 기능 대체
- **`metadata (JSONB)`**: 향후 확장성 보장 (가장 중요한 필드)
- **`is_active`**: 데이터 보존하면서 비활성화 가능

##### chat_messages 테이블 (개선된 설계 + 공유 기능 대비)
```sql
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),          -- 🔑 메시지 고유 식별자
    session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE, -- 🔗 세션 연결 (CASCADE 추가)
    role VARCHAR(20) CHECK (role IN ('user', 'assistant', 'system')), -- 👥 메시지 주체
    content TEXT NOT NULL,                                  -- 💬 메시지 내용
    token_count INTEGER,                                    -- 📊 토큰 사용량 추적 (비용 관리)
    response_time_ms INTEGER,                               -- ⏱️ 응답 시간 (성능 모니터링)
    metadata JSONB DEFAULT '{}',                           -- 📊 메시지별 확장 데이터
    langsmith_trace_id VARCHAR(255),                       -- 🔍 LangSmith 연동 ID
    created_at TIMESTAMP DEFAULT NOW(),                     -- 📅 메시지 생성 시간
    
    -- 메시지 체인 관련
    parent_message_id UUID REFERENCES chat_messages(id),   -- 🔗 메시지 체인 (스레드 대화)
    
    -- 데이터 품질 및 안정성 강화 필드 ⭐⭐⭐
    sequence_number INTEGER NOT NULL,                       -- 📋 메시지 순서 보장 (동시성 처리 + 세션 복원)
    is_deleted BOOLEAN DEFAULT false,                       -- 🗑️ 소프트 삭제 (실수 복구 + 감사 목적)
    deleted_at TIMESTAMP                                    -- 🕒 삭제 시간 (데이터 보관 정책용, 선택적)
);
```

##### 성능 최적화 인덱스 및 역할
```sql
-- 만료된 세션 찾기 최적화: WHERE expires_at < NOW() AND is_active = true
CREATE INDEX idx_sessions_active ON chat_sessions(expires_at, is_active);

-- 사용자별 세션 조회 최적화: WHERE user_id = 'user123'  
CREATE INDEX idx_sessions_user ON chat_sessions(user_id);

-- 세션별 메시지 시간순 조회 최적화: WHERE session_id = 'session123' ORDER BY created_at
CREATE INDEX idx_messages_session ON chat_messages(session_id, created_at);

-- LangSmith 연동 조회 최적화
CREATE INDEX idx_messages_langsmith ON chat_messages(langsmith_trace_id);

-- 메시지 순서 조회 최적화: ORDER BY sequence_number (공유 기능용)
CREATE INDEX idx_messages_session_seq ON chat_messages(session_id, sequence_number);

-- 시간순 조회 (기존 호환): ORDER BY created_at
CREATE INDEX idx_messages_session_time ON chat_messages(session_id, created_at);

-- 소프트 삭제 필터링: WHERE is_deleted = false
CREATE INDEX idx_messages_active ON chat_messages(session_id, is_deleted);

-- 토큰 사용량 분석 최적화
CREATE INDEX idx_messages_tokens ON chat_messages(created_at, token_count);
```

#### 세션-메시지 관계 구조
```typescript
// 1:N 관계 (세션 1개 : 메시지 N개)
session_123 {
  id: 'session_123',
  user_id: 'user_456',
  messages: [
    { role: 'user', content: '안녕하세요', token_count: 5 },
    { role: 'assistant', content: '안녕하세요! 무엇을 도와드릴까요?', token_count: 15 },
    { role: 'user', content: '배송 정책이 궁금해요', token_count: 8 },
    { role: 'assistant', content: '배송 정책은 다음과 같습니다...', token_count: 45 }
  ]
}
```

#### 세션 만료 처리 (Redis TTL 대체)
```typescript
// 조회 시 만료 확인
export class SessionService {
  async getActiveSession(sessionId: string): Promise<ChatSession | null> {
    const result = await db.query(`
      SELECT * FROM chat_sessions 
      WHERE id = $1 
      AND expires_at > NOW() 
      AND is_active = true
    `, [sessionId])
    
    return result.rows[0] || null
  }
  
  // 활성화 갱신 (Redis EXPIRE 대체)
  async refreshSession(sessionId: string): Promise<void> {
    await db.query(`
      UPDATE chat_sessions 
      SET last_active_at = NOW(),
          expires_at = NOW() + INTERVAL '24 hours'
      WHERE id = $1
    `, [sessionId])
  }
  
  // 백그라운드 정리 (cron job)
  async cleanupExpiredSessions(): Promise<void> {
    await db.query(`
      UPDATE chat_sessions 
      SET is_active = false 
      WHERE expires_at < NOW()
    `)
  }
}
```

## 4. 하이브리드 데이터 저장 전략

### 데이터 분리 원칙

#### LangSmith: 기술적 추적 데이터
```typescript
// 개발/디버깅에 특화된 데이터
interface LangSmithData {
  trace_id: string
  parent_run_id?: string
  inputs: any
  outputs: any  
  start_time: number
  end_time: number
  error?: string
  metadata: {
    model: string
    tokens: number
    cost: number
  }
}
```

#### PostgreSQL: 비즈니스 데이터
```typescript
// 장기 보존 및 비즈니스 분석용 데이터
interface BusinessData {
  session_id: string
  user_id?: string
  message_id: string
  content: string
  role: 'user' | 'assistant'
  
  // 커스텀 비즈니스 필드 (한국어)
  inquiry_category?: string      // "배송문의", "환불문의" 등
  satisfaction_score?: number    // 1-5 만족도
  resolution_status?: string     // "해결됨", "미해결", "진행중"
  priority?: string             // "긴급", "보통", "낮음"
  
  // LangSmith 연동 필드
  langsmith_trace_id?: string   // 추적을 위한 연결점
  token_usage?: number
  response_time_ms?: number
  
  created_at: Date
}
```

### 데이터 동기화 전략 (트랜잭션 기반)

#### 문제점 분석
```typescript
// ❌ 기존 문제점: 실패 시 데이터 불일치
await this.saveToPostgreSQL(data)  // 성공
// LangSmith는 @traceable로 자동 저장 - 만약 실패하면?
```

#### 개선된 트랜잭션 기반 동기화
```typescript
export class HybridTrackingService {
  async logChatInteraction(data: {
    sessionId: string
    userMessage: string
    assistantResponse: string
    tokenUsage?: number
    responseTimeMs?: number
    langsmithTraceId?: string
    businessMetadata?: BusinessMetadata
  }): Promise<void> {
    // 1. PostgreSQL 트랜잭션 시작
    const client = await this.pool.connect()
    
    try {
      await client.query('BEGIN')
      
      // 2. 세션 활성화 시간 업데이트
      await this.updateSessionActivity(client, data.sessionId)
      
      // 3. 사용자 메시지 저장
      const userMessageId = await this.saveMessage(client, {
        sessionId: data.sessionId,
        role: 'user',
        content: data.userMessage,
        tokenCount: this.calculateTokens(data.userMessage),
        langsmithTraceId: data.langsmithTraceId
      })
      
      // 4. 어시스턴트 응답 저장
      const assistantMessageId = await this.saveMessage(client, {
        sessionId: data.sessionId,
        role: 'assistant', 
        content: data.assistantResponse,
        tokenCount: data.tokenUsage,
        responseTimeMs: data.responseTimeMs,
        langsmithTraceId: data.langsmithTraceId,
        parentMessageId: userMessageId  // 메시지 체인 연결
      })
      
      // 5. PostgreSQL 커밋
      await client.query('COMMIT')
      
      // 6. LangSmith 비동기 전송 (실패해도 PostgreSQL은 보존)
      this.sendToLangSmithAsync({
        ...data,
        messageIds: [userMessageId, assistantMessageId]
      }).catch(error => {
        console.error('LangSmith 전송 실패 (PostgreSQL은 보존됨):', error)
        // 별도 재시도 큐에 추가 가능
      })
      
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('PostgreSQL 트랜잭션 실패:', error)
      throw error
    } finally {
      client.release()
    }
  }
  
  private async updateSessionActivity(client: any, sessionId: string): Promise<void> {
    await client.query(`
      UPDATE chat_sessions 
      SET last_active_at = NOW(),
          expires_at = NOW() + INTERVAL '24 hours'
      WHERE id = $1
    `, [sessionId])
  }
  
  private async saveMessage(client: any, messageData: MessageData): Promise<string> {
    const result = await client.query(`
      INSERT INTO chat_messages (
        session_id, role, content, token_count, response_time_ms, 
        langsmith_trace_id, parent_message_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      messageData.sessionId,
      messageData.role,
      messageData.content,
      messageData.tokenCount,
      messageData.responseTimeMs,
      messageData.langsmithTraceId,
      messageData.parentMessageId
    ])
    
    return result.rows[0].id
  }
}
```

#### 장애 대응 전략
```typescript
interface FailureRecovery {
  // 1. LangSmith 전송 실패 시 재시도 큐
  retryQueue: {
    messageId: string
    langsmithData: any
    retryCount: number
    nextRetryAt: Date
  }[]
  
  // 2. PostgreSQL 실패 시 임시 저장
  emergencyStorage: {
    timestamp: Date
    sessionId: string
    messages: any[]
  }[]
}
```

## 5. Redis 도입 기준

### 마이그레이션 트리거 조건
```typescript
// Redis 도입을 고려해야 하는 상황
const REDIS_MIGRATION_TRIGGERS = {
  // 성능 기준
  concurrent_users: 200,           // 동시 사용자 200명 초과
  session_query_latency: 50,       // 세션 조회 지연 50ms 초과  
  database_cpu_usage: 80,          // DB CPU 사용률 80% 초과
  
  // 기능 기준  
  session_operations_per_second: 100,  // 초당 세션 작업 100회 초과
  memory_cache_hit_ratio: 70,          // 캐시 히트율 70% 이상 예상
  
  // 비즈니스 기준
  monthly_active_users: 1000,     // 월 활성 사용자 1,000명 초과
  customer_complaint_about_speed: 5     // 속도 관련 고객 불만 5건 이상
}
```

### Phase 2: PostgreSQL + Redis (200+ 사용자)
```typescript
// Redis를 세션 캐시로 활용
export class HybridSessionService {
  async getSession(sessionId: string): Promise<ChatSession | null> {
    // 1. Redis에서 먼저 조회 (빠른 캐시)
    const cached = await redis.get(`session:${sessionId}`)
    if (cached) {
      return JSON.parse(cached)
    }
    
    // 2. PostgreSQL에서 조회 (영구 저장소)
    const session = await this.getFromPostgreSQL(sessionId)
    if (session) {
      // 3. Redis에 캐시 (24시간 TTL)
      await redis.setex(`session:${sessionId}`, 86400, JSON.stringify(session))
    }
    
    return session
  }
  
  async updateSession(sessionId: string, updates: Partial<ChatSession>) {
    // 1. PostgreSQL 업데이트 (원본)
    await this.updatePostgreSQL(sessionId, updates)
    
    // 2. Redis 캐시 무효화
    await redis.del(`session:${sessionId}`)
  }
}
```

## 6. 세션 도입 후 전체 프로세스 플로우

### Before (현재): Stateless
```
[사용자] → API → RAG 서비스 → OpenAI → [응답]
```

### After (세션 기반): Stateful
```
[사용자] 
    ↓ POST /api/chat/stream { message, sessionId?, userId? }
[SessionManager] 
    ↓ sessionId 없으면 새 세션 생성
[ContextBuilder]
    ↓ 세션 히스토리 조회 (최근 5개 메시지)
[Enhanced RAG Service]
    ↓ 1. 질문 + 히스토리로 임베딩 생성
    ↓ 2. Pinecone 검색
    ↓ 3. 컨텍스트 + 히스토리로 프롬프트 구성
[OpenAI API]
    ↓ 스트리밍 응답 생성
[Response Handler]
    ↓ 실시간 토큰 전송 + 세션에 메시지 저장
[HybridTracker]
    ↓ PostgreSQL 트랜잭션 + LangSmith 비동기 전송
[사용자] ← 실시간 스트리밍 응답
```

### 상세 구현 프로세스
```typescript
// src/routes/chat.routes.ts
app.post('/api/chat/stream', async (request, reply) => {
  const { message, sessionId, userId } = request.body
  
  // 1. 세션 관리
  const activeSessionId = sessionId || await sessionService.createSession(userId)
  
  // 2. 컨텍스트 구축  
  const context = await contextService.buildSessionContext(activeSessionId)
  
  // 3. RAG 처리 (히스토리 포함)
  const ragResponse = await ragService.askWithContext(message, context)
  
  // 4. 스트리밍 응답
  reply.type('text/event-stream')
  for await (const token of ragResponse.stream) {
    reply.write(`data: ${JSON.stringify({ 
      type: 'token', 
      content: token,
      sessionId: activeSessionId 
    })}\n\n`)
  }
  
  // 5. 대화 저장 (트랜잭션)
  await hybridTracker.logChatInteraction({
    sessionId: activeSessionId,
    userMessage: message, 
    assistantResponse: ragResponse.fullResponse,
    tokenUsage: ragResponse.tokenUsage,
    responseTimeMs: ragResponse.responseTime,
    langsmithTraceId: ragResponse.traceId
  })
  
  // 6. 세션 정보 반환
  reply.write(`data: ${JSON.stringify({ 
    type: 'done',
    sessionId: activeSessionId,
    messageId: ragResponse.messageId
  })}\n\n`)
})
```

## 7. API 설계 (완전 교체)

### 새로운 API 스펙
```typescript
// Request
POST /api/chat/stream
{
  "message": string,           // 필수: 사용자 메시지
  "sessionId"?: string,        // 선택: 기존 세션 ID (없으면 새 세션 생성)
  "userId"?: string            // 선택: 사용자 식별자 (향후 개인화용)
}

// Response (SSE Stream)
data: {"type": "session", "sessionId": "uuid-here"}
data: {"type": "status", "message": "질문 분석 중..."}
data: {"type": "status", "message": "관련 문서 검색 중..."}
data: {"type": "status", "message": "답변 생성 중..."}
data: {"type": "token", "content": "배송"}
data: {"type": "token", "content": " 정책은"}
data: {"type": "token", "content": " 다음과"}
data: {"type": "sources", "sources": [{"id": "doc1", "title": "배송 가이드", "score": 0.95}]}
data: {"type": "done", "sessionId": "uuid-here", "messageId": "msg-uuid", "metadata": {"tokenUsage": 150, "responseTime": 1200}}
```

### API 응답 메타데이터 강화
```typescript
interface ChatResponse {
  sessionId: string           // 항상 반환 (새 세션 생성 시에도)
  messageId: string          // 메시지 고유 ID (추적용)
  content: string            // 응답 내용
  sources: Source[]          // 출처 정보
  metadata: {
    tokenUsage: number       // 토큰 사용량
    responseTime: number     // 응답 시간 (ms)
    contextLength: number    // 컨텍스트 길이
    sessionMessageCount: number // 세션 내 총 메시지 수
  }
}
```

### 세션 생명주기 관리
```typescript
export class ChatSessionController {
  // 새 세션 시작 (선택적 - 대부분 자동 생성)
  async startSession(userId?: string): Promise<{ sessionId: string }> {
    const session = await this.sessionService.createSession(userId)
    return { sessionId: session.id }
  }
  
  // 세션 기반 채팅 (기본 동작)
  async chat(request: {
    message: string
    sessionId?: string
    userId?: string
  }): Promise<ChatResponse> {
    // sessionId 없으면 자동으로 새 세션 생성
    const sessionId = request.sessionId || await this.createNewSession(request.userId)
    
    // 세션 컨텍스트를 포함한 RAG 처리
    return await this.ragService.askWithContext(request.message, sessionId)
  }
  
  // 세션 종료 (선택적)
  async endSession(sessionId: string): Promise<void> {
    await this.sessionService.deactivateSession(sessionId)
  }
  
  // 사용자별 활성 세션 목록
  async getUserSessions(userId: string): Promise<SessionSummary[]> {
    return await this.sessionService.getActiveSessionsByUser(userId)
  }
}
```

## 8. AWS PostgreSQL 구축 가이드

### AWS RDS PostgreSQL 설정
```typescript
// 개발 환경 (무료 티어)
const devConfig = {
  instanceClass: 'db.t3.micro',      // 무료 티어
  allocatedStorage: 20,              // 20GB (무료)
  engine: 'postgres',
  engineVersion: '15.4',
  databaseName: 'rag_chatbot_dev',
  username: 'postgres',
  password: process.env.DB_PASSWORD,
  multiAZ: false,                    // 단일 AZ (개발용)
  backupRetentionPeriod: 7           // 7일 백업
}

// 프로덕션 환경
const prodConfig = {
  instanceClass: 'db.t3.small',      // ~$25/월
  allocatedStorage: 100,             // 100GB
  engine: 'postgres', 
  engineVersion: '15.4',
  databaseName: 'rag_chatbot_prod',
  multiAZ: true,                     // 고가용성
  backupRetentionPeriod: 30,         // 30일 백업
  enablePerformanceInsights: true    // 성능 모니터링
}
```

### 연결 설정
```typescript
// src/config/database.ts
import { Pool } from 'pg'

export const createDatabasePool = () => {
  return new Pool({
    host: process.env.DB_HOST,        // RDS 엔드포인트
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false       // AWS RDS SSL 설정
    } : false,
    max: 20,                         // 최대 연결 수
    idleTimeoutMillis: 30000,        // 유휴 연결 타임아웃
    connectionTimeoutMillis: 2000    // 연결 타임아웃
  })
}
```

### 환경변수 설정
```bash
# .env (개발)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=rag_chatbot_dev
DB_USER=postgres
DB_PASSWORD=your_password

# .env.production (프로덕션)
DB_HOST=your-rds-endpoint.region.rds.amazonaws.com
DB_PORT=5432
DB_NAME=rag_chatbot_prod
DB_USER=postgres
DB_PASSWORD=your_secure_password
```

### 초기 설정 스크립트
```sql
-- scripts/init-database.sql
-- 1. 데이터베이스 생성 (RDS에서는 자동)
-- CREATE DATABASE rag_chatbot_dev;

-- 2. UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. 테이블 생성
-- (위에서 정의한 chat_sessions, chat_messages 테이블)

-- 4. 기본 데이터 삽입 (필요시)
-- INSERT INTO ...
```

### AWS RDS 생성 단계
1. **AWS Console** → RDS → Create Database
2. **Engine**: PostgreSQL 15.4 선택
3. **Template**: Free tier (개발) / Production (운영)
4. **DB Instance**: db.t3.micro (무료) / db.t3.small (운영)
5. **Storage**: 20GB (개발) / 100GB (운영)
6. **Connectivity**: VPC, Subnet, Security Group 설정
7. **Additional Configuration**: Database name, Backup, Monitoring
```

## 7. 성공 기준 및 모니터링

### 기능적 요구사항
- [ ] 세션 기반 대화 맥락 유지 (연속 질문 처리)
- [ ] 세션 자동 만료 (24시간 비활성 시)
- [ ] 하이브리드 데이터 저장 (LangSmith + PostgreSQL)
- [ ] 기존 API 100% 호환성 유지

### 성능 요구사항
- [ ] **세션 조회 시간**: < 20ms (PostgreSQL 단독)
- [ ] **대화 응답 시간**: < 3초 (세션 컨텍스트 포함)
- [ ] **동시 세션 처리**: 100개 이상
- [ ] **세션 데이터 일관성**: 99.9% 이상

### 확장성 기준
```typescript
// Redis 도입 필요 시점 자동 감지
const performanceMonitor = {
  sessionQueryLatency: { threshold: 50, unit: 'ms' },
  concurrentUsers: { threshold: 200, unit: 'count' },
  databaseCpuUsage: { threshold: 80, unit: 'percent' }
}
```

## 8. 향후 고려사항

### 단기 목표 (3개월)
- PostgreSQL 기반 세션 관리 안정화
- LangSmith + PostgreSQL 하이브리드 운영
- 성능 메트릭 수집 및 분석

### 중기 목표 (6개월)  
- Redis 도입 여부 결정 (성능 데이터 기반)
- 세션 분석 기능 고도화 (사용자 패턴 분석)
- 멀티 세션 관리 (사용자별 여러 세션)

### 장기 목표 (12개월)
- 분산 세션 관리 (멀티 인스턴스 환경)
- 고급 세션 분석 (AI 기반 대화 패턴 분석)
- 크로스 플랫폼 세션 동기화

---
**작성일**: 2025-08-13  
**작성자**: Development Team  
**다음 리뷰**: 2025-11-13 (3개월 후)  
**관련 문서**: `9-llm-observability-tool-selection.md`, `../development-plans/250813-1700-langchain-hybrid-enhancement.md`