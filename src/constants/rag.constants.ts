// RAG 관련 상수 정의

export const RAG_CONFIG = {
  DEFAULT_TOP_K: 3, // RAG에서 검색할 기본 문서 개수
  DEFAULT_SCORE_THRESHOLD: 0.3, // RAG용 기본 유사도 임계값 (Pinecone과 동일)
  DEFAULT_TEMPERATURE: 0.3, // RAG용 기본 온도 (일관성 있는 답변)
  DEFAULT_MAX_TOKENS: 1000 // RAG용 기본 최대 토큰
} as const

export const RAG_MESSAGES = {
  NO_RESULTS: '죄송합니다. 관련된 정보를 찾을 수 없습니다. 다른 질문을 시도해보세요.',
  SYSTEM_PROMPT: '당신은 제공된 문서를 바탕으로 정확하고 도움이 되는 답변을 제공하는 AI 어시스턴트입니다.'
} as const