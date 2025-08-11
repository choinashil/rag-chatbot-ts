import * as cheerio from 'cheerio'
import type { HtmlParserStrategy, CrawlingStrategy } from '../../../types/html-parser'

/**
 * Oopy 사이트에서 사용되는 상수
 */
const OOPY_CONSTANTS = {
  /** breadcrumb과 content를 구분하는 키워드 */
  CONTENT_SEPARATOR: 'Search'
} as const

/**
 * Oopy 사이트 전용 HTML 파서
 * 
 * 'Search' 키워드 기준으로 breadcrumb와 content를 분리하는 oopy 전용 로직
 */
export class OopyParser implements HtmlParserStrategy {
  name = 'oopy' as const

  /**
   * Oopy 사이트 여부 판단
   * URL 패턴과 HTML 내 oopy 고유 요소를 검사
   */
  isApplicable(html: string, url: string): boolean {
    // URL 기반 검사 (oopy.io 도메인)
    if (url.includes('oopy.io')) {
      return true
    }

    // HTML 내용 기반 검사 (oopy 고유 요소들)
    return html.includes('window.__OOPY__') ||
           html.includes('oopy.lazyrockets.com') ||
           html.includes('oopy-footer') ||
           html.includes('OopyFooter_container')
  }

  /**
   * 동적 크롤링 필요 여부 결정 (토글 감지 기반)
   */
  shouldUseDynamicCrawling(html: string): CrawlingStrategy {
    const toggleInfo = this.analyzeAllToggles(html)
    
    if (toggleInfo.totalCount > 0) {
      return {
        useDynamic: true,
        reason: `Notion 토글 ${toggleInfo.totalCount}개 감지됨 (기본형: ${toggleInfo.basicToggles}, 헤더형: ${toggleInfo.headerToggles})`,
        metadata: { 
          togglesExpanded: toggleInfo.totalCount,
          crawlingMethod: 'browser',
          toggleTypes: toggleInfo
        }
      }
    }
    
    return { useDynamic: false }
  }

  /**
   * 동적 크롤링을 위한 페이지 설정 함수 반환
   */
  getDynamicCrawlingSetup(): (page: any) => Promise<void> {
    return this.expandOopyToggles.bind(this)
  }

  /**
   * 정적 HTML에서 콘텐츠 추출
   */
  parseStaticContent(html: string, url: string): {
    title: string
    content: string
    breadcrumb: string[]
  } {
    return this.extractContent(html)
  }

  /**
   * 동적 크롤링으로 얻은 콘텐츠 파싱
   */
  parseDynamicContent(content: string, url: string, metadata?: any): {
    title: string
    content: string
    breadcrumb: string[]
  } {
    // 동적 콘텐츠는 이미 전체 텍스트이므로 간단히 처리
    const lines = content.trim().split('\n')
    const title = lines[0]?.trim() || '제목 없음'
    
    // 전체 텍스트에서 'Search' 키워드 기준으로 분할
    const parts = content.split(OOPY_CONSTANTS.CONTENT_SEPARATOR)
    
    if (parts.length === 1) {
      return {
        title,
        content: content.replace(/\s+/g, ' ').trim(),
        breadcrumb: []
      }
    }
    
    const breadcrumbText = parts[0]?.trim() || ''
    const mainContent = parts.slice(1).join(OOPY_CONSTANTS.CONTENT_SEPARATOR).trim()
    
    // breadcrumb 파싱 ('/' 구분자 기준)
    const breadcrumb = breadcrumbText
      ? breadcrumbText.split('/')
          .map(item => item.trim())
          .filter(item => item.length > 0)
      : []
    
    return {
      title,
      content: mainContent.replace(/\s+/g, ' ').trim(),
      breadcrumb
    }
  }

  /**
   * Oopy 사이트의 콘텐츠 추출
   * 'Search' 키워드를 기준으로 breadcrumb와 content 분리
   */
  extractContent(html: string): {
    title: string
    content: string  
    breadcrumb: string[]
  } {
    const $ = cheerio.load(html)
    
    // 불필요한 요소 제거
    $('script, style, nav, footer, aside').remove()
    
    // 제목 추출
    const title = $('title').text().trim() || $('h1').first().text().trim() || '제목 없음'
    
    // 제목 요소를 제거한 후 전체 텍스트 추출
    $('title, h1').remove()
    const fullText = $('body').text().trim()
    
    // 'Search' 키워드 기준으로 분할 (oopy 특화)
    const parts = fullText.split(OOPY_CONSTANTS.CONTENT_SEPARATOR)
    
    if (parts.length === 1) {
      // Search 키워드가 없는 경우: breadcrumb는 비움, content도 비움
      return {
        title,
        content: '',
        breadcrumb: []
      }
    }
    
    // Search 키워드가 있는 경우: 정상 처리
    const breadcrumbText = parts[0]?.trim() || ''
    const mainContent = parts.slice(1).join(OOPY_CONSTANTS.CONTENT_SEPARATOR).trim()
    
    // breadcrumb 파싱 ('/' 구분자 기준)
    const breadcrumb = breadcrumbText
      ? breadcrumbText.split('/')
          .map(item => item.trim())
          .filter(item => item.length > 0)
      : []
    
    // 텍스트 정리 (연속된 공백을 하나로)
    const processedContent = mainContent
      .replace(/\s+/g, ' ')
      .trim()
    
    return {
      title,
      content: processedContent,
      breadcrumb
    }
  }

  /**
   * HTML에서 모든 토글 패턴 분석
   */
  private analyzeAllToggles(html: string): {
    basicToggles: number
    headerToggles: number 
    totalCount: number
  } {
    // notion-toggle-block 개수 (가장 정확)
    const notionToggleBlocks = (html.match(/notion-toggle-block/g) || []).length
    
    // 헤더 토글 패턴 - 더 정확한 검사
    // notion-sub_sub_header-block 내에서 직접적으로 rotateZ(90deg)를 포함하는 경우만
    let headerToggles = 0
    
    // notion-sub_sub_header-block 블록들을 찾아서 각각 검사
    const subHeaderBlocks = html.match(/<[^>]*notion-sub_sub_header-block[^>]*>[\s\S]*?(?=<[^>]*notion-(?:toggle-block|sub_sub_header-block|page-block|)|$)/g) || []
    
    subHeaderBlocks.forEach(block => {
      // 이 블록 내에서 rotateZ(90deg) 패턴이 있는지 확인 (거리 제한: 2000자 이내)
      if (block.length < 2000 && block.includes('rotateZ(90deg)')) {
        headerToggles++
      }
    })
    
    return {
      basicToggles: notionToggleBlocks,  // notion-toggle-block 개수
      headerToggles,                     // 실제 헤더 토글 개수 
      totalCount: notionToggleBlocks + headerToggles
    }
  }

  /**
   * Puppeteer 페이지에서 모든 oopy 토글을 확장
   */
  private async expandOopyToggles(page: any): Promise<void> {
    console.log('    🔄 oopy 토글 확장 시작')
    
    try {
      let totalExpanded = 0
      
      // 1. page.click() 방식으로 notion-toggle-block 토글 클릭 (가장 확실한 방법)
      try {
        console.log('    🖱️ notion-toggle-block 토글 클릭 중...')
        
        // 모든 notion-toggle-block 내의 버튼 찾기
        const toggleButtons = await page.$$('.notion-toggle-block [role="button"]')
        console.log(`    📊 발견된 토글 버튼: ${toggleButtons.length}개`)
        
        for (let i = 0; i < toggleButtons.length; i++) {
          try {
            // 버튼의 aria-label 확인
            const ariaLabel = await toggleButtons[i].evaluate((el: any) => el.getAttribute('aria-label'))
            console.log(`    🔍 토글 #${i + 1}: aria-label="${ariaLabel}"`)
            
            // unfold 또는 펼치기 등의 토글만 클릭
            if (ariaLabel && (
              ariaLabel.includes('unfold') || 
              ariaLabel.includes('expand') ||
              ariaLabel.includes('toggle') ||
              ariaLabel.includes('펼치기')
            )) {
              await toggleButtons[i].click()
              console.log(`    ✅ 토글 #${i + 1} 클릭 완료`)
              totalExpanded++
              
              // 각 토글 클릭 후 약간 대기 (애니메이션 완료)
              await new Promise(resolve => setTimeout(resolve, 800))
            } else {
              console.log(`    ⏭️ 토글 #${i + 1} 스킵 (이미 확장되었거나 다른 상태)`)
            }
          } catch (error) {
            console.warn(`    ⚠️ 토글 #${i + 1} 클릭 실패:`, error)
          }
        }
        
        console.log(`    ✅ notion-toggle-block 토글 ${totalExpanded}개 확장`)
        
      } catch (error) {
        console.warn('    ⚠️ notion-toggle-block 토글 클릭 실패:', error)
      }
      
      // 2. 헤더 토글 패턴 클릭 (SVG transform 기반)
      try {
        console.log('    🖱️ 헤더 토글 클릭 중...')
        
        const headerButtons = await page.$$('.notion-sub_sub_header-block [role="button"]')
        let headerExpanded = 0
        
        for (let i = 0; i < headerButtons.length; i++) {
          try {
            // SVG의 transform 상태 확인
            const hasClosedSvg = await headerButtons[i].evaluate((button: any) => {
              const svg = button.querySelector('svg[style*="rotateZ(90deg)"]')
              return !!svg
            })
            
            if (hasClosedSvg) {
              await headerButtons[i].click()
              console.log(`    ✅ 헤더 토글 #${i + 1} 클릭 완료`)
              headerExpanded++
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          } catch (error) {
            console.warn(`    ⚠️ 헤더 토글 #${i + 1} 클릭 실패:`, error)
          }
        }
        
        console.log(`    ✅ 헤더 토글 ${headerExpanded}개 확장`)
        totalExpanded += headerExpanded
        
      } catch (error) {
        console.warn('    ⚠️ 헤더 토글 클릭 실패:', error)
      }
      
      // 3. 최종 대기 (모든 애니메이션 완료)
      console.log('    ⏳ 토글 확장 완료 대기 중...')
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      console.log(`    🎉 총 ${totalExpanded}개 토글 확장 완료`)
      
    } catch (error) {
      console.warn('    ⚠️ 토글 확장 중 오류 발생:', error)
      // 오류가 있어도 계속 진행
    }
  }
}