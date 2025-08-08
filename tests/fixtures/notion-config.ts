// 테스트용 노션 설정 픽스처
import type { NotionConfig } from '../../src/types/notion'

export const mockNotionConfig: NotionConfig = {
  integrationToken: 'secret_test_token_12345',
  timeout: 5000,
  retryAttempts: 2,
}

export const invalidNotionConfig: NotionConfig = {
  integrationToken: 'invalid_token',
  timeout: 1000,
  retryAttempts: 1,
}

// 테스트용 데이터베이스 ID (설정에서 분리)
export const TEST_DATABASE_ID = 'test-database-id-12345'
export const INVALID_DATABASE_ID = 'invalid_database_id'