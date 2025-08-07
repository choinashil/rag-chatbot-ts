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