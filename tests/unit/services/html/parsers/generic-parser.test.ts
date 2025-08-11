import { GenericParser } from '../../../../../src/services/html/parsers/generic-parser'

describe('GenericParser', () => {
  let parser: GenericParser

  beforeEach(() => {
    parser = new GenericParser()
  })

  describe('isApplicable', () => {
    test('항상 true 반환 (fallback 파서)', () => {
      const html = '<html><body>Any content</body></html>'
      const url = 'https://example.com'
      
      expect(parser.isApplicable(html, url)).toBe(true)
    })

    test('빈 HTML에 대해서도 true 반환', () => {
      const html = ''
      const url = 'https://example.com'

      expect(parser.isApplicable(html, url)).toBe(true)
    })
  })

  describe('extractContent', () => {
    test('title 태그에서 제목 추출', () => {
      const html = `
        <html>
          <head><title>Page Title</title></head>
          <body>
            <main>Main content here</main>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.title).toBe('Page Title')
      expect(result.content).toBe('Main content here')
      expect(result.breadcrumb).toEqual([])
    })

    test('title이 없을 때 h1에서 제목 추출', () => {
      const html = `
        <html>
          <body>
            <h1>H1 Title</h1>
            <main>Main content</main>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.title).toBe('H1 Title')
      expect(result.content).toBe('Main content') // main 태그 내용만 추출
    })

    test('title과 h1이 없을 때 기본값 사용', () => {
      const html = `
        <html>
          <body>
            <main>Only main content</main>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.title).toBe('제목 없음')
      expect(result.content).toBe('Only main content')
    })

    test('main 태그에서 콘텐츠 우선 추출', () => {
      const html = `
        <html>
          <body>
            <header>Header content</header>
            <main>Main content</main>
            <footer>Footer content</footer>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.content).toBe('Main content')
    })

    test('main이 없을 때 article에서 콘텐츠 추출', () => {
      const html = `
        <html>
          <body>
            <header>Header</header>
            <article>Article content</article>
            <footer>Footer</footer>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.content).toBe('Article content')
    })

    test('.content 클래스에서 콘텐츠 추출', () => {
      const html = `
        <html>
          <body>
            <div class="sidebar">Sidebar</div>
            <div class="content">Content area</div>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.content).toBe('Content area')
    })

    test('우선순위에 따른 콘텐츠 선택 확인', () => {
      const html = `
        <html>
          <body>
            <main>Main content (should be selected)</main>
            <article>Article content</article>
            <div class="content">Content div</div>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.content).toBe('Main content (should be selected)')
    })

    test('최소 콘텐츠 길이 확인 (100자 미만은 다음 우선순위로)', () => {
      const html = `
        <html>
          <body>
            <main>Short</main>
            <article>This is a longer content that should be selected because it has more than 100 characters in it for testing purposes</article>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.content).toContain('This is a longer content')
    })

    test('불필요한 태그 제거 확인', () => {
      const html = `
        <html>
          <body>
            <script>console.log('remove me')</script>
            <style>.test { display: none; }</style>
            <nav>Navigation</nav>
            <header>Header</header>
            <footer>Footer</footer>
            <aside>Aside</aside>
            <main>Clean main content</main>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.content).toBe('Clean main content')
      expect(result.content).not.toContain('remove me')
      expect(result.content).not.toContain('Navigation')
      expect(result.content).not.toContain('Header')
    })

    test('연속된 공백 정리', () => {
      const html = `
        <html>
          <body>
            <main>
              Multiple    spaces    should    be
              normalized   to   single   spaces
            </main>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.content).toBe('Multiple spaces should be normalized to single spaces')
    })

    test('fallback으로 body 전체 사용', () => {
      const html = `
        <html>
          <body>
            <p>Only paragraph content</p>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.content).toBe('Only paragraph content')
    })

    test('breadcrumb은 항상 빈 배열', () => {
      const html = `
        <html>
          <body>
            <nav><a href="/">Home</a> > <a href="/docs">Docs</a></nav>
            <main>Content</main>
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.breadcrumb).toEqual([])
    })
  })

  describe('shouldUseDynamicCrawling (새로운 인터페이스)', () => {
    test('항상 정적 크롤링 반환', () => {
      const html = '<html><body><p>일반 콘텐츠</p></body></html>'
      
      const result = parser.shouldUseDynamicCrawling(html)
      
      expect(result.useDynamic).toBe(false)
    })

    test('토글이 있어 보이는 HTML에서도 정적 크롤링 반환', () => {
      const html = `
        <html><body>
          <div class="notion-toggle-block">
            <div role="button" aria-label="펼치기">토글 제목</div>
          </div>
        </body></html>
      `
      
      const result = parser.shouldUseDynamicCrawling(html)
      
      expect(result.useDynamic).toBe(false)
    })
  })

  describe('getDynamicCrawlingSetup (새로운 인터페이스)', () => {
    test('undefined 반환 (동적 크롤링 미지원)', () => {
      const result = parser.getDynamicCrawlingSetup()
      
      expect(result).toBeUndefined()
    })
  })

  describe('parseStaticContent (새로운 인터페이스)', () => {
    test('정적 HTML 파싱', () => {
      const html = `
        <html>
          <head><title>Generic Page</title></head>
          <body>
            <main>메인 콘텐츠입니다.</main>
          </body>
        </html>
      `
      const url = 'https://example.com'
      
      const result = parser.parseStaticContent(html, url)
      
      expect(result.title).toBe('Generic Page')
      expect(result.content).toBe('메인 콘텐츠입니다.')
      expect(result.breadcrumb).toEqual([]) // Generic parser는 breadcrumb 없음
    })

    test('불필요한 태그 제거', () => {
      const html = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <script>alert('remove')</script>
            <style>body { color: red; }</style>
            <nav>Navigation</nav>
            <footer>Footer</footer>
            <main>실제 콘텐츠</main>
          </body>
        </html>
      `
      const url = 'https://example.com'
      
      const result = parser.parseStaticContent(html, url)
      
      expect(result.content).toBe('실제 콘텐츠')
      expect(result.content).not.toContain('alert')
      expect(result.content).not.toContain('Navigation')
      expect(result.content).not.toContain('Footer')
    })
  })

  describe('parseDynamicContent (새로운 인터페이스)', () => {
    test('동적 크롤링 미지원 에러 발생', () => {
      const content = '동적 콘텐츠'
      const url = 'https://example.com'
      
      expect(() => {
        parser.parseDynamicContent(content, url)
      }).toThrow('GenericParser는 동적 크롤링을 지원하지 않습니다')
    })

    test('메타데이터가 있어도 에러 발생', () => {
      const content = '동적 콘텐츠'
      const url = 'https://example.com'
      const metadata = { togglesExpanded: 2 }
      
      expect(() => {
        parser.parseDynamicContent(content, url, metadata)
      }).toThrow('GenericParser는 동적 크롤링을 지원하지 않습니다')
    })
  })
})