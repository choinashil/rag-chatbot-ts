# 설정 관리 전략: 환경변수 + 상수 조합

> OpenAI API 및 기타 서비스 설정을 환경변수와 상수의 조합으로 관리하는 전략

## 1. 배경

OpenAI API를 비롯한 외부 서비스 연동 시 다음과 같은 설정 관리 방식을 고려해야 했습니다:

- **환경변수만 사용**: 모든 설정을 `.env` 파일로 관리
- **상수만 사용**: 모든 설정을 코드 내 상수로 하드코딩
- **환경변수 + 상수 조합**: 환경변수를 우선으로 하되, 상수를 기본값으로 제공

## 2. 검토 대상

### 환경변수만 사용하는 방식
```typescript
// 환경변수 필수, 없으면 에러
const timeout = parseInt(process.env.OPENAI_TIMEOUT!, 10);
const model = process.env.OPENAI_EMBEDDING_MODEL!;
```

**장점**: 환경별 설정 분리 가능  
**단점**: 설정 누락 시 런타임 에러, 기본값 없음

### 상수만 사용하는 방식
```typescript
// 모든 설정이 코드에 하드코딩
const timeout = 30000;
const model = 'text-embedding-3-small';
```

**장점**: 설정 누락 위험 없음, 예측 가능한 동작  
**단점**: 환경별 차이 반영 불가, 설정 변경 시 재배포 필요

### 환경변수 + 상수 조합 방식
```typescript
// 환경변수 우선, 상수를 fallback으로 사용
const timeout = parseInt(process.env.OPENAI_TIMEOUT || OPENAI_DEFAULTS.TIMEOUT.toString(), 10);
const model = process.env.OPENAI_EMBEDDING_MODEL || OPENAI_MODELS.EMBEDDING;
```

**장점**: 환경별 설정 분리 + 안정성 확보  
**단점**: 설정 구조가 약간 복잡함

## 3. 의사결정 과정

### 환경별 요구사항 분석

#### 개발 환경
- 빠른 테스트를 위한 짧은 타임아웃 (5초)
- 저렴한 모델 사용으로 비용 절약
- 디버깅을 위한 상세 로그

#### 테스트 환경
- 빠른 CI/CD를 위한 최소 타임아웃 (3초)
- 재시도 없이 빠른 실패
- 모킹 우선, 실제 API 호출 최소화

#### 운영 환경
- 안정성을 위한 충분한 타임아웃 (30초)
- 높은 품질의 모델 사용
- 적절한 재시도 정책

### 실제 사용 사례

#### 비용 최적화 시나리오
```bash
# 개발환경: 저렴한 모델
OPENAI_EMBEDDING_MODEL=text-embedding-ada-002

# 운영환경: 성능과 비용의 균형
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

#### 디버깅 시나리오
```bash
# 특정 이슈 디버깅 시
OPENAI_MAX_RETRIES=0  # 재시도 없이 빠르게 실패
OPENAI_TIMEOUT=5000   # 짧은 타임아웃
```

#### A/B 테스트 시나리오
```bash
# 모델 성능 비교 테스트
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
```

## 4. 최종 결정: **환경변수 + 상수 조합**

### 선택 근거

1. **개발 유연성**: 환경별로 다른 설정을 코드 변경 없이 적용 가능
2. **안정성**: 환경변수 누락 시에도 기본값으로 동작
3. **배포 편의성**: 환경변수만 변경하여 다른 환경에 동일 코드 배포
4. **디버깅 효율성**: 일시적 설정 변경이 쉬움
5. **비용 관리**: 환경별로 적절한 모델/설정 선택 가능

### 구현 방식

```typescript
// src/config/openai.ts
export function createOpenAIConfig(): OpenAIConfig {
  const config: OpenAIConfig = {
    apiKey: process.env.OPENAI_API_KEY!,
    timeout: parseInt(process.env.OPENAI_TIMEOUT || OPENAI_DEFAULTS.TIMEOUT.toString(), 10),
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || OPENAI_DEFAULTS.MAX_RETRIES.toString(), 10),
    models: {
      embedding: process.env.OPENAI_EMBEDDING_MODEL || OPENAI_MODELS.EMBEDDING,
      chat: process.env.OPENAI_CHAT_MODEL || OPENAI_MODELS.CHAT
    }
  }
  
  // 선택적 속성은 값이 있을 때만 추가
  if (process.env.OPENAI_ORGANIZATION) {
    config.organization = process.env.OPENAI_ORGANIZATION
  }
  
  return config
}
```

### 기각된 옵션들의 이유

- **환경변수만 사용**: 기본값 부재로 인한 불안정성
- **상수만 사용**: 환경별 차이 반영 불가능, 운영 유연성 부족

## 5. 구현 전략

### 환경변수 우선순위
1. **필수 환경변수**: API 키 등 보안 관련 (없으면 에러)
2. **선택적 환경변수**: 타임아웃, 모델명 등 (기본값 제공)
3. **조건부 환경변수**: 조직 ID 등 (있을 때만 적용)

### 상수 관리 규칙
```typescript
// src/constants/openai.constants.ts
export const OPENAI_DEFAULTS = {
  TIMEOUT: 30000,           // 30초
  MAX_RETRIES: 3,          // 3회 재시도
  EMBEDDING_DIMENSIONS: 1536
} as const

export const OPENAI_MODELS = {
  EMBEDDING: 'text-embedding-3-small',  // 가성비 최고
  CHAT: 'gpt-3.5-turbo'                // 범용적 사용
} as const
```

## 6. 향후 고려사항

### 모니터링 요소
- 환경별 설정값 사용 통계
- 기본값 사용 빈도 추적
- 환경변수 누락으로 인한 기본값 사용 알림

### 확장 고려사항
- 설정 값 검증 로직 강화
- 런타임 설정 변경 기능 (필요시)
- 설정 히스토리 관리 (감사 목적)

---
**작성일**: 2025-08-07  
**작성자**: Development Team  
**다음 리뷰**: 2025-09-07