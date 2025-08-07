# server.ts 코드 상세 설명

> **작성일**: 2025-08-07 11:00  
> **파일**: `src/server.ts`  
> **버전**: 단순화 버전 (순수 API 서버)

## 개요
Fastify 기반 순수 API 서버의 메인 파일로, 서버 초기화, 미들웨어 설정, 헬스체크 라우트만 포함합니다.

## 코드 구조별 상세 설명

### 1. 서버 실행 메커니즘 (81-83라인)

```typescript
if (require.main === module) {
  start();
}
```

**설명:**
- `require.main`: Node.js가 처음 실행된 메인 모듈을 가리킴
- `module`: 현재 파일(server.ts) 자체를 가리킴
- **동작 방식**: 이 파일이 직접 실행될 때만 `start()` 함수 호출
- **사용 사례**:
  - `tsx src/server.ts` → start() 실행됨 (서버 시작)
  - `import { buildApp } from './server'` → start() 실행 안됨 (테스트용)

### 2. buildApp 함수의 역할과 Export (85라인)

```typescript
export { buildApp };
```

**사용 목적:**
- **테스트 환경**: Jest 테스트에서 서버 인스턴스 생성
- **다른 모듈에서 재사용**: 실제 서버 시작 없이 Fastify 앱만 생성
- **예시**: `const app = await buildApp(); // 포트 바인딩 없이 앱만 생성`

### 3. 시그널 핸들링 - 우아한 종료 (70-79라인)

```typescript
process.on('SIGINT', async () => {
  console.log('SIGINT 신호 수신, 우아하게 종료합니다');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM 신호 수신, 우아하게 종료합니다');
  process.exit(0);
});
```

**시그널 종류:**
- **SIGINT**: 사용자가 Ctrl+C를 누를 때 발생
- **SIGTERM**: 프로세스 매니저(PM2, Docker 등)가 보내는 정상 종료 신호

**목적**: 갑작스런 프로세스 종료 대신, 진행 중인 요청을 완료한 후 우아하게 종료

### 4. 보안 미들웨어 - Helmet (31-34라인)

```typescript
// 보안 미들웨어
await app.register(helmet, {
  contentSecurityPolicy: false, // 개발환경에서 비활성화
});
```

**Helmet이 추가하는 보안 헤더:**
- `X-Frame-Options: DENY`: 클릭재킹(Clickjacking) 공격 방지
- `X-Content-Type-Options: nosniff`: MIME 타입 스니핑 공격 방지
- `X-XSS-Protection: 1; mode=block`: XSS(Cross-Site Scripting) 공격 방지
- `Strict-Transport-Security`: HTTPS 강제 사용

**CSP 비활성화 이유**: 개발환경에서 인라인 스크립트 사용을 허용하기 위해

### 5. Rate Limiting - API 사용량 제한 (36-39라인)

```typescript
await app.register(rateLimit, {
  max: 100,              // 최대 요청 수
  timeWindow: '1 minute', // 시간 창
});
```

**역할:**
- **DDoS 공격 방지**: 대량 요청으로부터 서버 보호
- **API 남용 제한**: 동일 IP에서 1분 동안 최대 100개 요청만 허용
- **자동 차단**: 제한 초과 시 HTTP 429 (Too Many Requests) 응답

### 6. CORS 설정의 환경별 차이 (41-44라인)

```typescript
// CORS 설정
await app.register(cors, {
  origin: process.env.NODE_ENV === 'production' ? false : true,
});
```

**환경별 동작:**
- **개발환경 (true)**: 모든 도메인에서 API 접근 허용 (편의성 우선)
- **프로덕션 (false)**: CORS 요청 차단 (보안 우선)

**실제 프로덕션 권장사항**: 특정 허용 도메인 목록 지정
```typescript
origin: ['https://yourdomain.com', 'https://admin.yourdomain.com']
```

### 7. 라우트 등록 - 헬스체크만 (49라인)

```typescript
// 라우트 등록
await app.register(registerHealthRoutes, { prefix: '/api' });
```

**현재 등록된 라우트:**
- `/api/health`: 서버 상태 확인
- `/api/ping`: 단순 연결 테스트

**제거된 기능들:**
- ChatService 관련 라우트
- FeedbackService 관련 라우트
- 정적 파일 서빙

### 8. 폴더 구조 (현재)

```
src/
├── routes/
│   └── health.routes.ts    # 헬스체크만
├── types/
│   └── index.ts           # 기본 타입만
└── server.ts              # 메인 서버 파일
```

## 환경변수 의존성

| 변수 | 필수 여부 | 기본값 | 설명 |
|------|----------|--------|------|
| `PORT` | 선택 | 8000 | 서버 포트 |
| `NODE_ENV` | 선택 | development | 환경 구분 |
| `LOG_LEVEL` | 선택 | info | 로그 레벨 |

**제거된 환경변수:**
- `OPENAI_API_KEY` (더 이상 필수 아님)

## 현재 API 엔드포인트

### GET /api/health
서버 및 서비스 상태 확인
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-08-07T02:00:00.000Z",
    "services": {}
  }
}
```

### GET /api/ping
단순 연결 테스트
```json
{
  "success": true,
  "data": "pong",
  "timestamp": "2025-08-07T02:00:00.000Z"
}
```

## 다음 개선 고려사항

1. **CORS 설정 개선**: 프로덕션에서 허용 도메인 명시
2. **Graceful Shutdown 강화**: 진행 중인 요청 대기 로직 추가
3. **기능 추가 준비**: 새로운 서비스 추가시 확장 가능한 구조
4. **로깅 구조화**: 요청/응답 로깅 미들웨어 추가

## 변경사항 (이전 버전 대비)

**제거된 기능:**
- ChatService, FeedbackService
- 정적 파일 서빙 (`@fastify/static`)
- 서비스 decoration
- 복잡한 헬스체크 로직

**유지된 기능:**
- 기본 서버 설정 및 미들웨어
- 헬스체크 API
- 시그널 핸들링
- 환경변수 설정

---

**최종 수정일**: 2025-08-07 11:00  
**다음 리뷰 예정**: 새로운 기능 추가시