# 데이터베이스 Migration 가이드

> **작성일**: 2025-08-13 KST  
> **목적**: 데이터베이스 스키마 변경 관리 및 배포 가이드  
> **대상**: 개발팀, DevOps 엔지니어

## 개요

Migration은 데이터베이스 스키마(구조)의 **변경 이력을 체계적으로 관리**하는 시스템입니다. 팀 협업 시 모든 환경(개발/스테이징/프로덕션)의 데이터베이스가 동일한 구조를 유지할 수 있도록 도와줍니다.

## Migration이 필요한 이유

### ❌ **Migration 없이 개발할 때 문제점**
```sql
-- 개발자 A가 직접 DB 콘솔에서 실행
ALTER TABLE chat_sessions ADD COLUMN language VARCHAR(10);

-- 문제 발생:
-- 1. 개발자 B의 로컬 DB에는 language 컬럼이 없음
-- 2. 프로덕션 배포 시 컬럼 누락으로 에러 발생
-- 3. 언제, 누가, 왜 변경했는지 추적 불가
```

### ✅ **Migration 사용 시 장점**
```sql
-- sql/migrations/002_add_language_preference.sql 파일 생성
ALTER TABLE chat_sessions ADD COLUMN language VARCHAR(10) DEFAULT 'ko';

-- 장점:
-- 1. Git으로 변경 이력 관리
-- 2. 팀원들과 일관된 DB 구조 유지
-- 3. 프로덕션 배포 시 안전한 적용
-- 4. 롤백 가능
```

---

## 폴더 구조

```
sql/
├── migrations/           # 데이터베이스 스키마 변경
│   ├── 001_initial_schema.sql       # 초기 스키마
│   ├── 002_add_language_preference.sql
│   └── 003_add_feedback_table.sql
├── seeds/               # 초기 데이터 삽입
│   ├── 001_admin_users.sql
│   └── 002_default_settings.sql
├── functions/           # 저장 프로시저 및 함수
│   ├── session_cleanup.sql
│   └── user_statistics.sql
└── README.md           # SQL 관리 가이드
```

### 명명 규칙
- **Migration**: `{순번}_{설명}.sql` (예: `002_add_user_preferences.sql`)
- **Seed**: `{순번}_{데이터타입}.sql` (예: `001_admin_users.sql`)
- **Function**: `{기능명}.sql` (예: `session_cleanup.sql`)

---

## Migration 작성 가이드

### 1. 새 테이블 추가
```sql
-- sql/migrations/003_add_feedback_table.sql
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_feedback_session 
ON user_feedback(session_id);

CREATE INDEX IF NOT EXISTS idx_feedback_rating 
ON user_feedback(rating, created_at);
```

### 2. 기존 테이블에 컬럼 추가
```sql
-- sql/migrations/004_add_user_preferences.sql
-- 새 컬럼 추가
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'ko';

ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Asia/Seoul';

-- 기존 데이터에 기본값 설정
UPDATE chat_sessions 
SET language = 'ko', timezone = 'Asia/Seoul'
WHERE language IS NULL OR timezone IS NULL;

-- NOT NULL 제약 조건 추가 (선택적)
ALTER TABLE chat_sessions 
ALTER COLUMN language SET NOT NULL;
```

### 3. 인덱스 최적화
```sql
-- sql/migrations/005_optimize_session_queries.sql
-- 기존 단일 인덱스 제거
DROP INDEX IF EXISTS idx_sessions_store;

-- 복합 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_sessions_store_created 
ON chat_sessions(store_id, created_at DESC);

-- 사용 빈도가 높은 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_messages_session_active
ON chat_messages(session_id, created_at) 
WHERE is_deleted = false;
```

### 4. 데이터 마이그레이션
```sql
-- sql/migrations/006_migrate_old_data.sql
-- 기존 데이터 형식 변경
UPDATE chat_sessions 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{migrated_at}',
  to_jsonb(NOW()::text)
)
WHERE metadata IS NULL OR NOT metadata ? 'migrated_at';

-- 잘못된 데이터 정리
DELETE FROM chat_messages 
WHERE session_id NOT IN (SELECT id FROM chat_sessions);
```

---

## Migration 실행 방법

### 개발 환경
```bash
# 전체 스키마 재생성 (개발용)
npm run db:init

# 개별 migration 실행
psql -h localhost -U postgres -d rag_chatbot_dev \
  -f sql/migrations/002_add_language_preference.sql

# Migration 상태 확인 (향후 구현)
npm run db:migrate:status
```

### 스테이징/프로덕션 환경
```bash
# 안전한 migration 실행
npm run db:migrate

# 특정 migration까지만 실행 (향후 구현)
npm run db:migrate -- --target=005

# 롤백 (향후 구현)
npm run db:rollback -- --steps=1
```

---

## 배포 시 Migration 실행 시점

### 1. CI/CD 파이프라인에서 자동 실행 (권장)
```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    steps:
      - name: Checkout code
        uses: actions/checkout@v2
        
      - name: Install dependencies
        run: npm install
        
      - name: Run database migrations ⭐
        run: npm run db:migrate
        env:
          DB_HOST: ${{ secrets.PROD_DB_HOST }}
          DB_PASSWORD: ${{ secrets.PROD_DB_PASSWORD }}
          
      - name: Deploy application
        run: npm run deploy
```

### 2. 배포 스크립트에서 실행
```bash
#!/bin/bash
# deploy.sh
echo "🚀 배포 시작..."

# 1. 코드 업데이트
git pull origin main

# 2. 의존성 설치
npm install

# 3. ⭐ Migration 실행 (서버 시작 전)
npm run db:migrate

# 4. 애플리케이션 빌드
npm run build

# 5. 서버 재시작
pm2 restart rag-chatbot

echo "✅ 배포 완료"
```

### 3. 서버 시작 시 자동 실행 (보조적)
```typescript
// src/server.ts
async function startServer() {
  console.log('🔍 Migration 확인 중...')
  
  // 서버 시작 전에 pending migration 실행
  if (process.env.AUTO_MIGRATE === 'true') {
    await runPendingMigrations()
  }
  
  console.log('🚀 서버 시작...')
  await fastify.listen({ port: 8000 })
}
```

---

## Migration 관리 시스템 (향후 구현 예정)

### Migration 이력 테이블
```sql
-- 시스템이 자동으로 생성
CREATE TABLE schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP DEFAULT NOW(),
  execution_time_ms INTEGER,
  checksum VARCHAR(255)
);
```

### 자동 Migration 실행기
```typescript
// scripts/run-migrations.ts (향후 구현)
class MigrationRunner {
  async runPendingMigrations(): Promise<void> {
    // 1. 적용된 migration 목록 조회
    const appliedMigrations = await this.getAppliedMigrations()
    
    // 2. 모든 migration 파일 읽기
    const allMigrations = this.getAllMigrations()
    
    // 3. 미적용 migration만 실행
    for (const migration of allMigrations) {
      if (!appliedMigrations.includes(migration.version)) {
        await this.runMigration(migration)
      }
    }
  }
}
```

---

## 모범 사례

### ✅ **좋은 Migration 작성법**
```sql
-- 1. 멱등성 보장 (여러 번 실행해도 안전)
CREATE TABLE IF NOT EXISTS user_preferences (...);
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS language VARCHAR(10);

-- 2. 트랜잭션 안전성
BEGIN;
  ALTER TABLE chat_sessions ADD COLUMN timezone VARCHAR(50);
  UPDATE chat_sessions SET timezone = 'Asia/Seoul' WHERE timezone IS NULL;
COMMIT;

-- 3. 롤백 계획 준비 (주석으로 명시)
-- ROLLBACK PLAN:
-- ALTER TABLE chat_sessions DROP COLUMN timezone;

-- 4. 명확한 주석
-- 목적: 사용자별 시간대 설정 지원
-- 영향: 기존 데이터에 기본값 'Asia/Seoul' 설정
```

### ❌ **피해야 할 Migration**
```sql
-- 1. 위험한 데이터 삭제
DROP TABLE old_table;  -- 백업 없이 삭제 금지

-- 2. 큰 테이블의 구조 변경 (다운타임 발생)
ALTER TABLE large_table ALTER COLUMN content TYPE TEXT;

-- 3. 복합적인 변경 (실패 시 롤백 어려움)
-- 여러 테이블을 한 번에 수정하지 말고 단계별로 분리
```

---

## 배포 전 체크리스트

### 개발자 체크리스트
- [ ] Migration 파일이 올바른 순번으로 명명되었는가?
- [ ] 로컬 환경에서 migration 테스트 완료했는가?
- [ ] 롤백 계획을 준비했는가?
- [ ] 큰 테이블 변경 시 다운타임을 고려했는가?
- [ ] 기존 데이터에 영향을 주는 변경사항을 팀에 공유했는가?

### DevOps 체크리스트
- [ ] 스테이징 환경에서 migration 테스트 완료했는가?
- [ ] 프로덕션 DB 백업을 생성했는가?
- [ ] Migration 실행 시간을 측정했는가?
- [ ] 장애 발생 시 롤백 절차를 준비했는가?
- [ ] 서비스 중단이 필요한 경우 사전 공지했는가?

---

## 문제 해결

### Migration 실행 실패 시
```bash
# 1. 로그 확인
tail -f /var/log/migration.log

# 2. 현재 migration 상태 확인
npm run db:migrate:status

# 3. 수동 롤백 (DB 콘솔에서)
-- 실패한 migration의 변경사항 수동 롤백

# 4. Migration 파일 수정 후 재실행
npm run db:migrate
```

### 팀원 간 DB 불일치 시
```bash
# 1. 최신 코드 받기
git pull origin main

# 2. DB 완전 초기화 (개발 환경만)
npm run db:reset  # DB 삭제 후 재생성
npm run db:init   # 전체 migration 재실행

# 3. 시드 데이터 적용 (필요시)
npm run db:seed
```

---

## 향후 개선 계획

### Phase 1: 기본 Migration 관리
- [ ] Migration 실행기 구현 (`npm run db:migrate`)
- [ ] Migration 상태 확인 도구
- [ ] 자동 이력 관리 테이블

### Phase 2: 고급 기능
- [ ] 롤백 기능 구현
- [ ] Migration 파일 검증 (구문 체크)
- [ ] 실행 시간 측정 및 로깅

### Phase 3: CI/CD 통합
- [ ] GitHub Actions에서 자동 migration
- [ ] 스테이징 환경 자동 테스트
- [ ] 프로덕션 배포 시 안전장치

---

## 참고 자료

### 관련 문서
- [PostgreSQL 공식 문서 - ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [Database Migration Best Practices](https://martinfowler.com/articles/evodb.html)

### 내부 문서
- [`sql/README.md`](../../sql/README.md) - SQL 파일 관리 가이드
- [`docs/development-plans/250813-1300-stage1-infrastructure-setup.md`](../development-plans/250813-1300-stage1-infrastructure-setup.md) - 데이터베이스 구축 가이드

---

**마지막 업데이트**: 2025-08-13 KST  
**작성자**: Development Team  
**다음 검토**: Migration 자동화 구현 후