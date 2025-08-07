// 노션 서비스 전용 상수
export const NOTION_BLOCK_TYPES = {
  PARAGRAPH: 'paragraph',
  HEADING_1: 'heading_1',
  HEADING_2: 'heading_2',
  HEADING_3: 'heading_3',
  BULLETED_LIST_ITEM: 'bulleted_list_item',
  NUMBERED_LIST_ITEM: 'numbered_list_item',
  TO_DO: 'to_do',
  CODE: 'code',
  QUOTE: 'quote',
  DIVIDER: 'divider',
} as const

export const MAX_NOTION_PAGE_SIZE = 100
export const DEFAULT_NOTION_TIMEOUT = 30000
export const MAX_RETRY_ATTEMPTS = 3

export const NOTION_PROPERTY_TYPES = {
  TITLE: 'title',
  RICH_TEXT: 'rich_text',
  NUMBER: 'number',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  DATE: 'date',
  CHECKBOX: 'checkbox',
  URL: 'url',
  EMAIL: 'email',
} as const