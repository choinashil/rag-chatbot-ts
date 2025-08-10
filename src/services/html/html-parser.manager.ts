import type { HtmlParserStrategy } from '../../types/html-parser'
import { OopyParser, GenericParser } from './parsers'

/**
 * HTML 파서 전략 매니저
 * 
 * HTML 내용과 URL을 분석하여 적절한 파서 전략을 선택
 */
export class HtmlParserManager {
  private strategies: HtmlParserStrategy[]

  constructor() {
    this.strategies = [
      new OopyParser(),    // oopy 사이트 우선
      new GenericParser()  // 일반 HTML (fallback)
    ]
  }

  /**
   * 주어진 HTML과 URL에 적합한 파서 전략 선택
   * 
   * @param html HTML 문서 내용
   * @param url 대상 URL
   * @returns 선택된 파서 전략
   */
  selectStrategy(html: string, url: string): HtmlParserStrategy {
    // 적용 가능한 첫 번째 전략 반환
    const selectedStrategy = this.strategies.find(strategy => 
      strategy.isApplicable(html, url)
    )

    // fallback으로 GenericParser 반환 (GenericParser.isApplicable은 항상 true)
    return selectedStrategy || new GenericParser()
  }

  /**
   * 등록된 모든 파서 전략 목록 반환
   */
  getAvailableStrategies(): string[] {
    return this.strategies.map(strategy => strategy.name)
  }

  /**
   * 특정 이름의 파서 전략 반환 (테스트/디버깅용)
   */
  getStrategyByName(name: string): HtmlParserStrategy | undefined {
    return this.strategies.find(strategy => strategy.name === name)
  }
}