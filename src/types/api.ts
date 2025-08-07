// API 관련 기본 타입
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}

export interface ErrorResponse {
  success: false
  error: string
  code?: string
  timestamp: string
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'initializing'
  timestamp: string
  services: Record<string, ServiceStatus>
}

export interface ServiceStatus {
  connected: boolean
  lastCheck: string
  error?: string
  metadata?: Record<string, unknown>
}