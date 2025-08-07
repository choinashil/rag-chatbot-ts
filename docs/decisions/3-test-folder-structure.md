# 테스트 폴더 구조 선택

> **작성일**: 2025-08-07 12:00  
> **결정 사항**: 테스트 코드를 별도 `tests/` 폴더에 분리  
> **적용 범위**: 모든 테스트 코드 (단위, 통합, E2E)

## 배경

테스트 코드 작성 시 프로덕션 코드와 같은 폴더에 위치시킬지, 별도 폴더에 분리할지 결정 필요. 두 방식 모두 장단점이 있어 프로젝트 특성에 맞는 선택이 필요함.

## 검토 대상

### 방식 1: 분리된 구조 (선택됨)
```
src/services/notion/notion.service.ts
tests/unit/services/notion/notion.service.test.ts
```

### 방식 2: 같은 폴더 구조
```
src/services/notion/
├── notion.service.ts
├── notion.service.test.ts
├── notion.mapper.ts
└── notion.mapper.test.ts
```

## 의사결정 과정

### 비교 분석

| 항목 | 분리된 구조 | 같은 폴더 구조 |
|------|-------------|----------------|
| **빌드 최적화** | ⭐⭐⭐ 프로덕션에서 완전 제외 | ⭐ 추가 설정 필요 |
| **배포 용량** | ⭐⭐⭐ 테스트 코드 배포 안됨 | ⭐ 별도 제외 처리 필요 |
| **관리 편의성** | ⭐⭐ 경로 추적 필요 | ⭐⭐⭐ 바로 인접 |
| **리팩토링** | ⭐⭐ 두 곳 수정 필요 | ⭐⭐⭐ 함께 이동 |
| **IDE 성능** | ⭐⭐⭐ 큰 프로젝트에서 유리 | ⭐⭐ 파일 수 증가 |
| **생태계 표준** | ⭐⭐⭐ Node.js/Jest 권장 | ⭐⭐ Go/Rust 방식 |

### 프로젝트별 고려사항

#### RAG 챗봇 프로젝트 특성
- **배포 최적화 중요**: API 서버로 빠른 시작 시간 필요
- **테스트 종류 다양**: unit, integration, API 테스트 구분 필요
- **Fastify + TypeScript**: Node.js 생태계 표준 준수

#### 팀 및 개발 환경
- **MVP 단계**: 빌드/배포 최적화 우선
- **단일 개발자**: 관리 편의성보다 성능 우선
- **CI/CD 고려**: 테스트와 빌드 단계 명확 분리

### 다른 프로젝트 사례 분석

**분리된 구조 채택:**
- Jest 공식 권장사항
- React, Vue, Angular 생태계
- Express, Fastify 프로젝트들
- 대부분의 Node.js 오픈소스

**같은 폴더 구조 채택:**
- Go 언어 표준 (`_test.go`)
- Rust 언어 표준 (`_test.rs`)
- 일부 Python 프로젝트

## 최종 결정: 분리된 구조

### 선택 근거

**1. 빌드 최적화 (⭐⭐⭐)**
```json
// package.json - 프로덕션 빌드
{
  "scripts": {
    "build": "tsc",  // src/만 컴파일, tests/ 제외
  }
}
```

**2. 배포 용량 절약 (⭐⭐⭐)**
- Docker 이미지 크기 최소화
- 서버 시작 시간 단축
- 메모리 사용량 절약

**3. 테스트 종류별 구분 (⭐⭐⭐)**
```
tests/
├── unit/        # 단위 테스트
├── integration/ # 통합 테스트
└── e2e/         # E2E 테스트 (향후)
```

**4. 생태계 표준 (⭐⭐⭐)**
- Jest 공식 문서 권장
- TypeScript 프로젝트 표준
- Fastify 생태계 관례

### 채택된 구조

```
tests/
├── unit/                    # 단위 테스트
│   ├── services/
│   │   └── notion/
│   │       └── notion.service.test.ts
│   └── utils/
│       └── text.utils.test.ts
├── integration/             # 통합 테스트
│   ├── health-api.test.ts
│   └── notion-api.test.ts
├── fixtures/               # 테스트 데이터
│   └── notion-config.ts
└── setup.ts               # 전역 설정
```

### 관리 편의성 보완 방안

**1. IDE 설정 활용**
- VS Code Workspace 설정으로 관련 파일 그룹핑
- 파일 탐색 단축키 활용

**2. 네이밍 규칙 통일**
```
src/services/notion/notion.service.ts
tests/unit/services/notion/notion.service.test.ts
```

**3. 스크립트 자동화**
```bash
# 새 서비스 생성시 테스트 파일도 함께 생성
npm run generate:service notion
```

## 기각된 선택지와 이유

### 같은 폴더 구조 기각 사유
1. **빌드 설정 복잡화**: `*.test.ts` 파일 제외 설정 필요
2. **배포 위험성**: 실수로 테스트 코드 포함 가능성
3. **프로젝트 규모**: 파일 수 증가로 폴더 구조 복잡화
4. **생태계 비표준**: Node.js 커뮤니티 관례와 상충

## 향후 고려사항

1. **Co-location 부분 도입**: 유틸리티성 함수는 같은 폴더 검토
2. **테스트 파일 증가시**: 하위 디렉토리 세분화
3. **팀 규모 확장시**: 개발자 선호도 재검토

---

**최종 수정일**: 2025-08-07 12:00  
**다음 리뷰 예정**: 테스트 코드 작성 완료 후