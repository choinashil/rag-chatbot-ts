/**
 * 여러 모듈에서 공유되는 공통 타입 정의
 * 순환 종속성을 방지하기 위해 별도 파일로 분리
 */

// HTML 문서 배치 처리 결과 타입
export interface BatchResult {
  total: number
  processed: number
  failed: number
  errors: BatchError[]
}

// 문서 수집 방식 타입
export type CollectionMethod = 'database' | 'page'

// 처리 결과에서 공통으로 사용되는 에러 타입
export interface ProcessingError {
  pageId: string
  title: string
  error: string
}

// HTML 크롤링용 에러 타입 (BatchResult에서 사용)
export interface BatchError {
  url: string
  title: string
  error: string
}