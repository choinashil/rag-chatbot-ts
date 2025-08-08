# Environment Configuration

이 폴더는 프로젝트의 환경변수 파일들을 관리합니다.

## 파일 구조

```
env/
├── .env.example      # 환경변수 템플릿 (git 포함)
├── .env.dev          # 개발 환경 설정 (git에서 제외됨)
├── .env.test         # 단위 테스트 환경 - 가짜 API 키 (git에서 제외됨)
├── .env.integration  # 통합 테스트 환경 - 실제 API 키 (git에서 제외됨)
└── README.md         # 이 파일
```

## 환경별 용도

### 🧪 **단위 테스트** (`.env.test`)
- **목적**: 외부 API 호출 없는 순수 로직 테스트
- **API 키**: 가짜 값들 (`test_*`)
- **특징**: 빠른 실행, 안정적, 외부 의존성 없음
- **사용**: `npm test`, Jest 자동 로드

### 🔗 **통합 테스트** (`.env.integration`) 
- **목적**: 실제 API 연동 검증
- **API 키**: 실제 값들 (`sk-`, `ntn-`, `pcsk-`)
- **특징**: 느린 실행, 외부 서비스 의존성 있음
- **사용**: `npm run test:*` (통합 테스트 스크립트들)

### 💡 **왜 분리해야 하는가?**
1. **보안**: 단위 테스트에 실제 API 키 노출 방지
2. **성능**: 단위 테스트는 빨라야 함 (170개 테스트 1.19초)
3. **안정성**: 단위 테스트는 외부 API 장애와 무관해야 함
4. **비용**: 단위 테스트가 API 비용을 발생시키면 안 됨

## 환경변수 설정

### 필수 환경변수

```bash
# 서버 설정
PORT=8000

# Notion Integration 설정
NOTION_INTEGRATION_TOKEN=secret_your_integration_token_here
NOTION_DATABASE_ID=your_database_id_here

# OpenAI API 설정 (3단계에서 필요)
OPENAI_API_KEY=sk-proj-your_openai_key_here

# Pinecone 설정 (4단계에서 필요)
PINECONE_API_KEY=pcsk_your_pinecone_key_here
PINECONE_INDEX_NAME=rag-chatbot
```

### 선택적 환경변수

```bash
# 로그 레벨
LOG_LEVEL=info

# Notion 세부 설정
NOTION_TIMEOUT=30000
NOTION_RETRY_ATTEMPTS=3

# 벡터 검색 설정
USE_VECTOR_SEARCH=true
VECTOR_SEARCH_FALLBACK_ENABLED=true
EMBEDDING_MODEL=text-embedding-3-small
```

## 설정 방법

1. **개발 환경 설정**
   ```bash
   # env/.env.dev 파일 생성하고 위의 환경변수들 설정
   # 직접 생성 또는 기존 파일 복사
   ```

2. **테스트 환경 설정**
   ```bash
   # env/.env.test 파일은 자동으로 생성됨
   # 필요시 테스트용 값들로 수정
   ```

## 주의사항

⚠️ **보안**: 실제 API 키나 토큰을 포함한 환경변수 파일들은 절대 git에 커밋하지 마세요!

✅ **Git 관리**: `.gitignore`에 의해 `env/.env*` 파일들은 자동으로 제외됩니다.

📝 **문서화**: 새로운 환경변수 추가 시 이 README를 업데이트해주세요.
