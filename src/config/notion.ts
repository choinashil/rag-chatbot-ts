import type { NotionConfig } from '@/types/notion'

export function createNotionConfig(): NotionConfig {
  const integrationToken = process.env.NOTION_INTEGRATION_TOKEN
  const databaseId = process.env.NOTION_DATABASE_ID

  if (!integrationToken) {
    throw new Error('NOTION_INTEGRATION_TOKEN 환경변수가 필요합니다')
  }

  if (!databaseId) {
    throw new Error('NOTION_DATABASE_ID 환경변수가 필요합니다')
  }

  return {
    integrationToken,
    databaseId,
    timeout: parseInt(process.env.NOTION_TIMEOUT || '30000', 10),
    retryAttempts: parseInt(process.env.NOTION_RETRY_ATTEMPTS || '3', 10),
  }
}