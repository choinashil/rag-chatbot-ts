import { HtmlCrawlerService } from '../../../../src/services/html/html-crawler.service'
import type { CrawlOptions } from '../../../../src/types/html'
import axios from 'axios'

// axios mock
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('HtmlCrawlerService - 부모/형제 페이지 처리 로직 검증', () => {
  let crawlerService: HtmlCrawlerService

  beforeEach(() => {
    crawlerService = new HtmlCrawlerService()
    jest.clearAllMocks()
    mockedAxios.get.mockReset() // mock 완전 초기화
  })

  test('부모 페이지는 스킵되어야 함 (relativeDepth < 0)', async () => {
    // startBreadcrumbDepth를 2로 설정 (홈 / 카테고리)
    ;(crawlerService as any).startBreadcrumbDepth = 2
    
    const parentPageHtml = `
      <html>
        <head><title>부모 페이지</title></head>
        <body>
          <p>홈</p>
          <p>Search</p>
          <p>부모 페이지 내용 (breadcrumb=1, startDepth=2, relative=-1)</p>
        </body>
      </html>
    `

    mockedAxios.get
      .mockResolvedValueOnce({ data: parentPageHtml })
      .mockResolvedValueOnce({ data: parentPageHtml })

    const session = {
      id: 'test-session',
      startUrl: 'https://help.pro.sixshop.com.oopy.io/start',
      options: {
        includeParentPages: false,
        maxDepth: 2,
        maxPages: 10
      } as CrawlOptions,
      statistics: {
        skippedPages: 0,
        processedPages: 0,
        errorPages: 0,
        duplicatePages: 0,
        totalPages: 0,
        averageProcessingTime: 0
      }
    }

    // 부모 페이지 처리 시도 (depth=1, parentUrl이 있으니 시작페이지가 아님)
    const result = await (crawlerService as any).processPage(
      'https://help.pro.sixshop.com.oopy.io/parent',
      1, // depth > 0
      'https://help.pro.sixshop.com.oopy.io/start', // parentUrl 존재
      session
    )

    // 부모 페이지는 스킵되어야 함 (relativeDepth < 0 조건에 의해)
    expect(result).toBeNull()
    expect(session.statistics.skippedPages).toBe(1)
  })

  test('형제 페이지는 허용되어야 함 (relativeDepth = 0)', async () => {
    // startBreadcrumbDepth를 2로 설정 (홈 / 카테고리)
    ;(crawlerService as any).startBreadcrumbDepth = 2
    
    const siblingPageHtml = `
      <html>
        <head><title>형제 페이지</title></head>
        <body>
          <p>홈 / 다른카테고리</p>
          <p>Search</p>
          <p>형제 페이지 내용 (breadcrumb=2, startDepth=2, relative=0)</p>
        </body>
      </html>
    `

    mockedAxios.get
      .mockResolvedValueOnce({ data: siblingPageHtml })
      .mockResolvedValueOnce({ data: siblingPageHtml })

    const session = {
      id: 'test-session',
      startUrl: 'https://help.pro.sixshop.com.oopy.io/start',
      options: {
        includeParentPages: false,
        maxDepth: 2,
        maxPages: 10
      } as CrawlOptions,
      statistics: {
        skippedPages: 0,
        processedPages: 0,
        errorPages: 0,
        duplicatePages: 0,
        totalPages: 0,
        averageProcessingTime: 0
      }
    }

    // 형제 페이지 처리 시도 (depth=1, parentUrl이 있으니 시작페이지가 아님)
    const result = await (crawlerService as any).processPage(
      'https://help.pro.sixshop.com.oopy.io/sibling',
      1, // depth > 0
      'https://help.pro.sixshop.com.oopy.io/start', // parentUrl 존재
      session
    )

    // 형제 페이지는 허용되어야 함 (이전에는 스킵된 relativeDepth <= 0 조건이 < 0으로 수정됨)
    expect(result).toBeDefined()
    expect(result?.title).toBe('형제 페이지')
    expect(session.statistics.skippedPages).toBe(0)
    expect(session.statistics.processedPages).toBe(1)
  })

  test('자식 페이지는 항상 허용되어야 함 (relativeDepth > 0)', async () => {
    // startBreadcrumbDepth를 2로 설정 (홈 / 카테고리)
    ;(crawlerService as any).startBreadcrumbDepth = 2
    
    const childPageHtml = `
      <html>
        <head><title>자식 페이지</title></head>
        <body>
          <p>홈 / 카테고리 / 자식</p>
          <p>Search</p>
          <p>자식 페이지 내용 (breadcrumb=3, startDepth=2, relative=1)</p>
        </body>
      </html>
    `

    mockedAxios.get
      .mockResolvedValueOnce({ data: childPageHtml })
      .mockResolvedValueOnce({ data: childPageHtml })

    const session = {
      id: 'test-session',
      startUrl: 'https://help.pro.sixshop.com.oopy.io/start',
      options: {
        includeParentPages: false,
        maxDepth: 2,
        maxPages: 10
      } as CrawlOptions,
      statistics: {
        skippedPages: 0,
        processedPages: 0,
        errorPages: 0,
        duplicatePages: 0,
        totalPages: 0,
        averageProcessingTime: 0
      }
    }

    // 자식 페이지 처리 시도
    const result = await (crawlerService as any).processPage(
      'https://help.pro.sixshop.com.oopy.io/child',
      1,
      'https://help.pro.sixshop.com.oopy.io/start',
      session
    )

    // 자식 페이지는 항상 허용되어야 함
    expect(result).toBeDefined()
    expect(result?.title).toBe('자식 페이지')
    expect(session.statistics.skippedPages).toBe(0)
    expect(session.statistics.processedPages).toBe(1)
  })

  test('시작 페이지는 예외 처리로 항상 허용되어야 함 (depth = 0)', async () => {
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

    const session = {
      id: 'test-session',
      startUrl: 'https://help.pro.sixshop.com.oopy.io/start',
      options: {
        includeParentPages: false,
        maxDepth: 2,
        maxPages: 10
      } as CrawlOptions,
      statistics: {
        skippedPages: 0,
        processedPages: 0,
        errorPages: 0,
        duplicatePages: 0,
        totalPages: 0,
        averageProcessingTime: 0
      }
    }

    // 시작 페이지 처리 (depth=0, parentUrl 없음)
    const result = await (crawlerService as any).processPage(
      'https://help.pro.sixshop.com.oopy.io/start',
      0, // depth = 0 (시작 페이지)
      undefined, // parentUrl 없음
      session
    )

    // 시작 페이지는 includeParentPages 옵션과 상관없이 성공적으로 처리되어야 함
    expect(result).toBeDefined()
    expect(result?.title).toBe('시작 페이지')
    expect(session.statistics.skippedPages).toBe(0)
    expect(session.statistics.processedPages).toBe(1)
  })

  test('includeParentPages: true일 때 부모 페이지도 허용되어야 함', async () => {
    // startBreadcrumbDepth를 2로 설정
    ;(crawlerService as any).startBreadcrumbDepth = 2
    
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
      id: 'test-session',
      startUrl: 'https://help.pro.sixshop.com.oopy.io/start',
      options: {
        includeParentPages: true, // 부모 페이지 허용
        maxDepth: 2,
        maxPages: 10
      } as CrawlOptions,
      statistics: {
        skippedPages: 0,
        processedPages: 0,
        errorPages: 0,
        duplicatePages: 0,
        totalPages: 0,
        averageProcessingTime: 0
      }
    }

    // 부모 페이지 처리 시도
    const result = await (crawlerService as any).processPage(
      'https://help.pro.sixshop.com.oopy.io/parent',
      1,
      'https://help.pro.sixshop.com.oopy.io/start',
      session
    )

    // includeParentPages: true일 때 부모 페이지도 허용되어야 함
    expect(result).toBeDefined()
    expect(result?.title).toBe('부모 페이지')
    expect(session.statistics.skippedPages).toBe(0)
    expect(session.statistics.processedPages).toBe(1)
  })
})