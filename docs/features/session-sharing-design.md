# 세션 공유 기능 설계

> 멀티 스토어 환경에서의 세션/메시지 공유 기능 설계 및 구현 전략

## 1. 기능 개요

### 목적
- **팀 협업**: 스토어 내 관리자 간 대화 내용 공유 및 협업
- **고객 지원**: 복잡한 문제 해결 시 다른 관리자에게 상담 내용 공유
- **지식 축적**: 우수한 대화 사례를 팀 내 공유하여 서비스 품질 향상
- **외부 공유**: 고객 또는 외부 파트너와 특정 대화 내용 공유

### 비즈니스 요구사항
- **프라이버시 우선**: 기본적으로 개인 대화는 본인만 접근 가능
- **선택적 공유**: 사용자가 명시적으로 설정한 경우에만 공유
- **접근 제어**: 공유 범위와 권한을 세밀하게 제어 가능
- **추적 가능**: 누가 언제 무엇을 공유했는지 감사 추적

## 2. 공유 방식별 분석

### 🔗 방식 1: 공유 링크 (Share Link)
```typescript
// shared_sessions 테이블
CREATE TABLE shared_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id),
  share_token VARCHAR(255) UNIQUE NOT NULL,              -- 공유용 고유 토큰
  created_by VARCHAR(255) NOT NULL,                      -- 공유 생성자
  expires_at TIMESTAMP,                                  -- 만료 시간
  access_level VARCHAR(20) DEFAULT 'view_only',          -- 'view_only', 'comment', 'full'
  password_hash VARCHAR(255),                            -- 선택적 비밀번호 보호
  access_count INTEGER DEFAULT 0,                       -- 접근 횟수 추적
  max_access_count INTEGER,                              -- 최대 접근 횟수 제한
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

// 사용 예시
const shareUrl = `https://chatbot.example.com/shared/${share_token}`
```

**장점**: 
- 간단한 URL로 즉시 공유 가능
- 외부 사용자(시스템 미가입자)도 접근 가능
- 세밀한 접근 제어 (시간, 횟수, 비밀번호)
- 소셜미디어, 이메일 등 어디든 공유 가능

**단점**: 
- URL 유출 시 보안 위험
- 링크 관리 오버헤드
- 외부 접근자 신원 확인 어려움

### 👥 방식 2: 사용자별 권한 공유 (User Permission)
```typescript
// session_permissions 테이블
CREATE TABLE session_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id),
  target_user_id VARCHAR(255) NOT NULL,                 -- 권한 부여받는 사용자
  target_store_id VARCHAR(255),                         -- 대상 사용자의 스토어 컨텍스트
  permission_level VARCHAR(20) DEFAULT 'read',          -- 'read', 'comment', 'edit'
  granted_by VARCHAR(255) NOT NULL,                     -- 권한 부여자
  granted_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,                                 -- 권한 만료 시간
  is_active BOOLEAN DEFAULT true
);
```

**장점**:
- 정확한 사용자 식별 및 제어
- 권한 추적 및 감사 기능
- 시스템 내 통합된 권한 관리
- 알림 시스템 연동 가능

**단점**:
- 대상 사용자가 미리 시스템에 등록되어야 함
- 사용자 검색 및 초대 과정 필요
- 관리 복잡성 증가

### 📋 방식 3: 세션 복사/포크 (Session Fork)
```typescript
// forked_sessions 테이블
CREATE TABLE forked_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_session_id UUID REFERENCES chat_sessions(id),
  forked_session_id UUID REFERENCES chat_sessions(id),
  forked_by VARCHAR(255) NOT NULL,
  fork_type VARCHAR(20) DEFAULT 'copy',                 -- 'copy', 'reference', 'snapshot'
  fork_permissions VARCHAR(20) DEFAULT 'read_only',     -- 포크된 세션의 권한
  created_at TIMESTAMP DEFAULT NOW()
);
```

**장점**:
- 원본 데이터 보호 (읽기 전용 복사본)
- 독립적인 수정 및 확장 가능
- 버전 관리 개념 도입 가능
- 데이터 일관성 보장

**단점**:
- 저장 공간 사용량 증가
- 원본과 복사본 간 동기화 문제
- 복잡한 관계 관리

### 🏢 방식 4: 팀/워크스페이스 공유 (Team Sharing)
```typescript
// team_workspaces 테이블 (기존 조직 구조 활용)
CREATE TABLE team_workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,                           -- "고객지원팀", "마케팅팀"
  description TEXT,
  members JSONB NOT NULL DEFAULT '[]',                  -- 팀 멤버 목록
  default_permissions VARCHAR(20) DEFAULT 'read',      -- 팀 내 기본 권한
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

// 세션을 팀에 공유
UPDATE chat_sessions SET privacy_level = 'team', team_workspace_id = 'team123' 
WHERE id = 'session456';
```

**장점**:
- 조직 구조에 맞는 자연스러운 공유
- 관리 오버헤드 낮음
- 확장성 및 유지보수성 좋음
- 팀별 대시보드 구성 가능

**단점**:
- 유연성 제한 (팀 구조에 의존)
- 팀 구조 변경 시 복잡한 마이그레이션
- 임시적 공유에는 부적합

## 3. 권장 하이브리드 접근법

### 통합 공유 시스템 설계
```typescript
// session_shares 통합 테이블
CREATE TABLE session_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id),
  sharing_type VARCHAR(20) NOT NULL,                    -- 'link', 'user', 'team', 'public'
  
  -- 공유 링크용
  share_token VARCHAR(255) UNIQUE,                      -- 링크 공유 토큰
  access_password_hash VARCHAR(255),                    -- 선택적 비밀번호
  
  -- 사용자 권한용  
  target_user_id VARCHAR(255),                          -- 특정 사용자 공유
  target_store_id VARCHAR(255),                         -- 대상 스토어
  
  -- 팀 공유용
  target_team_id VARCHAR(255),                          -- 특정 팀 공유
  
  -- 공통 설정
  created_by VARCHAR(255) NOT NULL,                     -- 공유 생성자
  permission_level VARCHAR(20) DEFAULT 'view_only',     -- 'view_only', 'comment', 'edit'
  expires_at TIMESTAMP,                                 -- 만료 시간
  max_access_count INTEGER,                             -- 최대 접근 횟수
  access_count INTEGER DEFAULT 0,                       -- 현재 접근 횟수
  
  -- 추가 설정
  access_settings JSONB DEFAULT '{}',                   -- 기타 설정들
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- 제약 조건: sharing_type에 따라 필요한 필드 검증
  CONSTRAINT valid_link_share CHECK (
    sharing_type != 'link' OR share_token IS NOT NULL
  ),
  CONSTRAINT valid_user_share CHECK (
    sharing_type != 'user' OR target_user_id IS NOT NULL
  ),
  CONSTRAINT valid_team_share CHECK (
    sharing_type != 'team' OR target_team_id IS NOT NULL
  )
);

-- 접근 로그 테이블
CREATE TABLE share_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID REFERENCES session_shares(id),
  accessed_by VARCHAR(255),                             -- 접근자 (익명일 수 있음)
  access_method VARCHAR(20),                            -- 'direct', 'link', 'invitation'
  ip_address INET,                                      -- 접근 IP
  user_agent TEXT,                                      -- 브라우저 정보
  accessed_at TIMESTAMP DEFAULT NOW()
);
```

### 공유 API 설계
```typescript
// 세션 공유 생성
POST /api/sessions/{sessionId}/share
{
  "sharingType": "link" | "user" | "team",
  "permissionLevel": "view_only" | "comment" | "edit",
  "expiresAt"?: "2025-12-31T23:59:59Z",
  "maxAccessCount"?: 100,
  "password"?: "optional_password",
  
  // sharing_type별 추가 필드
  "targetUserId"?: "user123",           // user 타입일 때
  "targetStoreId"?: "store456",         // user 타입일 때
  "targetTeamId"?: "team789"            // team 타입일 때
}

// 응답
{
  "shareId": "share_uuid",
  "shareUrl": "https://example.com/shared/abc123",  // link 타입일 때만
  "sharingType": "link",
  "expiresAt": "2025-12-31T23:59:59Z"
}

// 공유된 세션 접근
GET /api/shared/{shareToken}
// 또는
GET /api/sessions/{sessionId}/shared?access_token={token}

// 사용자별 공유받은 세션 목록
GET /api/users/{userId}/shared-sessions
```

## 4. 현재 설계에서 미리 대응한 부분

### ✅ 이미 준비된 기능들

#### 1. `privacy_level` 필드
```sql
privacy_level VARCHAR(20) DEFAULT 'private'
```
- 현재: `'private'`, `'team'`, `'store'`
- 확장: `'shared_link'`, `'public'`, `'custom'` 쉽게 추가 가능

#### 2. `sequence_number` 필드
```sql
sequence_number INTEGER NOT NULL
```
- **주 목적**: 동시성 환경에서 메시지 순서 정확히 보장
- **부가 효과**: 공유 시에도 순서 보장 (향후 공유 기능 구현 시 활용)
- **문제 해결**: `created_at`만으로는 서버 시간 차이로 순서 뒤바뀔 수 있음
- **핵심 가치**: 세션 복원, 디버깅, 데이터 분석에서 정확한 대화 흐름 보장

#### 3. 소프트 삭제 필드
```sql
is_deleted BOOLEAN DEFAULT false,
deleted_at TIMESTAMP
```
- **주 목적**: 사용자 실수 복구 및 감사 목적
- **부가 효과**: 공유 링크 보호 (향후 공유 기능 구현 시 활용)
- **일반적 활용**: 
  1. 사용자: "실수로 대화를 삭제했어요" → 복구 가능
  2. 감사: 규정상 일정 기간 데이터 보관 필요
  3. 분석: 삭제된 패턴도 서비스 개선에 활용
- **공유 시나리오** (향후):
  1. 공유된 세션을 원래 사용자가 "삭제"
  2. 공유받은 사람의 링크는 여전히 작동 (읽기 전용)
  3. 90일 후 실제 데이터 삭제

#### 4. UUID 기반 ID
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```
- **목적**: 공유 토큰으로 직접 활용 가능
- **장점**: 추측 불가능, 외부 노출 안전

#### 5. JSONB 메타데이터
```sql
metadata JSONB DEFAULT '{}'
```
- **목적**: 공유 관련 설정을 스키마 변경 없이 저장
- **활용**: 공유 설정, 접근 제어, 커스텀 권한 등

## 5. 구현 우선순위 및 로드맵

### Phase 1: 기본 공유 링크 (MVP)
**소요 시간**: 1-2주
```typescript
// 최소 기능
- 세션 공유 링크 생성
- 만료 시간 설정
- 읽기 전용 접근
- 기본 접근 로그
```

### Phase 2: 고급 링크 제어
**소요 시간**: 1주
```typescript
// 추가 기능
- 비밀번호 보호
- 접근 횟수 제한
- 댓글 기능
- 상세 접근 로그
```

### Phase 3: 사용자별 권한 공유
**소요 시간**: 2주
```typescript
// 내부 사용자 공유
- 특정 사용자에게 권한 부여
- 권한 레벨 관리
- 알림 시스템 연동
- 공유 대시보드
```

### Phase 4: 팀/워크스페이스 공유
**소요 시간**: 2-3주
```typescript
// 조직 차원 공유
- 팀 워크스페이스 생성
- 팀 멤버 관리
- 팀별 공유 정책
- 조직 권한 체계
```

## 6. 보안 고려사항

### 접근 제어
```typescript
// 권한 검증 로직
async function validateShareAccess(
  shareToken: string, 
  userId?: string
): Promise<SharePermission | null> {
  const share = await getShare(shareToken)
  
  if (!share || !share.is_active) return null
  if (share.expires_at && share.expires_at < new Date()) return null
  if (share.max_access_count && share.access_count >= share.max_access_count) return null
  
  // 공유 타입별 추가 검증
  switch (share.sharing_type) {
    case 'user':
      return userId === share.target_user_id ? share : null
    case 'team':
      return await validateTeamMembership(userId, share.target_team_id) ? share : null
    case 'link':
      return share  // 링크는 토큰만으로 접근 가능
    default:
      return null
  }
}
```

### 데이터 보호
- **민감 정보 마스킹**: 공유 시 개인정보 자동 마스킹
- **접근 로그**: 모든 공유 접근 기록
- **권한 만료**: 자동 권한 만료 및 정리
- **감사 추적**: 누가 언제 무엇을 공유했는지 완전 추적

## 7. 향후 확장 가능성

### 고급 기능들
- **실시간 협업**: 공유된 세션에서 실시간 댓글/토론
- **버전 관리**: 공유 후 원본이 수정된 경우 버전 추적
- **임베드 위젯**: 외부 사이트에 대화 내용 임베드
- **공개 갤러리**: 우수 사례를 공개 갤러리에 전시
- **AI 분석**: 공유된 대화의 패턴 분석 및 인사이트 제공

---
**작성일**: 2025-08-13 12:00 KST  
**작성자**: Development Team  
**다음 검토**: 공유 기능 구현 시  
**관련 문서**: 
- `../architecture/multi-store-permission-system.md`
- `../decisions/10-session-and-data-storage-strategy.md`