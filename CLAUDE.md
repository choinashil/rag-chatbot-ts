# RAG Chatbot v2 - Project Guidelines

## 프로젝트 개요
Express.js + JavaScript 기반 RAG 챗봇을 Fastify + TypeScript로 전환하여 프로덕션 레벨로 개선하는 프로젝트

## 기술 의사결정 문서 작성 규칙

### 1. 파일 위치
- 모든 기술 의사결정 문서는 `docs/decisions/` 폴더에 작성
- 파일명 형식: `{순번}-{주제}.md`
  - 예: `1-framework-and-language-selection.md`
  - 예: `2-database-selection.md`

### 2. 파일명 규칙
- **순번**: 생성 순서대로 1, 2, 3... 부여
- **주제**: 의사결정 주요 내용을 간결하게 표현 (영어, kebab-case)
- 공통 주제 예시:
  - `framework-selection`: 프레임워크 선택
  - `database-selection`: 데이터베이스 선택  
  - `testing-strategy`: 테스팅 전략
  - `deployment-architecture`: 배포 아키텍처
  - `security-implementation`: 보안 구현
  - `api-design`: API 설계

### 3. 문서 구조
```markdown
# {결정 주제}

> {결정에 대한 간단한 설명}

## 1. 배경
{의사결정이 필요한 상황과 문제점}

## 2. 검토 대상
{고려된 옵션들}

## 3. 의사결정 과정
{각 옵션의 장단점 비교 및 평가 과정}

## 4. 최종 결정: **{선택된 옵션}**
{선택 근거와 기각된 옵션들의 이유}

## 5. 구현 전략 (선택사항)
{실제 적용 방법이나 마이그레이션 계획}

## 6. 향후 고려사항 (선택사항)
{추후 재검토가 필요한 상황들}

---
**작성일**: {YYYY-MM-DD}  
**작성자**: {작성자}  
**다음 리뷰**: {언제 재검토할지}
```

### 4. 의사결정 기준
모든 기술 선택은 다음 우선순위를 고려:
1. **RAG 서비스 특성 최적화**: 응답 속도, 메모리 효율성
2. **MVP 개발 속도**: 빠른 구현과 검증 가능성
3. **확장 가능성**: 향후 성장에 대한 유연한 대응
4. **팀 학습 곡선**: 기존 지식 활용과 점진적 개선

### 5. 문서 작성 시점
다음과 같은 경우 반드시 의사결정 문서 작성:
- 새로운 기술 스택 도입
- 아키텍처 변경
- 중요한 라이브러리/프레임워크 교체
- 보안, 성능 관련 중요 결정
- 배포/인프라 전략 변경

## 현재 기술 스택
- **언어**: TypeScript (JavaScript에서 마이그레이션 중)
- **프레임워크**: Fastify (Express에서 마이그레이션 예정)
- **데이터베이스**: TBD
- **벡터DB**: Pinecone
- **LLM**: OpenAI GPT-3.5-turbo
- **GraphQL 클라이언트**: graphql-request

## 프로젝트 명령어
```bash
# 개발 서버 실행
npm run dev

# 타입 체크
npm run typecheck

# 린트
npm run lint

# 테스트
npm run test

# 빌드
npm run build
```

## 추가 가이드라인
- 모든 코드는 TypeScript로 작성
- GraphQL 요청은 외부 Apollo 서버에 대한 클라이언트 역할만 수행
- RAG 서비스 특성상 성능과 메모리 효율성을 최우선으로 고려
- MVP 버전으로 빠른 검증 후 점진적 개선

## 프로젝트 구조 및 코드 컨벤션

### 폴더 구조
```
src/
├── config/              # 설정 관리
│   ├── index.ts         # 통합 설정 export
│   ├── database.ts      # DB 관련 설정
│   ├── openai.ts        # OpenAI 설정
│   ├── graphql.ts       # GraphQL 클라이언트 설정
│   └── validation.ts    # 환경변수 검증
├── types/               # 타입 정의
│   ├── index.ts         # 공통 타입 export
│   ├── api.ts           # API 관련 타입
│   ├── document.ts      # 문서 관련 타입
│   ├── vector.ts        # 벡터 검색 타입
│   ├── notion.ts        # Notion 관련 타입
│   └── graphql.ts       # GraphQL 관련 타입
├── services/            # 비즈니스 로직
│   ├── notion/          # Notion 관련 서비스
│   │   ├── notion.service.ts
│   │   ├── notion.mapper.ts      # 데이터 변환
│   │   ├── notion.validator.ts   # 데이터 검증
│   │   └── notion.constants.ts   # Notion 전용 상수
│   ├── vector/          # 벡터 검색 서비스
│   │   ├── vector.service.ts
│   │   ├── pinecone.client.ts
│   │   ├── embedding.service.ts
│   │   └── vector.constants.ts   # 벡터 서비스 전용 상수
│   ├── graphql/         # GraphQL 클라이언트 서비스
│   │   ├── graphql.service.ts    # 메인 GraphQL 서비스
│   │   ├── graphql.client.ts     # GraphQL 클라이언트 설정
│   │   ├── graphql.types.ts      # GraphQL 관련 타입
│   │   ├── graphql.constants.ts  # GraphQL 상수
│   │   ├── queries/              # 쿼리 정의
│   │   │   ├── index.ts
│   │   │   ├── user.queries.ts
│   │   │   └── document.queries.ts
│   │   ├── mutations/            # 뮤테이션 정의
│   │   │   ├── index.ts
│   │   │   └── user.mutations.ts
│   │   └── fragments/            # GraphQL 프래그먼트
│   │       ├── index.ts
│   │       └── user.fragments.ts
│   ├── chat/            # 채팅 관련 서비스
│   │   ├── chat.service.ts
│   │   ├── rag.service.ts        # RAG 로직
│   │   └── prompt.service.ts     # 프롬프트 관리
│   └── shared/          # 공통 서비스
│       ├── logger.service.ts
│       └── cache.service.ts
├── routes/              # API 라우트
│   ├── index.ts         # 라우트 통합
│   ├── health.routes.ts
│   ├── chat.routes.ts
│   ├── documents.routes.ts
│   └── admin.routes.ts
├── middleware/          # 미들웨어
│   ├── auth.middleware.ts
│   ├── validation.middleware.ts
│   ├── error.middleware.ts
│   └── logging.middleware.ts
├── utils/               # 유틸리티 함수
│   ├── index.ts
│   ├── text.utils.ts    # 텍스트 처리
│   ├── date.utils.ts    # 날짜 처리
│   └── error.utils.ts   # 에러 처리
├── constants/           # 프로젝트 레벨 상수
│   ├── index.ts         # 모든 상수 export
│   ├── api.constants.ts # API 관련 상수
│   └── system.constants.ts # 시스템 상수
└── server.ts            # 메인 서버 파일
```

### 네이밍 컨벤션
- **파일명**: kebab-case (예: `notion.service.ts`, `chat.routes.ts`)
- **클래스명**: PascalCase (예: `NotionService`, `VectorSearchService`)
- **함수/변수명**: camelCase (예: `getUserDocuments`, `isVectorSearchEnabled`)
- **상수**: SCREAMING_SNAKE_CASE (예: `MAX_CHUNK_SIZE`, `DEFAULT_EMBEDDING_MODEL`)
- **타입/인터페이스**: PascalCase (예: `ChatRequest`, `DocumentSource`)
- **열거형**: PascalCase, 값은 camelCase

### 상수 위치 규칙
- **전역 상수**: `src/constants/` (여러 서비스에서 사용)
- **서비스별 상수**: 각 서비스 폴더 내 (해당 서비스에서만 사용)

### 파일 구조 패턴
```typescript
// 1. 외부 라이브러리 import
import OpenAI from 'openai'
import { Client } from '@notionhq/client'

// 2. 내부 타입/유틸 import  
import { Document, ChatResponse } from '@/types'
import { logger } from '@/utils'

// 3. 상대 경로 import
import { NotionMapper } from './notion.mapper'

// 4. 타입 정의
// 5. 클래스/함수 구현 (생성자 → private → public 순서)
```

### 에러 처리 패턴
```typescript
// 커스텀 에러 클래스 사용
export class NotionApiError extends Error {
  constructor(message: string, public statusCode: number, public cause?: Error) {
    super(message)
    this.name = 'NotionApiError'
  }
}

// 에러 처리 패턴
try {
  const result = await riskyOperation()
  return { success: true, data: result }
} catch (error) {
  logger.error('작업 실패:', error)
  throw new ServiceError('작업을 완료할 수 없습니다', { cause: error })
}
```

### 테스트 코드 구조 및 컨벤션

#### 폴더 구조
```
tests/
├── unit/                    # 단위 테스트
│   ├── services/
│   │   └── notion/
│   │       └── notion.service.test.ts
│   └── utils/
│       └── text.utils.test.ts
├── integration/             # 통합 테스트
│   ├── health-api.test.ts   # API 엔드포인트 테스트
│   └── notion-api.test.ts   # 외부 서비스 연동 테스트
├── fixtures/               # 테스트 데이터
│   ├── notion-config.ts    # 설정 픽스처
│   └── notion-pages.json   # 응답 데이터 픽스처
└── setup.ts               # 전역 테스트 설정
```

#### 테스트 파일 네이밍
- **단위 테스트**: `{대상}.test.ts` (예: `notion.service.test.ts`)
- **통합 테스트**: `{기능}-api.test.ts` (예: `health-api.test.ts`)
- **픽스처**: `{대상}-{타입}.ts` (예: `notion-config.ts`)

#### 테스트 작성 패턴
```typescript
describe('클래스명 또는 기능명', () => {
  // 설정
  beforeEach(() => { /* 각 테스트 전 초기화 */ })
  afterEach(() => { /* 각 테스트 후 정리 */ })

  describe('메서드명 또는 시나리오', () => {
    test('구체적인 동작 설명', async () => {
      // Given (준비)
      const mockData = createMockData()
      
      // When (실행)  
      const result = await targetMethod(mockData)
      
      // Then (검증)
      expect(result).toBe(expectedValue)
    })
  })
})
```

#### 테스트 명령어
- `npm test`: 모든 테스트 실행
- `npm run test:watch`: 파일 변경 시 자동 재실행
- `npm run test:coverage`: 커버리지 포함 테스트 실행

#### 모킹 규칙
- **외부 라이브러리**: `jest.mock()` 사용
- **내부 모듈**: 의존성 주입 또는 스파이 사용
- **환경변수**: `process.env` 직접 설정 또는 `.env.test` 사용

## 코드 작성 규칙
- **언어 정책**: 모든 주석, 콘솔 로그, 에러 메시지는 한글로 작성
- **변수/함수명**: 영어로 작성 (camelCase)
- **파일명**: 영어로 작성 (kebab-case)
- **문서**: 한글로 작성

## 코드 설명 문서 규칙
- **위치**: `docs/code-explanations/` 폴더
- **파일명 형식**: `{YYMMDD}-{HHMM}-{주제}.md`
  - 예: `20250807-1040-server-implementation.md`
- **목적**: 코드 이해를 위한 상세 설명, 설계 의도, 주요 로직 해설
- **업데이트**: 해당 코드가 수정될 때마다 새 문서 생성 (이전 버전 유지)
- **내용 구성**:
  - 개요 및 역할
  - 코드 블록별 상세 설명
  - 설계 결정 근거
  - 환경변수 의존성
  - 개선 고려사항

## 개발 계획 문서 규칙
- **위치**: `docs/development-plans/` 폴더
- **파일명 형식**: `{YYMMDD}-{HHMM}-{주제}.md`
  - 예: `20250807-1110-rag-chatbot-migration.md`
- **목적**: 개발 로드맵, 구현 계획, 마이그레이션 계획 등
- **내용 구성**:
  - 개요 및 목적
  - 단계별 상세 계획
  - 마일스톤 및 완료 기준
  - 위험 요소 및 대응 방안
  - 성공 기준