// 테스트용 노션 설정 픽스처
import type { NotionConfig } from '../../src/types/notion'

export const mockNotionConfig: NotionConfig = {
  integrationToken: 'secret_test_token_12345',
  databaseId: 'test-database-id-12345',
  timeout: 5000,
  retryAttempts: 2,
}

export const invalidNotionConfig: NotionConfig = {
  integrationToken: 'invalid_token',
  databaseId: 'invalid_database_id',
  timeout: 1000,
  retryAttempts: 1,
}