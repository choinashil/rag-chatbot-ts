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

// 3단계: 크롤링 관련 상수
export const CRAWL_CONSTANTS = {
  DEFAULT_MAX_DEPTH: 3,
  DEFAULT_MAX_PAGES: 50,
  DEFAULT_CONCURRENCY: 3,
  DEFAULT_CRAWL_DELAY: 1000,
  MIN_CRAWL_DELAY: 500,
  MAX_CRAWL_DELAY: 5000,
  URL_PATTERN: /^https?:\/\/.+/,
  INTERNAL_LINK_SELECTORS: 'a[href^="/"], a[href^="./"], a[href^="../"], a[href*="sixshop.com"], a[href*="help.pro.sixshop.com"]'
} as const

export const DEFAULT_CRAWL_OPTIONS = {
  maxDepth: CRAWL_CONSTANTS.DEFAULT_MAX_DEPTH,
  maxPages: CRAWL_CONSTANTS.DEFAULT_MAX_PAGES,
  domainRestriction: ['help.pro.sixshop.com'] as string[],
  includeExternal: false,
  respectRobotsTxt: true,
  crawlDelay: CRAWL_CONSTANTS.DEFAULT_CRAWL_DELAY,
  concurrency: CRAWL_CONSTANTS.DEFAULT_CONCURRENCY,
  includeParentPages: false  // 기본값: 부모 페이지 크롤링 안함
}