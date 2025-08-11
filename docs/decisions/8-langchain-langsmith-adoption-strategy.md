# LangChain/LangSmith 도입 전략

> 현재 커스텀 RAG 구현체와 검증된 LangChain 생태계 간의 최적 결합 방식 결정

## 1. 배경

현재 rag-chatbot-ts는 Fastify + TypeScript 기반으로 고도화된 RAG 시스템을 구현하고 있습니다. 주요 특징:
- 커스텀 HTML 파싱 시스템 (Oopy 하이브리드 크롤링)
- tiktoken 기반 100% 정확한 토큰 계산
- SSE 기반 스트리밍 챗봇
- 전략 패턴 기반 파서 (OopyParser, GenericParser)

MVP 단계에서 모니터링과 고도화를 위한 외부 도구 도입을 검토하게 되었습니다.

## 2. 검토 대상

### 옵션 1: 현재 구현 유지 + 커스텀 확장
- Notion 기반 피드백 시스템 확장
- 직접 구현으로 모든 모니터링 기능 개발
- 완전한 커스텀 제어 가능

### 옵션 2: LangChain/LangSmith 완전 마이그레이션
- 기존 구현체 전면 교체
- LangChain으로 RAG 파이프라인 재구성
- LangSmith로 모니터링/분석 통합

### 옵션 3: 하이브리드 접근 (점진적 도입)
- 커스텀 자산 유지 (HTML 파싱, 서버 구조)
- LangSmith 모니터링만 우선 도입
- LangChain 기능 선택적 적용

## 3. 의사결정 과정

### 현재 구현체 분석
**✅ 강점:**
- Oopy 토글 하이브리드 크롤링 (독보적 기능)
- Fastify 20% 성능 향상 + 메모리 효율성
- tiktoken 100% 토큰 정확도 (46-57% → 100% 개선)
- 완전한 TypeScript 타입 안전성

**❌ 한계:**
- 기본적인 RAG 파이프라인 (고급 검색 기법 부재)
- 수동 모니터링 (Notion 기반)
- 복잡한 multi-step 추론 불가
- 바이브코딩 의존성 (유지보수 부담)

### LangChain/LangSmith 추가 가치 분석

#### LangChain 추가 기능:
- **Advanced Retrievers**: Self-Query, Contextual Compression, Multi-Vector (20-30% 검색 품질 향상)
- **Agent System**: Multi-Agent 구조, Tool Integration, Planning Agent (복잡한 질문 처리)
- **Document Loaders**: 100+ 데이터 소스 지원
- **검증된 안정성**: 프로덕션 환경에서 검증된 라이브러리

#### LangSmith 추가 기능:
- **자동 트레이싱**: @traceable 데코레이터로 전체 파이프라인 추적
- **실시간 대시보드**: 토큰 비용, 레이턴시, 에러율 자동 모니터링
- **A/B 테스팅**: 모델/프롬프트 성능 비교
- **디버깅 도구**: 10배 향상된 디버깅 효율성

#### 성능 및 제약 분석:
- **성능 저하**: 추상화 레이어로 인해 10-20% 응답 시간 증가 예상
- **커스텀 제약**: 한국어 필드명, 특수 요구사항 제한적
- **비용 추가**: LangSmith Pro $39+/월
- **벤더 종속성**: LangChain 생태계 의존

### 마이그레이션 시나리오별 분석

| 시나리오 | 개발 시간 | 월 비용 | 커스텀 가능성 | 자동화 수준 | 성능 | 안정성 |
|----------|-----------|---------|---------------|-------------|------|--------|
| **현재 유지** | 2주 | $0 | 100% | 20% | 100% | 80% |
| **완전 마이그레이션** | 6-8주 | $39+ | 60% | 90% | 80% | 95% |
| **하이브리드** | 3-4주 | $39+ | 90% | 80% | 90% | 95% |

## 4. 최종 결정: **하이브리드 접근 (점진적 도입)**

### 핵심 선택 근거:
1. **기존 자산 보존**: Oopy 하이브리드 크롤링, 고성능 서버 구조 등 경쟁 우위 요소 유지
2. **즉시 효과**: LangSmith 모니터링으로 운영 효율성 10배 향상
3. **리스크 최소화**: 점진적 도입으로 실패 리스크 분산
4. **바이브코딩 활용**: 현재 역량으로 커스텀 부분은 지속 개발, 표준 부분만 도구 활용

## 5. 구현 전략

### Phase 1: LangSmith 모니터링 도입 (1-2주)
```typescript
// 기존 RAG 로직 유지 + @traceable 추가
const ragService = traceable(
  async (question: string) => {
    return await this.askQuestion(question) // 기존 로직 그대로
  },
  { name: "rag_pipeline" }
)

// Notion + LangSmith 하이브리드 피드백
await feedbackService.logWithEnhancedMetrics({
  // 기존 Notion 필드
  질문: question,
  답변: answer,
  // LangSmith 연동 데이터
  langsmithTraceId: getCurrentTraceId(),
  토큰사용량: tokenUsage,
  응답시간: responseTime
})
```

**즉시 효과:**
- 자동 성능/비용 추적
- 실시간 모니터링 대시보드
- A/B 테스팅 인프라 확보
- 기존 기능 100% 유지

### Phase 2: Advanced Retrievers 도입 (1개월)
```typescript
// 기존 벡터 검색 → 고급 검색으로 업그레이드
const enhancedRetriever = new ContextualCompressionRetriever({
  baseRetriever: this.vectorStore.asRetriever(),
  baseCompressor: new LLMChainExtractor({
    llm: this.chatModel
  })
})
```

**예상 효과:**
- 검색 정확도 20-30% 향상
- 불필요한 컨텍스트 제거로 토큰 비용 절약

### Phase 3: Agent System 도입 (3-6개월)
```typescript
// 복잡한 질문 처리를 위한 에이전트
const agentExecutor = createReactAgent({
  llm: chatModel,
  tools: [
    createRetrieverTool(enhancedRetriever, {
      name: "knowledge_search",
      description: "회사 문서에서 정보 검색"
    })
  ]
})
```

**새로운 기능:**
- "작년 매출과 올해 목표를 비교해서 달성률을 계산해줘"
- "A제품과 B제품의 장단점을 비교 분석해줘"

### 영구 유지: 핵심 경쟁 우위
- ✅ HTML 파싱 시스템 (Oopy 하이브리드 크롤링)
- ✅ Fastify 고성능 API (20% 성능 우위)
- ✅ tiktoken 100% 정확도 (비용 최적화)
- ✅ 한국어 특화 프롬프트/필드

## 6. 향후 고려사항

### 단기 모니터링 지표 (3개월)
- LangSmith 모니터링 도입 후 운영 효율성 측정
- 커스텀 vs 표준 기능 성능 비교
- 사용자 만족도 변화 추적

### 장기 진화 방향 (6-12개월)
- Agent 시스템 활용도에 따른 추가 확장 검토
- 새로운 LangChain 기능 선택적 도입
- 커스텀 구현과 표준 라이브러리의 최적 균형점 탐색

### 재검토 조건
- 현재 커스텀 기능의 유지보수 부담이 과도해질 경우
- LangChain 생태계에서 현재 커스텀 기능을 완전 대체 가능한 기능 출시 시
- 팀 확장으로 표준화된 도구의 필요성이 증가할 경우

---
**작성일**: 2025-08-11  
**작성자**: Development Team  
**다음 리뷰**: 2025-11-11 (3개월 후)