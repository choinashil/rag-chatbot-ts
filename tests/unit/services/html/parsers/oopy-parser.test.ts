import { OopyParser } from '../../../../../src/services/html/parsers/oopy-parser'

describe('OopyParser', () => {
  let parser: OopyParser

  beforeEach(() => {
    parser = new OopyParser()
  })

  describe('isApplicable', () => {
    test('oopy.io 도메인 URL에 대해 true 반환', () => {
      const url = 'https://help.pro.sixshop.com.oopy.io/design'
      const html = '<html><body>Some content</body></html>'

      expect(parser.isApplicable(html, url)).toBe(true)
    })

    test('window.__OOPY__ 스크립트가 있는 HTML에 대해 true 반환', () => {
      const url = 'https://custom-domain.com/page'
      const html = '<html><head><script>window.__OOPY__ = {};</script></head><body>Content</body></html>'

      expect(parser.isApplicable(html, url)).toBe(true)
    })

    test('oopy.lazyrockets.com이 포함된 HTML에 대해 true 반환', () => {
      const url = 'https://example.com/page'
      const html = '<html><body><img src="https://oopy.lazyrockets.com/image.jpg"></body></html>'

      expect(parser.isApplicable(html, url)).toBe(true)
    })

    test('oopy-footer 클래스가 있는 HTML에 대해 true 반환', () => {
      const url = 'https://example.com/page'
      const html = '<html><body><div class="oopy-footer">Footer</div></body></html>'

      expect(parser.isApplicable(html, url)).toBe(true)
    })

    test('OopyFooter_container 클래스가 있는 HTML에 대해 true 반환', () => {
      const url = 'https://example.com/page'
      const html = '<html><body><div class="OopyFooter_container__abc123">Footer</div></body></html>'

      expect(parser.isApplicable(html, url)).toBe(true)
    })

    test('oopy 요소가 없는 일반 HTML에 대해 false 반환', () => {
      const url = 'https://example.com/page'
      const html = '<html><body><h1>Regular HTML</h1><p>Content</p></body></html>'

      expect(parser.isApplicable(html, url)).toBe(false)
    })
  })

  describe('extractContent', () => {
    test('Search 키워드로 breadcrumb과 content를 올바르게 분리', () => {
      const html = `
        <html>
          <body>
            <title>Test Page</title>
            홈 / 가이드 / 웹사이트 디자인Search
            메인 콘텐츠입니다. 
            여러 줄의   텍스트가   있습니다.
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.title).toBe('Test Page')
      expect(result.breadcrumb).toEqual(['홈', '가이드', '웹사이트 디자인'])
      expect(result.content).toBe('메인 콘텐츠입니다. 여러 줄의 텍스트가 있습니다.')
    })

    test('Search 키워드가 없을 때 전체를 content로 처리', () => {
      const html = `
        <html>
          <body>
            <title>No Search Page</title>
            전체 콘텐츠입니다.
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.title).toBe('No Search Page')
      expect(result.breadcrumb).toEqual([])
      expect(result.content).toBe('')
    })

    test('제목이 없을 때 기본값 사용', () => {
      const html = `
        <html>
          <body>
            홈 / 가이드Search
            콘텐츠
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.title).toBe('제목 없음')
      expect(result.breadcrumb).toEqual(['홈', '가이드'])
      expect(result.content).toBe('콘텐츠')
    })

    test('불필요한 태그 제거', () => {
      const html = `
        <html>
          <body>
            <script>console.log('script')</script>
            <style>.test { color: red; }</style>
            <nav>Navigation</nav>
            <footer>Footer</footer>
            <aside>Sidebar</aside>
            홈Search
            실제 콘텐츠
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.content).toBe('실제 콘텐츠')
      expect(result.content).not.toContain('script')
      expect(result.content).not.toContain('Navigation')
      expect(result.content).not.toContain('Footer')
    })

    test('연속된 공백을 하나로 정리', () => {
      const html = `
        <html>
          <body>
            홈Search
            여러    공백이    있는     텍스트
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.content).toBe('여러 공백이 있는 텍스트')
    })

    test('여러 개의 Search 키워드 처리', () => {
      const html = `
        <html>
          <body>
            홈 / 가이드Search
            첫 번째 SearchSearch 두 번째 Search 세 번째
          </body>
        </html>
      `

      const result = parser.extractContent(html)

      expect(result.breadcrumb).toEqual(['홈', '가이드'])
      expect(result.content).toBe('첫 번째 SearchSearch 두 번째 Search 세 번째')
    })
  })
})