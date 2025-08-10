import { HtmlParserManager } from '../../../../src/services/html/html-parser.manager'
import { OopyParser } from '../../../../src/services/html/parsers/oopy-parser'
import { GenericParser } from '../../../../src/services/html/parsers/generic-parser'

describe('HtmlParserManager', () => {
  let manager: HtmlParserManager

  beforeEach(() => {
    manager = new HtmlParserManager()
  })

  describe('selectStrategy', () => {
    test('oopy.io URL에 대해 OopyParser 선택', () => {
      const url = 'https://help.pro.sixshop.com.oopy.io/design'
      const html = '<html><body>Content</body></html>'

      const strategy = manager.selectStrategy(html, url)

      expect(strategy.name).toBe('oopy')
      expect(strategy).toBeInstanceOf(OopyParser)
    })

    test('window.__OOPY__ 스크립트가 있는 HTML에 대해 OopyParser 선택', () => {
      const url = 'https://custom-domain.com/page'
      const html = '<html><head><script>window.__OOPY__ = {};</script></head><body>Content</body></html>'

      const strategy = manager.selectStrategy(html, url)

      expect(strategy.name).toBe('oopy')
      expect(strategy).toBeInstanceOf(OopyParser)
    })

    test('oopy 관련 클래스가 있는 HTML에 대해 OopyParser 선택', () => {
      const url = 'https://example.com/page'
      const html = '<html><body><div class="oopy-footer">Footer</div></body></html>'

      const strategy = manager.selectStrategy(html, url)

      expect(strategy.name).toBe('oopy')
      expect(strategy).toBeInstanceOf(OopyParser)
    })

    test('일반 HTML에 대해 GenericParser 선택', () => {
      const url = 'https://example.com/page'
      const html = '<html><body><h1>Regular HTML</h1><p>Content</p></body></html>'

      const strategy = manager.selectStrategy(html, url)

      expect(strategy.name).toBe('generic')
      expect(strategy).toBeInstanceOf(GenericParser)
    })

    test('빈 HTML에 대해서도 GenericParser 선택 (fallback)', () => {
      const url = 'https://example.com'
      const html = ''

      const strategy = manager.selectStrategy(html, url)

      expect(strategy.name).toBe('generic')
      expect(strategy).toBeInstanceOf(GenericParser)
    })

    test('파서 우선순위 확인 (oopy가 generic보다 우선)', () => {
      const url = 'https://example.com/page'
      const html = `
        <html>
          <body>
            <script>window.__OOPY__ = {};</script>
            <main>Regular main content</main>
          </body>
        </html>
      `

      const strategy = manager.selectStrategy(html, url)

      expect(strategy.name).toBe('oopy')
      expect(strategy).toBeInstanceOf(OopyParser)
    })
  })

  describe('getAvailableStrategies', () => {
    test('등록된 모든 파서 전략 이름 반환', () => {
      const strategies = manager.getAvailableStrategies()

      expect(strategies).toContain('oopy')
      expect(strategies).toContain('generic')
      expect(strategies).toHaveLength(2)
    })
  })

  describe('getStrategyByName', () => {
    test('존재하는 파서 이름으로 파서 반환', () => {
      const oopyStrategy = manager.getStrategyByName('oopy')
      const genericStrategy = manager.getStrategyByName('generic')

      expect(oopyStrategy).toBeInstanceOf(OopyParser)
      expect(oopyStrategy?.name).toBe('oopy')
      
      expect(genericStrategy).toBeInstanceOf(GenericParser)
      expect(genericStrategy?.name).toBe('generic')
    })

    test('존재하지 않는 파서 이름으로 undefined 반환', () => {
      const nonExistentStrategy = manager.getStrategyByName('wordpress')

      expect(nonExistentStrategy).toBeUndefined()
    })
  })
})