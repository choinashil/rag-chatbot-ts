import { GenericParser } from '../../../../../src/services/html/parsers/generic-parser'

describe('GenericParser', () => {
  let parser: GenericParser

  beforeEach(() => {
    parser = new GenericParser()
  })

  describe('isApplicable', () => {
    test('항상 true 반환 (fallback 파서)', () => {
      expect(parser.isApplicable()).toBe(true)
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
})