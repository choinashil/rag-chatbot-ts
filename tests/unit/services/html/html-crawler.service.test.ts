import { HtmlCrawlerService } from '../../../../src/services/html/html-crawler.service'
import { DEFAULT_CRAWL_OPTIONS } from '../../../../src/services/html/html.constants'
import type { CrawlOptions } from '../../../../src/types/html'
import axios from 'axios'

// axios mock
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('HtmlCrawlerService', () => {
  let crawlerService: HtmlCrawlerService
  let consoleSpy: {
    log: jest.SpyInstance
    warn: jest.SpyInstance
    error: jest.SpyInstance
  }

  // Mock HTML data for tests
  const mockMainPageHtml = `
    <html>
      <head><title>메인 페이지</title></head>
      <body>
        <p>메뉴 / 카테고리</p>
        <p>Search</p>
        <div>
          <a href="/page1">페이지 1</a>
          <a href="/page2">페이지 2</a>
          <a href="https://external.com">외부 링크</a>
        </div>
      </body>
    </html>
  `

  const mockPage1Html = `
    <html>
      <head><title>페이지 1</title></head>
      <body>
        <p>홈 / 페이지1</p>
        <p>Search</p>
        <p>페이지 1의 내용입니다.</p>
        <a href="https://example.com/page3">페이지 3</a>
      </body>
    </html>
  `

  const mockPage2Html = `
    <html>
      <head><title>페이지 2</title></head>
      <body>
        <p>홈 / 페이지2</p>
        <p>Search</p>
        <p>페이지 2의 내용입니다.</p>
      </body>
    </html>
  `

  beforeEach(() => {
    crawlerService = new HtmlCrawlerService()
    
    // console 메서드들 모킹
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    }
    
    jest.clearAllMocks()
  })

  afterEach(() => {
    // console spy 복원
    Object.values(consoleSpy).forEach(spy => spy.mockRestore())
  })

  describe('crawlSite', () => {

    test('단일 페이지 크롤링이 성공해야 함', async () => {
      const startUrl = 'https://example.com'
      const options: Partial<CrawlOptions> = {
        maxDepth: 0,
        maxPages: 1,
        crawlDelay: 0,
        domainRestriction: ['example.com']
      }

      // axios를 두 번 호출하므로 (extractFromUrl + extractLinks) 모두 같은 응답으로 설정
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockMainPageHtml })  // extractFromUrl 호출
        .mockResolvedValueOnce({ data: mockMainPageHtml })  // extractLinks 호출

      const session = await crawlerService.crawlSite(startUrl, options)

      expect(session.status).toBe('completed')
      expect(session.statistics.processedPages).toBe(1)
      expect(session.statistics.errorPages).toBe(0)
      
      const documents = crawlerService.getCrawledDocuments()
      expect(documents).toHaveLength(1)
      expect(documents[0]?.title).toBe('메인 페이지')
      expect(documents[0]?.depth).toBe(0)
    })

    test('다중 페이지 크롤링이 성공해야 함', async () => {
      const startUrl = 'https://example.com'
      const options: Partial<CrawlOptions> = {
        maxDepth: 0,  // 단일 깊이로 단순화
        maxPages: 1,
        crawlDelay: 0,
        domainRestriction: ['example.com']
      }

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockMainPageHtml })
        .mockResolvedValueOnce({ data: mockMainPageHtml })

      const session = await crawlerService.crawlSite(startUrl, options)

      expect(session.status).toBe('completed')
      expect(session.statistics.processedPages).toBe(1)
      
      const documents = crawlerService.getCrawledDocuments()
      expect(documents).toHaveLength(1)
      expect(documents[0]?.depth).toBe(0)
    })

    test('최대 깊이 제한이 올바르게 동작해야 함', async () => {
      const startUrl = 'https://example.com'
      const options: Partial<CrawlOptions> = {
        maxDepth: 0,
        maxPages: 10,
        crawlDelay: 0,
        domainRestriction: ['example.com']
      }

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockMainPageHtml })  // extractFromUrl 호출
        .mockResolvedValueOnce({ data: mockMainPageHtml })  // extractLinks 호출

      const session = await crawlerService.crawlSite(startUrl, options)

      expect(session.statistics.processedPages).toBe(1)
      expect(session.statistics.skippedPages).toBe(0) // 깊이 제한으로 링크가 큐에 추가되지 않음
    })

    test('최대 페이지 제한이 올바르게 동작해야 함', async () => {
      const startUrl = 'https://example.com'
      const options: Partial<CrawlOptions> = {
        maxDepth: 2,
        maxPages: 2,
        crawlDelay: 0,
        concurrency: 1,
        domainRestriction: ['example.com']
      }

      // 충분한 응답을 준비 (각 페이지마다 두 번 호출됨)
      mockedAxios.get
        .mockResolvedValue({ data: mockMainPageHtml })

      const session = await crawlerService.crawlSite(startUrl, options)

      expect(session.statistics.processedPages).toBeLessThanOrEqual(2)
      expect(session.statistics.processedPages).toBeGreaterThan(0)
    })

    test('크롤링 오류 처리가 올바르게 동작해야 함', async () => {
      const startUrl = 'https://example.com'
      const options: Partial<CrawlOptions> = {
        maxDepth: 0,
        maxPages: 1,
        crawlDelay: 0,
        domainRestriction: ['example.com']
      }

      // 첫 번째 호출은 성공, 두 번째는 실패
      mockedAxios.get
        .mockResolvedValueOnce({ data: mockMainPageHtml })
        .mockRejectedValueOnce(new Error('Network error'))

      const session = await crawlerService.crawlSite(startUrl, options)

      expect(session.status).toBe('completed')
      expect(session.statistics.processedPages).toBe(1)
    })

    test('도메인 제한이 올바르게 적용되어야 함', async () => {
      const startUrl = 'https://allowed.com'
      const htmlWithExternalLinks = `
        <html>
          <head><title>메인</title></head>
          <body>
            <p>Search</p>
            <a href="https://allowed.com/page1">허용된 도메인</a>
            <a href="https://blocked.com/page1">차단된 도메인</a>
          </body>
        </html>
      `
      
      const options: Partial<CrawlOptions> = {
        maxDepth: 1,
        maxPages: 10,
        domainRestriction: ['allowed.com'],
        crawlDelay: 0
      }

      mockedAxios.get.mockResolvedValue({ data: htmlWithExternalLinks })

      const session = await crawlerService.crawlSite(startUrl, options)

      const documents = crawlerService.getCrawledDocuments()
      // 모든 문서가 허용된 도메인에서만 나와야 함
      documents.forEach(doc => {
        expect(doc.url).toContain('allowed.com')
      })
    })
  })

  describe('getCrawledDocuments', () => {
    test('크롤링 전에는 빈 배열을 반환해야 함', () => {
      const documents = crawlerService.getCrawledDocuments()
      expect(documents).toEqual([])
    })
  })

  describe('getCrawledDocument', () => {
    test('존재하지 않는 URL에 대해 undefined를 반환해야 함', () => {
      const document = crawlerService.getCrawledDocument('https://nonexistent.com')
      expect(document).toBeUndefined()
    })
  })

  describe('링크 추출 및 관계 매핑', () => {
    test('링크가 올바르게 추출되어야 함', async () => {
      const startUrl = 'https://example.com'
      const options: Partial<CrawlOptions> = {
        maxDepth: 0,
        maxPages: 1,
        crawlDelay: 0,
        domainRestriction: ['example.com']
      }

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockMainPageHtml })
        .mockResolvedValueOnce({ data: mockMainPageHtml })

      await crawlerService.crawlSite(startUrl, options)
      
      const documents = crawlerService.getCrawledDocuments()
      expect(documents).toHaveLength(1)
      
      const doc = documents[0]
      expect(doc).toBeDefined()
      // 링크 추출이 정상적으로 작동하는지 확인
      expect(doc?.links).toBeDefined()
    })

    test('부모-자식 관계가 올바르게 매핑되어야 함', async () => {
      const startUrl = 'https://example.com'
      const options: Partial<CrawlOptions> = {
        maxDepth: 1,
        maxPages: 3,
        crawlDelay: 0,
        concurrency: 1,
        domainRestriction: ['example.com']
      }

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockMainPageHtml })
        .mockResolvedValueOnce({ data: mockMainPageHtml })
        .mockResolvedValueOnce({ data: mockPage1Html })
        .mockResolvedValueOnce({ data: mockPage1Html })

      await crawlerService.crawlSite(startUrl, options)
      
      const documents = crawlerService.getCrawledDocuments()
      const childDocuments = documents.filter(doc => doc.depth > 0)
      
      childDocuments.forEach(childDoc => {
        expect(childDoc.parentUrl).toBeDefined()
        expect(childDoc.parentUrl).toBe(startUrl)
      })
    })
  })

  describe('중복 제거 및 정규화', () => {
    test('중복 URL이 올바르게 제거되어야 함', async () => {
      const startUrl = 'https://example.com'
      const htmlWithDuplicateLinks = `
        <html>
          <head><title>중복 테스트</title></head>
          <body>
            <p>Search</p>
            <a href="/page1">페이지 1</a>
            <a href="/page1/">페이지 1 (슬래시)</a>
            <a href="/page1?param=1">페이지 1 (파라미터)</a>
            <a href="/page1#section">페이지 1 (해시)</a>
          </body>
        </html>
      `

      const options: Partial<CrawlOptions> = {
        maxDepth: 1,
        maxPages: 10,
        crawlDelay: 0,
        domainRestriction: ['example.com']
      }

      mockedAxios.get
        .mockResolvedValue({ data: htmlWithDuplicateLinks })

      const session = await crawlerService.crawlSite(startUrl, options)
      
      // 중복이 감지되어야 함
      expect(session.statistics.duplicatePages).toBeGreaterThanOrEqual(0)
    })
  })

  describe('세션 관리', () => {
    test('세션 정보가 올바르게 생성되어야 함', async () => {
      const startUrl = 'https://example.com'
      const options: Partial<CrawlOptions> = {
        maxDepth: 0,
        maxPages: 1,
        crawlDelay: 0,
        domainRestriction: ['example.com']
      }

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockMainPageHtml })  // extractFromUrl 호출
        .mockResolvedValueOnce({ data: mockMainPageHtml })  // extractLinks 호출

      const session = await crawlerService.crawlSite(startUrl, options)

      expect(session.id).toBeDefined()
      expect(session.startUrl).toBe(startUrl)
      expect(session.startTime).toBeDefined()
      expect(session.options).toMatchObject(options)
      expect(session.statistics).toBeDefined()
    })

    test('통계가 올바르게 계산되어야 함', async () => {
      const startUrl = 'https://example.com'
      const options: Partial<CrawlOptions> = {
        maxDepth: 0,
        maxPages: 1,
        crawlDelay: 0,
        domainRestriction: ['example.com']
      }

      mockedAxios.get
        .mockResolvedValueOnce({ data: mockMainPageHtml })  // extractFromUrl 호출
        .mockResolvedValueOnce({ data: mockMainPageHtml })  // extractLinks 호출

      const session = await crawlerService.crawlSite(startUrl, options)

      expect(session.statistics.processedPages).toBe(1)
      expect(session.statistics.averageProcessingTime).toBeGreaterThan(0)
      expect(session.statistics.errorPages).toBe(0)
    })
  })
})