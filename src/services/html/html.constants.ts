export const HTML_PARSING_CONSTANTS = {
  UNNECESSARY_TAGS: 'script, style, nav, footer, aside',
  CONTENT_SEPARATOR: 'Search',
  REQUEST_TIMEOUT: 30000,
  USER_AGENT: 'Mozilla/5.0 (compatible; SixshopBot/1.0; +https://help.pro.sixshop.com/)',
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY: 1000
} as const

export const DEFAULT_TEST_PAGES = {
  WEBSITE_DESIGN: 'https://help.pro.sixshop.com/design',
  WEBSITE_DESIGN_START: 'https://help.pro.sixshop.com/design/start'
} as const