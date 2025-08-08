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
- **순번**: `docs/decisions/` 폴더 내 기존 파일들을 확인하여 마지막 순번 + 1로 자동 부여
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

## 개발 프로세스 정의

### 개발 진행 방식
`docs/development-plans/` 폴더의 개발 계획서를 기반으로 단계별 개발을 진행합니다.

#### 개발 계획 수립
- **계획 문서 참조**: `docs/development-plans/` 내 기존 개발 계획 문서 검토
- **향후 개선사항 고려**: 이전 단계의 '향후 개선사항' 중 개발 원칙에 부합하고 실제 필요한 기능만 선별적 적용
- **적절한 작업 단위**: 개발 원칙(MVP First, 추측성 최적화 금지, 과도한 엔지니어링 자제)에 따라 의미 있는 적절한 크기로 작업 계획
  - 너무 자잘하지 않되, 한 번에 완료 가능한 범위로 설정
  - 각 단계는 독립적으로 테스트 및 검증 가능해야 함

#### 각 단계 실행 프로세스
모든 개발 단계는 다음 순서를 엄격히 준수:

**0. 개발 계획 재검토**
- 현재 코드 상태를 바탕으로 개발 계획의 적절성 검토
- 이전 단계 구현 과정에서 변경된 사항 반영
- 문제 없으면 바로 진행, 변경 필요 시 사용자 승인 후 진행

**1. 코드 작성**
- 개발 계획에 따른 핵심 기능 구현
- TypeScript strict 모드 준수
- 기존 코드 컨벤션 및 아키텍처 패턴 따름

**2. 타입 에러 수정**
- TypeScript 컴파일 에러 해결
- `npm run typecheck` 통과 확인

**3. 테스트 작성**
- **통합 테스트**: `scripts/` 폴더에 실제 API 연동 테스트
- **단위 테스트**: `tests/unit/` 폴더에 각 클래스/메서드별 테스트
- 성공/실패 시나리오 모두 커버

**4. 테스트 실행 및 개선**
- 모든 테스트 실행 후 실패 시 코드와 테스트를 반복 수정
- 테스트 통과할 때까지 개선 작업 지속
- `npm test` 전체 테스트 스위트 통과 확인

**5. 개발 계획 문서 업데이트**
- 구현 완료된 내용 바탕으로 상태 업데이트 (체크박스 완료 처리)
- 구현 과정에서 발견된 개선사항이나 참고할 점 기록
- 다음 단계를 위한 인사이트 문서화

#### 개발 원칙 (모든 단계 공통)
1. **최소 기능으로 시작 (MVP First)**
   - RAG가 동작하는 최소 기능만 우선 구현
   - "Just Enough" 엔지니어링 추구

2. **필요할 때만 확장 (Progressive Enhancement)**
   - 실제 문제가 발생했을 때 최적화 추가
   - 추측성 최적화 금지

3. **과도한 엔지니어링 자제**
   - 복잡한 에러 처리, 캐싱, 배치 처리 등은 필요 시에만 추가
   - 기본 구현으로도 충분한지 먼저 확인

4. **적절한 작업 단위 유지**
   - 너무 세분화하지 않되, 의미 있는 기능 단위로 구분
   - 한 번의 개발 세션에서 완료 가능한 범위
   - 독립적 테스트 및 검증 가능한 단위

#### 품질 보증
- **린트 체크**: 코드 품질 표준 준수 (`npm run lint`)
- **타입 체크**: TypeScript 타입 안전성 보장 (`npm run typecheck`)
- **테스트 커버리지**: 핵심 로직 100% 테스트 커버
- **통합 검증**: 실제 외부 API 연동 동작 확인

### 작업 완료 기준
각 단계는 다음 조건을 모두 만족해야 완료로 간주:
- 모든 테스트 통과 (단위 + 통합)
- TypeScript 컴파일 에러 없음
- 개발 계획서의 완료 기준 달성
- 다음 단계 진행을 위한 기반 구조 완성

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