// SSE 스트리밍 관련 타입 정의

export interface StreamingChatRequest {
  message: string
}

export interface StreamingEvent {
  type: 'status' | 'token' | 'sources' | 'done' | 'error'
  content?: string
  data?: any
}

export interface StreamingStatus {
  message: string
  timestamp: string
}

export interface StreamingError {
  message: string
  code?: string
  timestamp: string
}

export type StreamingEventHandler = (event: StreamingEvent) => void