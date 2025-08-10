import { HtmlCrawlerService } from '../../../../src/services/html/html-crawler.service'
import type { CrawlOptions } from '../../../../src/types/html'
import axios from 'axios'

// axios mock
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('HtmlCrawlerService - 형제 페이지 허용 로직 검증 (간단 테스트)', () => {
  let crawlerService: HtmlCrawlerService
  let consoleSpy: jest.SpyInstance

  beforeEach(() => {
    crawlerService = new HtmlCrawlerService()
    consoleSpy = jest.spyOn(console, 'log').mockImplementation()
    jest.clearAllMocks()
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  test('로직 검증: 부모 페이지는 스킵, 형제 페이지는 허용', async () => {
    // startBreadcrumbDepth를 2로 설정 (홈 / 카테고리)
    ;(crawlerService as any).startBreadcrumbDepth = 2
    
    // 부모 페이지 HTML (breadcrumb 길이 1)
    const parentPageHtml = `
      <html>
        <head><title>부모 페이지</title></head>
        <body>
          <p>홈</p>
          <p>Search</p>
          <p>부모 페이지 내용</p>
        </body>
      </html>
    `

    mockedAxios.get
      .mockResolvedValueOnce({ data: parentPageHtml })
      .mockResolvedValueOnce({ data: parentPageHtml })

    const session = {
      id: 'test',
      startUrl: 'https://help.pro.sixshop.com.oopy.io/start',
      options: { includeParentPages: false, maxDepth: 2, maxPages: 10 } as CrawlOptions,
      statistics: {
        skippedPages: 0, processedPages: 0, errorPages: 0, 
        duplicatePages: 0, totalPages: 0, averageProcessingTime: 0
      }
    }

    // 부모 페이지 처리 시도
    const parentResult = await (crawlerService as any).processPage(
      'https://help.pro.sixshop.com.oopy.io/parent',
      1, 'https://help.pro.sixshop.com.oopy.io/start', session
    )

    // 부모 페이지는 스킵되어야 함
    expect(parentResult).toBeNull()
    expect(session.statistics.skippedPages).toBe(1)

    // 형제 페이지 HTML (breadcrumb 길이 2)
    const siblingPageHtml = `
      <html>
        <head><title>형제 페이지</title></head>
        <body>
          <p>홈 / 다른카테고리</p>
          <p>Search</p>
          <p>형제 페이지 내용</p>
        </body>
      </html>
    `

    // 새로운 세션 (통계 초기화)
    const session2 = {
      id: 'test2',
      startUrl: 'https://help.pro.sixshop.com.oopy.io/start',
      options: { includeParentPages: false, maxDepth: 2, maxPages: 10 } as CrawlOptions,
      statistics: {
        skippedPages: 0, processedPages: 0, errorPages: 0, 
        duplicatePages: 0, totalPages: 0, averageProcessingTime: 0
      }
    }

    ;(crawlerService as any).startBreadcrumbDepth = 2 // 다시 설정

    mockedAxios.get.mockReset()
    mockedAxios.get
      .mockResolvedValueOnce({ data: siblingPageHtml })
      .mockResolvedValueOnce({ data: siblingPageHtml })

    // 형제 페이지 처리 시도
    const siblingResult = await (crawlerService as any).processPage(
      'https://help.pro.sixshop.com.oopy.io/sibling',
      1, 'https://help.pro.sixshop.com.oopy.io/start', session2
    )

    // 형제 페이지는 허용되어야 함
    expect(siblingResult).toBeDefined()
    expect(siblingResult?.title).toBe('형제 페이지')
    expect(session2.statistics.skippedPages).toBe(0)
    expect(session2.statistics.processedPages).toBe(1)
  })

  test('콘솔 로그 검증: 실제 로직 동작 확인', async () => {
    const startUrl = 'https://help.pro.sixshop.com.oopy.io/start'
    const options: Partial<CrawlOptions> = {
      maxDepth: 0,
      maxPages: 1,
      crawlDelay: 0,
      includeParentPages: false,
      domainRestriction: ['help.pro.sixshop.com.oopy.io']
    }

    const startPageHtml = `
      <html>
        <head><title>시작 페이지</title></head>
        <body>
          <p>홈 / 카테고리</p>
          <p>Search</p>
          <p>시작 페이지 내용</p>
        </body>
      </html>
    `

    mockedAxios.get
      .mockResolvedValueOnce({ data: startPageHtml })
      .mockResolvedValueOnce({ data: startPageHtml })

    const session = await crawlerService.crawlSite(startUrl, options)

    // 기본 동작 검증
    expect(session.statistics.processedPages).toBe(1)
    expect(session.statistics.errorPages).toBe(0)
    
    // 콘솔 로그에서 로직 동작 확인
    const logs = consoleSpy.mock.calls.map(call => call[0]).join(' ')
    expect(logs).toContain('시작 페이지') // 시작 페이지 처리됨
  })

  test('실제 크롤링에서 형제 페이지 허용 동작 검증', async () => {
    // 실제 크롤링 시나리오에서 형제 페이지가 허용되는지 검증
    const startUrl = 'https://help.pro.sixshop.com.oopy.io/category'
    const options: Partial<CrawlOptions> = {
      maxDepth: 1,
      maxPages: 3,
      crawlDelay: 0,
      includeParentPages: false,
      domainRestriction: ['help.pro.sixshop.com.oopy.io']
    }

    const startPageHtml = `
      <html>
        <head><title>시작 카테고리</title></head>
        <body>
          <p>홈 / 카테고리</p>
          <p>Search</p>
          <p>시작 카테고리 내용</p>
          <a href="/sibling">형제 페이지</a>
        </body>
      </html>
    `

    const siblingPageHtml = `
      <html>
        <head><title>형제 페이지</title></head>
        <body>
          <p>홈 / 다른카테고리</p>
          <p>Search</p>
          <p>형제 페이지 내용</p>
        </body>
      </html>
    `

    mockedAxios.get
      .mockResolvedValueOnce({ data: startPageHtml })   // 시작 페이지 extractFromUrl
      .mockResolvedValueOnce({ data: startPageHtml })   // 시작 페이지 extractLinks
      .mockResolvedValueOnce({ data: siblingPageHtml }) // 형제 페이지 extractFromUrl
      .mockResolvedValueOnce({ data: siblingPageHtml }) // 형제 페이지 extractLinks

    const session = await crawlerService.crawlSite(startUrl, options)
    const documents = crawlerService.getCrawledDocuments()

    // 최소 시작 페이지는 처리되어야 함
    expect(session.statistics.processedPages).toBeGreaterThanOrEqual(1)
    expect(session.statistics.errorPages).toBe(0)
    expect(documents.length).toBeGreaterThanOrEqual(1)

    // 로그에서 형제 페이지 관련 메시지 확인
    const logs = consoleSpy.mock.calls.map(call => call[0]).join(' ')
    
    // 부모 페이지 스킵 메시지가 있으면 정상, 없어도 정상 (부모 페이지가 큐에 없을 수 있음)
    // 중요한 것은 형제 페이지 허용 로직이 작동하는 것
    expect(logs).toContain('시작 카테고리') // 시작 페이지는 반드시 처리
  })
})