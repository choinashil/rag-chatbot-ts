import axios from 'axios'
import { HtmlService } from '../../../../src/services/html/html.service'
import { HTML_PARSING_CONSTANTS } from '../../../../src/services/html/html.constants'
import type { SimpleDocument, HtmlFetchOptions } from '../../../../src/types/html'

// axios mock
jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('HtmlService', () => {
  let htmlService: HtmlService
  let consoleSpy: {
    log: jest.SpyInstance
    warn: jest.SpyInstance
    error: jest.SpyInstance
  }

  beforeEach(() => {
    htmlService = new HtmlService()
    
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

  describe('fetchPage', () => {
    const testUrl = 'https://example.com'
    const mockHtml = '<html><body>Test Content</body></html>'

    test('성공적으로 페이지를 수집해야 함', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await htmlService.fetchPage(testUrl)

      expect(result).toBe(mockHtml)
      expect(mockedAxios.get).toHaveBeenCalledWith(testUrl, {
        timeout: HTML_PARSING_CONSTANTS.REQUEST_TIMEOUT,
        headers: {
          'User-Agent': HTML_PARSING_CONSTANTS.USER_AGENT
        }
      })
    })

    test('재시도 후 성공해야 함', async () => {
      // delay 메서드를 모킹
      jest.spyOn(htmlService as any, 'delay').mockResolvedValue(undefined)
      
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ data: mockHtml })

      const result = await htmlService.fetchPage(testUrl, { retryCount: 2 })

      expect(result).toBe(mockHtml)
      expect(mockedAxios.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('extractText - Generic Parser', () => {
    const testUrl = 'https://example.com'

    test('일반 HTML에서 generic parser 사용', () => {
      const html = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <main>Main content here</main>
          </body>
        </html>
      `

      const result = htmlService.extractText(html, testUrl)

      expect(result.url).toBe(testUrl)
      expect(result.title).toBe('Test Page')
      expect(result.content).toBe('Main content here')
      expect(result.breadcrumb).toEqual([]) // generic parser는 breadcrumb 없음
      expect(result.wordCount).toBeGreaterThan(0)
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    test('불필요한 태그 제거', () => {
      const html = `
        <html>
          <body>
            <script>alert('remove')</script>
            <style>body { color: red; }</style>
            <nav>Navigation</nav>
            <footer>Footer</footer>
            <main>Clean content</main>
          </body>
        </html>
      `

      const result = htmlService.extractText(html, testUrl)

      expect(result.content).toBe('Clean content')
      expect(result.content).not.toContain('alert')
      expect(result.content).not.toContain('Navigation')
      expect(result.content).not.toContain('Footer')
    })
  })

  describe('extractText - Oopy Parser', () => {
    const oopyUrl = 'https://help.pro.sixshop.com.oopy.io/design'

    test('Oopy 사이트에서 breadcrumb과 content 분리', () => {
      const html = `
        <html>
          <head><title>Oopy Page</title></head>
          <body>
            <p>Home / Category</p>
            <p>Search</p>
            <p>After search content</p>
          </body>
        </html>
      `

      const result = htmlService.extractText(html, oopyUrl)

      expect(result.url).toBe(oopyUrl)
      expect(result.title).toBe('Oopy Page')
      expect(result.content).toBe('After search content')
      expect(result.breadcrumb).toEqual(['Home', 'Category'])
    })

    test('Search 키워드가 없을 때', () => {
      const html = `
        <html>
          <body>
            <p>Content without search</p>
          </body>
        </html>
      `

      const result = htmlService.extractText(html, oopyUrl)

      expect(result.content).toBe('')
      expect(result.breadcrumb).toEqual([])
    })
  })

  describe('extractFromUrl', () => {
    test('Generic parser - URL에서 문서 추출', async () => {
      const testUrl = 'https://example.com'
      const mockHtml = `
        <html>
          <head><title>Test Page</title></head>
          <body><main>Main content</main></body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await htmlService.extractFromUrl(testUrl)

      expect(result).toMatchObject({
        url: testUrl,
        title: 'Test Page',
        content: 'Main content',
        breadcrumb: []
      })
    })

    test('Oopy parser - URL에서 문서 추출', async () => {
      const oopyUrl = 'https://help.pro.sixshop.com.oopy.io/design'
      const mockHtml = `
        <html>
          <head><title>Oopy Page</title></head>
          <body>
            <p>Home / Guide</p>
            <p>Search</p>
            <p>Oopy content</p>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await htmlService.extractFromUrl(oopyUrl)

      expect(result).toMatchObject({
        url: oopyUrl,
        title: 'Oopy Page',
        content: 'Oopy content',
        breadcrumb: ['Home', 'Guide']
      })
    })

    test('페이지 수집 실패 시 에러', async () => {
      const testUrl = 'https://example.com'
      jest.spyOn(htmlService as any, 'delay').mockResolvedValue(undefined)
      
      mockedAxios.get.mockRejectedValue(new Error('Network error'))

      await expect(htmlService.extractFromUrl(testUrl))
        .rejects.toThrow('URL 문서 추출에 실패했습니다')
    })
  })

  describe('displayResult', () => {
    test('결과를 올바른 형식으로 출력해야 함', () => {
      const document: SimpleDocument = {
        url: 'https://example.com',
        title: 'Test Document',
        content: 'Test content',
        wordCount: 12,
        breadcrumb: ['Home', 'Category'],
        timestamp: '2023-01-01T00:00:00.000Z'
      }

      htmlService.displayResult(document)

      expect(consoleSpy.log).toHaveBeenCalledWith('\n' + '='.repeat(80))
      expect(consoleSpy.log).toHaveBeenCalledWith('📄 HTML 텍스트 추출 결과')
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('제목: Test Document')
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('breadcrumb: ["Home", "Category"]')
      )
    })
  })

  describe('parseUrl (새로운 하이브리드 크롤링)', () => {
    test('정적 HTML - 토글이 없은 사이트', async () => {
      const testUrl = 'https://example.com'
      const html = '<html><body><p>일반 콘텐츠</p></body></html>'
      
      mockedAxios.get.mockResolvedValue({ data: html })
      
      const result = await htmlService.parseUrl(testUrl)
      
      expect(result.url).toBe(testUrl)
      expect(result.content).toBe('일반 콘텐츠')
    })

    test('동적 HTML - oopy 토글 사이트 (모킹)', async () => {
      const oopyUrl = 'https://help.pro.sixshop.com.oopy.io/design'
      const htmlWithToggles = `
        <html><body>
          <div class="notion-toggle-block">
            <div role="button" aria-label="펼치기">토글 제목</div>
          </div>
          홈Search정적 콘텐츠
        </body></html>
      `
      
      mockedAxios.get.mockResolvedValue({ data: htmlWithToggles })
      
      // 브라우저 기능 모킹
      const mockInitBrowser = jest.fn()
      const mockFetchDynamicContent = jest.fn().mockResolvedValue('홈Search토글 콘텐츠가 포함된 동적 콘텐츠')
      
      // HtmlService 내부 메서드 모킹
      jest.spyOn(htmlService as any, 'initBrowser').mockImplementation(mockInitBrowser)
      jest.spyOn(htmlService as any, 'fetchDynamicContent').mockImplementation(mockFetchDynamicContent)
      
      const result = await htmlService.parseUrl(oopyUrl)
      
      expect(result.url).toBe(oopyUrl)
      expect(result.content).toContain('동적 콘텐츠')
      expect(mockFetchDynamicContent).toHaveBeenCalledWith(
        oopyUrl,
        expect.any(Function) // 토글 확장 함수
      )
    })

    test('동적 크롤링 실패 시 fallback로 정적 파싱 사용', async () => {
      const oopyUrl = 'https://help.pro.sixshop.com.oopy.io/design'
      const htmlWithToggles = `
        <html><body>
          <div class="notion-toggle-block">
            <div role="button" aria-label="펼치기">토글 제목</div>
          </div>
          홈Search정적 콘텐츠
        </body></html>
      `
      
      mockedAxios.get.mockResolvedValue({ data: htmlWithToggles })
      
      // 브라우저 기능 실패 모킹
      const mockFetchDynamicContent = jest.fn().mockRejectedValue(new Error('브라우저 오류'))
      jest.spyOn(htmlService as any, 'fetchDynamicContent').mockImplementation(mockFetchDynamicContent)
      
      const result = await htmlService.parseUrl(oopyUrl)
      
      expect(result.url).toBe(oopyUrl)
      expect(result.content).toBe('정적 콘텐츠') // fallback로 정적 콘텐츠
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('브라우저 크롤링 실패'),
        expect.any(Error)
      )
    })
  })

  describe('통합 테스트', () => {
    test('복잡한 HTML 처리 - Generic Parser', async () => {
      const testUrl = 'https://example.com'
      const complexHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>복잡한 페이지</title>
            <style>body { margin: 0; }</style>
          </head>
          <body>
            <nav>네비게이션</nav>
            <main>
              <h1>메인 제목</h1>
              <p>메인 콘텐츠입니다.</p>
            </main>
            <footer>푸터</footer>
            <script>console.log('script');</script>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: complexHtml })

      const result = await htmlService.extractFromUrl(testUrl)

      expect(result.title).toBe('복잡한 페이지')
      expect(result.content).toContain('메인 콘텐츠')
      expect(result.content).not.toContain('네비게이션')
      expect(result.content).not.toContain('푸터')
      expect(result.content).not.toContain('script')
      expect(result.breadcrumb).toEqual([])
    })
  })

  describe('커스텀 URL 추출', () => {
    test('og:url이 있을 때 커스텀 URL 사용', async () => {
      const testUrl = 'https://internal-url.oopy.io/uuid-123'
      const htmlWithOgUrl = `
        <html>
          <head>
            <title>테스트 페이지</title>
            <meta property="og:url" content="https://help.pro.sixshop.com/design/products">
          </head>
          <body>
            홈 / 디자인Search
            커스텀 도메인 적용된 페이지입니다.
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: htmlWithOgUrl })

      const result = await htmlService.parseUrl(testUrl)

      expect(result.url).toBe('https://help.pro.sixshop.com/design/products')
      expect(result.title).toBe('테스트 페이지')
    })

    test('og:url이 없을 때 원본 URL 사용', async () => {
      const testUrl = 'https://help.pro.sixshop.com/normal-page'
      const normalHtml = `
        <html>
          <head><title>일반 페이지</title></head>
          <body>
            홈Search
            일반 페이지입니다.
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: normalHtml })

      const result = await htmlService.parseUrl(testUrl)

      expect(result.url).toBe(testUrl)
      expect(result.title).toBe('일반 페이지')
    })

    test('잘못된 형식의 og:url은 무시', async () => {
      const testUrl = 'https://example.com/test'
      const malformedHtml = `
        <html>
          <head>
            <title>테스트</title>
            <meta property="og:url" content="">
          </head>
          <body>홈Search테스트</body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: malformedHtml })

      const result = await htmlService.parseUrl(testUrl)

      expect(result.url).toBe(testUrl)
    })
  })
})