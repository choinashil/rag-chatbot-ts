// Pinecone 관련 상수 정의

export const PINECONE_CONFIG = {
  DEFAULT_TIMEOUT: 30000, // 30초
  DEFAULT_TOP_K: 5, // 벡터 검색 시 반환할 최대 결과 개수 (상위 K개)
  DEFAULT_SCORE_THRESHOLD: 0.7, // 유사도 점수 임계값 (0.0~1.0, 이 값 이상만 반환)
  VECTOR_DIMENSION: 1536 // text-embedding-3-small 차원
} as const

export const PINECONE_ERRORS = {
  CONNECTION_FAILED: 'Pinecone 연결에 실패했습니다',
  INDEX_NOT_FOUND: '인덱스를 찾을 수 없습니다',
  UPSERT_FAILED: '벡터 저장에 실패했습니다',
  QUERY_FAILED: '벡터 검색에 실패했습니다'
} as const