// 기본 타입 정의
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  services: Record<string, any>;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  timestamp: string;
}