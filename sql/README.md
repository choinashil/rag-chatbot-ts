# SQL 파일 관리

이 폴더는 프로젝트의 모든 SQL 관련 파일들을 체계적으로 관리합니다.

## 📁 폴더 구조

```
sql/
├── migrations/           # 데이터베이스 마이그레이션 파일
│   └── 001_initial_schema.sql    # 초기 스키마 (테이블, 인덱스, 함수)
├── seeds/               # 초기 데이터 삽입 파일
│   └── (향후 추가 예정)
├── functions/           # 저장 프로시저 및 함수 파일
│   └── (향후 분리 예정)
└── README.md           # 이 파일
```

## 🗂️ 파일 분류 기준

### **migrations/** - 데이터베이스 스키마 변경
- **명명 규칙**: `{순번}_{설명}.sql`
- **예시**: `001_initial_schema.sql`, `002_add_user_preferences.sql`
- **용도**: 테이블 생성, 컬럼 추가/삭제, 인덱스 생성 등

### **seeds/** - 초기 데이터
- **명명 규칙**: `{순번}_{데이터타입}.sql`
- **예시**: `001_admin_users.sql`, `002_default_settings.sql`
- **용도**: 기본 관리자 계정, 설정값, 테스트 데이터 등

### **functions/** - 저장 프로시저 및 함수
- **명명 규칙**: `{기능명}.sql`
- **예시**: `session_cleanup.sql`, `user_statistics.sql`
- **용도**: 복잡한 비즈니스 로직, 반복 사용되는 쿼리

## 🚀 실행 방법

### **마이그레이션 실행**
```bash
# 전체 초기화 (개발용)
npm run db:init

# 직접 실행
psql -h HOST -U USER -d DATABASE -f sql/migrations/001_initial_schema.sql
```

### **시드 데이터 삽입**
```bash
# 향후 추가 예정
npm run db:seed

# 직접 실행
psql -h HOST -U USER -d DATABASE -f sql/seeds/001_admin_users.sql
```

## 📋 마이그레이션 이력

| 순번 | 파일명 | 설명 | 작성일 |
|------|--------|------|--------|
| 001 | initial_schema.sql | 초기 스키마 (세션, 메시지 테이블) | 2025-08-13 |

## 🔧 개발 가이드라인

### **새 마이그레이션 작성 시**
1. 순번을 올바르게 매기기 (001, 002, 003...)
2. `CREATE OR REPLACE` 사용으로 재실행 가능하게 작성
3. `IF NOT EXISTS` 조건 사용으로 중복 생성 방지
4. 롤백 스크립트도 함께 고려

### **SQL 코드 품질**
- 명확한 주석 추가
- 일관된 네이밍 컨벤션 (snake_case)
- 성능을 고려한 인덱스 설계
- 트랜잭션 안전성 보장

## 🛠️ 향후 개선 계획

- [ ] 마이그레이션 자동 실행 스크립트
- [ ] 롤백 기능 추가
- [ ] 환경별 설정 분리 (dev/prod)
- [ ] 백업/복원 스크립트 추가

---

**참고**: 새로운 SQL 파일 추가 시 이 README를 업데이트해주세요.