import axios from 'axios'
import { HtmlService } from '../../../../src/services/html/html.service'
import { HTML_PARSING_CONSTANTS } from '../../../../src/services/html/html.constants'
import type { SimpleDocument, HtmlFetchOptions, HtmlParsingOptions } from '../../../../src/types/html'

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

    test('커스텀 옵션으로 페이지를 수집해야 함', async () => {
      const options: HtmlFetchOptions = {
        timeout: 5000,
        userAgent: 'Custom Agent',
        retryCount: 2
      }
      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      await htmlService.fetchPage(testUrl, options)

      expect(mockedAxios.get).toHaveBeenCalledWith(testUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Custom Agent'
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
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('페이지 수집 실패 (시도 1/2)')
      )
    })

    test('최대 재시도 횟수 초과 시 에러를 던져야 함', async () => {
      const error = new Error('Network error')
      // delay 메서드를 모킹
      jest.spyOn(htmlService as any, 'delay').mockResolvedValue(undefined)
      
      mockedAxios.get.mockRejectedValue(error)

      await expect(htmlService.fetchPage(testUrl, { retryCount: 2 }))
        .rejects.toThrow('페이지 수집에 실패했습니다: Network error')

      expect(mockedAxios.get).toHaveBeenCalledTimes(2)
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('페이지 수집 최종 실패'),
        error
      )
    })

    test('비Error 객체 에러도 처리해야 함', async () => {
      // delay 메서드를 모킹
      jest.spyOn(htmlService as any, 'delay').mockResolvedValue(undefined)
      
      mockedAxios.get.mockRejectedValue('String error')

      await expect(htmlService.fetchPage(testUrl, { retryCount: 1 }))
        .rejects.toThrow('페이지 수집에 실패했습니다: 알 수 없는 오류')
    })
  })

  describe('extractText', () => {
    const testUrl = 'https://example.com'

    test('기본 HTML 텍스트 추출이 동작해야 함', () => {
      const html = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <script>console.log('remove me')</script>
            <p>Home / Category</p>
            <p>Search</p>
            <p>After search content with some text</p>
          </body>
        </html>
      `

      const result = htmlService.extractText(html, testUrl)

      expect(result.url).toBe(testUrl)
      expect(result.title).toBe('Test Page')
      expect(result.content).toContain('After search content with some text')
      expect(result.wordCount).toBeGreaterThan(0)
      expect(result.breadcrumb).toEqual(['Home', 'Category'])
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    test('breadcrumb이 올바르게 파싱되어야 함', () => {
      const html = `
        <html>
          <body>
            <p>Home / Category / Subcategory</p>
            <p>Search</p>
            <p>Main content here</p>
          </body>
        </html>
      `

      const result = htmlService.extractText(html, testUrl)

      expect(result.breadcrumb).toEqual(['Home', 'Category', 'Subcategory'])
    })

    test('Search가 없을 때 전체 텍스트가 breadcrumb이 되어야 함', () => {
      const html = `
        <html>
          <body>
            <p>All this content should be breadcrumb</p>
          </body>
        </html>
      `

      const result = htmlService.extractText(html, testUrl)

      expect(result.content).toBe('')
      expect(result.breadcrumb).toEqual(['All this content should be breadcrumb'])
    })

    test('불필요한 태그들이 제거되어야 함', () => {
      const html = `
        <html>
          <body>
            <script>alert('remove me')</script>
            <style>body { color: red; }</style>
            <nav>Navigation</nav>
            <footer>Footer</footer>
            <aside>Sidebar</aside>
            <p>Search</p>
            <p>Keep this content</p>
          </body>
        </html>
      `

      const result = htmlService.extractText(html, testUrl)

      expect(result.content).not.toContain('alert')
      expect(result.content).not.toContain('color: red')
      expect(result.content).not.toContain('Navigation')
      expect(result.content).not.toContain('Footer')
      expect(result.content).not.toContain('Sidebar')
      expect(result.content).toContain('Keep this content')
    })

    test('커스텀 옵션이 적용되어야 함', () => {
      const html = `
        <html>
          <head><title>Test Title</title></head>
          <body>
            <p>Before custom separator</p>
            <p>SPLIT</p>
            <p>After custom separator</p>
          </body>
        </html>
      `

      const options: HtmlParsingOptions = {
        contentSeparator: 'SPLIT',
        includeTitle: false
      }

      const result = htmlService.extractText(html, testUrl, options)

      expect(result.title).toBe('제목 없음')
      expect(result.breadcrumb).toEqual(['Before custom separator'])
      expect(result.content).toContain('After custom separator')
    })

    test('제목 추출 우선순위가 올바르게 동작해야 함', () => {
      // title 태그가 있는 경우
      let html = `
        <html>
          <head><title>Page Title</title></head>
          <body><h1>Header Title</h1><p>Search</p><p>Content</p></body>
        </html>
      `
      let result = htmlService.extractText(html, testUrl)
      expect(result.title).toBe('Page Title')

      // title 태그가 없고 h1이 있는 경우
      html = `
        <html>
          <body><h1>Header Title</h1><p>Search</p><p>Content</p></body>
        </html>
      `
      result = htmlService.extractText(html, testUrl)
      expect(result.title).toBe('Header Title')

      // 둘 다 없는 경우
      html = `
        <html>
          <body><p>Search</p><p>Content</p></body>
        </html>
      `
      result = htmlService.extractText(html, testUrl)
      expect(result.title).toBe('제목 없음')
    })

    test('텍스트 정규화가 올바르게 동작해야 함', () => {
      const html = `
        <html>
          <body>
            <p>Search</p>
            <p>Text   with    multiple     spaces
            
            and line breaks</p>
          </body>
        </html>
      `

      const result = htmlService.extractText(html, testUrl)

      expect(result.content).toBe('Text with multiple spaces and line breaks')
    })

    test('여러 개의 Search가 있을 때 올바르게 처리되어야 함', () => {
      const html = `
        <html>
          <body>
            <p>Breadcrumb content</p>
            <p>Search</p>
            <p>First part</p>
            <p>Search again</p>
            <p>Second part</p>
          </body>
        </html>
      `

      const result = htmlService.extractText(html, testUrl)

      expect(result.breadcrumb).toEqual(['Breadcrumb content'])
      expect(result.content).toContain('First part')
      expect(result.content).toContain('Search again')
      expect(result.content).toContain('Second part')
    })

    test('wordCount가 올바르게 계산되어야 함', () => {
      const html = `
        <html>
          <body>
            <p>Search</p>
            <p>Hello world test</p>
          </body>
        </html>
      `

      const result = htmlService.extractText(html, testUrl)
      
      expect(result.wordCount).toBe(result.content.length)
    })

    test('timestamp가 ISO 형식이어야 함', () => {
      const html = '<html><body>Search<p>Content</p></body></html>'
      
      const result = htmlService.extractText(html, testUrl)
      
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      expect(() => new Date(result.timestamp)).not.toThrow()
    })
  })

  describe('extractFromUrl', () => {
    const testUrl = 'https://example.com'
    const mockHtml = `
      <html>
        <head><title>Test Page</title></head>
        <body>
          <p>Breadcrumb</p>
          <p>Search</p>
          <p>Content</p>
        </body>
      </html>
    `

    test('URL에서 문서를 성공적으로 추출해야 함', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await htmlService.extractFromUrl(testUrl)

      expect(result).toMatchObject({
        url: testUrl,
        title: 'Test Page',
        content: 'Content',
        breadcrumb: ['Breadcrumb']
      })
      expect(result.timestamp).toBeDefined()
    })

    test('fetch와 parsing 옵션을 모두 전달해야 함', async () => {
      const fetchOptions: HtmlFetchOptions = { timeout: 5000 }
      const parsingOptions: HtmlParsingOptions = { includeTitle: false }
      
      mockedAxios.get.mockResolvedValue({ data: mockHtml })

      const result = await htmlService.extractFromUrl(testUrl, fetchOptions, parsingOptions)

      expect(result.title).toBe('제목 없음')
      expect(mockedAxios.get).toHaveBeenCalledWith(testUrl, {
        timeout: 5000,
        headers: {
          'User-Agent': HTML_PARSING_CONSTANTS.USER_AGENT
        }
      })
    })

    test('페이지 수집 실패 시 에러를 던져야 함', async () => {
      const fetchError = new Error('Network error')
      // delay 메서드를 모킹하여 실제 대기를 방지
      jest.spyOn(htmlService as any, 'delay').mockResolvedValue(undefined)
      
      mockedAxios.get.mockRejectedValue(fetchError)

      await expect(htmlService.extractFromUrl(testUrl))
        .rejects.toThrow('URL 문서 추출에 실패했습니다: 페이지 수집에 실패했습니다: Network error')

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('URL 문서 추출 실패'),
        expect.any(Error)
      )
    })

    test('비Error 객체 에러도 처리해야 함', async () => {
      // delay 메서드를 모킹하여 실제 대기를 방지
      jest.spyOn(htmlService as any, 'delay').mockResolvedValue(undefined)
      
      mockedAxios.get.mockRejectedValue('String error')

      await expect(htmlService.extractFromUrl(testUrl))
        .rejects.toThrow('URL 문서 추출에 실패했습니다: 페이지 수집에 실패했습니다: 알 수 없는 오류')
    })
  })

  describe('displayResult', () => {
    test('결과를 올바른 형식으로 출력해야 함', () => {
      const document: SimpleDocument = {
        url: 'https://example.com',
        title: 'Test Document',
        content: 'This is test content',
        wordCount: 20,
        breadcrumb: ['Home', 'Category'],
        timestamp: '2023-01-01T00:00:00.000Z'
      }

      htmlService.displayResult(document)

      // 출력 구조 검증
      expect(consoleSpy.log).toHaveBeenCalledWith('\n' + '='.repeat(80))
      expect(consoleSpy.log).toHaveBeenCalledWith('📄 HTML 텍스트 추출 결과')
      expect(consoleSpy.log).toHaveBeenCalledWith('='.repeat(80))
      
      // 문서 정보 출력 검증
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('제목: Test Document')
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('URL: https://example.com')
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('텍스트 길이: 20자')
      )
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('추출 시간: 2023-01-01T00:00:00.000Z')
      )
      
      // breadcrumb 출력 검증
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('breadcrumb: ["Home", "Category"]')
      )
      
      // 콘텐츠 출력 검증
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('"This is test content"')
      )
    })

    test('빈 breadcrumb도 올바르게 출력해야 함', () => {
      const document: SimpleDocument = {
        url: 'https://example.com',
        title: 'Test Document',
        content: 'Content',
        wordCount: 7,
        breadcrumb: [],
        timestamp: '2023-01-01T00:00:00.000Z'
      }

      htmlService.displayResult(document)

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('breadcrumb: []')
      )
    })

    test('큰 숫자가 올바르게 포맷되어야 함', () => {
      const document: SimpleDocument = {
        url: 'https://example.com',
        title: 'Test Document',
        content: 'Content',
        wordCount: 1234567,
        breadcrumb: [],
        timestamp: '2023-01-01T00:00:00.000Z'
      }

      htmlService.displayResult(document)

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('텍스트 길이: 1,234,567자')
      )
    })
  })

  describe('delay (private method)', () => {
    test('지정된 시간만큼 대기해야 함', async () => {
      // setTimeout을 모킹하여 실제 대기 없이 즉시 완료
      jest.useFakeTimers()
      const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
      
      const delayPromise = (htmlService as any).delay(100)
      
      // 타이머를 앞으로 진행시켜 setTimeout 완료
      jest.advanceTimersByTime(100)
      
      await delayPromise
      
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100)
      
      setTimeoutSpy.mockRestore()
      jest.useRealTimers()
    })
  })

  describe('통합 시나리오', () => {
    test('실제 시나리오와 유사한 HTML 처리', async () => {
      const complexHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>식스샵 프로 가이드</title>
            <style>body { margin: 0; }</style>
          </head>
          <body>
            <nav>네비게이션 메뉴</nav>
            <main>
              <div class="breadcrumb">홈 / 웹사이트 디자인 / 시작하기</div>
              <div>Search</div>
              <h1>웹사이트 디자인 입문</h1>
              <p>이 가이드에서는 기본적인 웹사이트 디자인 방법을 설명합니다.</p>
              <section>
                <h2>준비 사항</h2>
                <ul>
                  <li>디자인 도구</li>
                  <li>기본 지식</li>
                </ul>
              </section>
            </main>
            <footer>푸터 정보</footer>
            <script>
              console.log('analytics');
            </script>
          </body>
        </html>
      `

      mockedAxios.get.mockResolvedValue({ data: complexHtml })

      const result = await htmlService.extractFromUrl('https://help.pro.sixshop.com/design/start')

      expect(result.title).toBe('식스샵 프로 가이드')
      expect(result.breadcrumb).toEqual(['홈', '웹사이트 디자인', '시작하기'])
      expect(result.content).toContain('웹사이트 디자인 입문')
      expect(result.content).toContain('이 가이드에서는')
      expect(result.content).toContain('준비 사항')
      expect(result.content).toContain('디자인 도구')
      expect(result.content).not.toContain('네비게이션 메뉴')
      expect(result.content).not.toContain('푸터 정보')
      expect(result.content).not.toContain('console.log')
      expect(result.content).not.toContain('body { margin: 0; }')
      expect(result.wordCount).toBeGreaterThan(0)
    })
  })
})