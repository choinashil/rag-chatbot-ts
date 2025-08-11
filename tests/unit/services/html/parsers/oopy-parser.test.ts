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

  describe('shouldUseDynamicCrawling', () => {
    test('토글이 없는 HTML에 대해 정적 크롤링 반환', () => {
      const html = '<html><body><p>일반 콘텐츠</p></body></html>'
      
      const result = parser.shouldUseDynamicCrawling(html)
      
      expect(result.useDynamic).toBe(false)
    })

    test('notion-toggle-block이 있을 때 동적 크롤링 반환', () => {
      const html = `
        <html><body>
          <div class="notion-toggle-block">
            <div role="button" aria-label="펼치기">토글 제목</div>
          </div>
        </body></html>
      `
      
      const result = parser.shouldUseDynamicCrawling(html)
      
      expect(result.useDynamic).toBe(true)
      expect(result.reason).toContain('Notion 토글 1개 감지됨')
      expect(result.metadata?.toggleTypes.basicToggles).toBe(1)
      expect(result.metadata?.toggleTypes.totalCount).toBe(1)
    })

    test('헤더 토글 패턴이 있을 때 동적 크롤링 반환', () => {
      const html = `
        <html><body>
          <div class="notion-sub_sub_header-block">
            <div role="button">
              <svg style="transform: rotateZ(90deg);"></svg>
            </div>
            <h4>헤더 토글</h4>
          </div>
        </body></html>
      `
      
      const result = parser.shouldUseDynamicCrawling(html)
      
      expect(result.useDynamic).toBe(true)
      expect(result.reason).toContain('Notion 토글 1개 감지됨')
      expect(result.metadata?.toggleTypes.headerToggles).toBe(1)
      expect(result.metadata?.toggleTypes.totalCount).toBe(1)
    })

    test('여러 종류의 토글이 있을 때 모두 감지', () => {
      const html = `
        <html><body>
          <!-- 기본 토글 -->
          <div class="notion-toggle-block">
            <div role="button" aria-label="펼치기">기본 토글</div>
          </div>
          <div class="notion-toggle-block">
            <div role="button" aria-label="접기">이미 열린 토글</div>
          </div>
          
          <!-- 헤더 토글 -->
          <div class="notion-sub_sub_header-block">
            <div role="button">
              <svg style="transform: rotateZ(90deg);"></svg>
            </div>
            <h4>헤더 토글 1</h4>
          </div>
          <div class="notion-sub_sub_header-block">
            <div role="button">
              <svg style="transform: rotateZ(180deg);"></svg>
            </div>
            <h4>이미 열린 헤더 토글</h4>
          </div>
        </body></html>
      `
      
      const result = parser.shouldUseDynamicCrawling(html)
      
      expect(result.useDynamic).toBe(true)
      expect(result.metadata?.toggleTypes.basicToggles).toBe(2) // notion-toggle-block 2개
      expect(result.metadata?.toggleTypes.headerToggles).toBe(1) // rotateZ(90deg) 1개만
      expect(result.metadata?.toggleTypes.totalCount).toBe(3)
    })

    test('notion 관련 클래스가 없는 HTML에서는 토글을 감지하지 않음', () => {
      const html = `
        <html><body>
          <!-- notion 관련 클래스 없이 rotateZ만 있는 경우 -->
          <div class="regular-header">
            <div role="button">
              <svg style="transform: rotateZ(90deg);"></svg>
            </div>
            <h4>일반 헤더</h4>
          </div>
        </body></html>
      `
      
      const result = parser.shouldUseDynamicCrawling(html)
      
      expect(result.useDynamic).toBe(false)
      expect(result.metadata?.toggleTypes?.headerToggles).toBeUndefined()
    })
  })

  describe('getDynamicCrawlingSetup', () => {
    test('토글 확장 함수 반환', () => {
      const setupFunction = parser.getDynamicCrawlingSetup()
      
      expect(setupFunction).toBeInstanceOf(Function)
      expect(setupFunction.name).toBe('bound expandOopyToggles')
    })
  })

  describe('parseStaticContent', () => {
    test('정적 콘텐츠 파싱', () => {
      const html = `
        <html>
          <head><title>정적 페이지</title></head>
          <body>
            홈 / 가이드Search
            정적 콘텐츠입니다.
          </body>
        </html>
      `
      const url = 'https://example.com'
      
      const result = parser.parseStaticContent(html, url)
      
      expect(result.title).toBe('정적 페이지')
      expect(result.content).toBe('정적 콘텐츠입니다.')
      expect(result.breadcrumb).toEqual(['홈', '가이드'])
    })
  })

  describe('parseDynamicContent', () => {
    test('동적 콘텐츠 파싱', () => {
      const content = '홈 / 가이드 / 세부사항Search\n확장된 토글 콘텐츠가 포함된 전체 텍스트입니다.'
      const url = 'https://example.com'
      const metadata = { togglesExpanded: 2 }
      
      const result = parser.parseDynamicContent(content, url, metadata)
      
      // 첫 번째 줄이 title이 됨
      expect(result.title).toBe('홈 / 가이드 / 세부사항Search')
      expect(result.content).toBe('확장된 토글 콘텐츠가 포함된 전체 텍스트입니다.')
      expect(result.breadcrumb).toEqual(['홈', '가이드', '세부사항'])
    })

    test('Search 키워드가 없는 동적 콘텐츠 처리', () => {
      const content = '전체 동적 콘텐츠입니다. 토글이 확장되었습니다.'
      const url = 'https://example.com'
      
      const result = parser.parseDynamicContent(content, url)
      
      // 전체 텍스트가 title과 content 모두에 사용됨
      expect(result.title).toBe('전체 동적 콘텐츠입니다. 토글이 확장되었습니다.')
      expect(result.content).toBe('전체 동적 콘텐츠입니다. 토글이 확장되었습니다.')
      expect(result.breadcrumb).toEqual([])
    })

    test('여러 Search 키워드가 있는 동적 콘텐츠 처리', () => {
      const content = '홈 / 문서Search첫 번째 Search 내용Search두 번째 내용'
      const url = 'https://example.com'
      
      const result = parser.parseDynamicContent(content, url)
      
      expect(result.breadcrumb).toEqual(['홈', '문서'])
      expect(result.content).toBe('첫 번째 Search 내용Search두 번째 내용')
    })
  })
})