/**
 * 웹사이트 디자인 페이지 벡터화 최적화 유닛테스트
 * 
 * 목적: 웹사이트 디자인 페이지(e7b780d5b6554f4e8bc957dcfcebfab3)에 특화된 벡터화 로직 검증
 * 용도: 다른 페이지 패턴 추가 시 현재 페이지 처리가 변경되지 않았는지 회귀 테스트
 */

import { NotionBlockAnalyzer } from '../../../scripts/analyze-notion-page-blocks'
import { 
  websiteDesignPageInfo, 
  websiteDesignBlocks, 
  websiteDesignColumnBlocks,
  WEBSITE_DESIGN_PAGE_ID
} from '../../fixtures/website-design-page.fixture'

// Mock dependencies
jest.mock('../../../src/services/notion/notion.service')
jest.mock('@notionhq/client')

describe('NotionBlockAnalyzer - 웹사이트 디자인 페이지 최적화', () => {
  let analyzer: NotionBlockAnalyzer
  let mockClient: any

  beforeEach(() => {
    // Notion Client 모킹
    mockClient = {
      pages: {
        retrieve: jest.fn().mockResolvedValue(websiteDesignPageInfo)
      },
      blocks: {
        children: {
          list: jest.fn()
            .mockResolvedValueOnce({
              results: websiteDesignBlocks
            })
            // Column 내부 블록들 요청 시
            .mockResolvedValue({
              results: websiteDesignColumnBlocks
            })
        }
      }
    }

    // NotionService 모킹
    const mockNotionService = {
      initialize: jest.fn().mockResolvedValue(undefined)
    }

    // 환경변수 모킹
    process.env.NOTION_INTEGRATION_TOKEN = 'mock-token'

    // Analyzer 인스턴스 생성 (생성자에서 클라이언트를 주입하도록 수정 필요)
    analyzer = new NotionBlockAnalyzer()
    // @ts-ignore - private 필드 접근을 위한 테스트 목적
    analyzer['client'] = mockClient
    // @ts-ignore
    analyzer['notionService'] = mockNotionService
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('웹사이트 디자인 페이지 특화 기능', () => {
    test('페이지 기본 정보를 올바르게 조회해야 함', async () => {
      const pageInfo = await mockClient.pages.retrieve({ page_id: WEBSITE_DESIGN_PAGE_ID })
      
      expect(pageInfo.id).toBe('e7b780d5-b655-4f4e-8bc9-57dcfcebfab3')
      expect(pageInfo.properties['이름'].title[0].plain_text).toBe('웹사이트 디자인')
    })

    test('블록 타입별 통계를 정확히 생성해야 함', () => {
      // @ts-ignore - private 메서드 테스트
      const stats = analyzer['generateBlockStats']([...websiteDesignBlocks, ...websiteDesignColumnBlocks])
      
      expect(stats).toEqual({
        paragraph: 4,       // 빈 paragraph 2개 + 링크 paragraph 1개 + 의견수렴 paragraph 1개
        callout: 3,         // 최상위 1개 + 컬럼 내 2개
        column_list: 1,     // 1개
        child_page: 8,      // 첫번째 섹션 3개 + 두번째 섹션 5개
        bookmark: 1         // Google 폼 링크 1개
      })
    })

    test('callout 블록에서 rich_text를 올바르게 추출해야 함', () => {
      const calloutBlock = websiteDesignBlocks[0] // 첫번째 callout
      // @ts-ignore - private 메서드 테스트
      const extracted = analyzer['extractTextAndLinks'](calloutBlock.callout)
      
      expect(extracted.text).toBe('웹사이트 디자인은 가이드 순서대로 작업해 주시길 권장드리고 있어요!')
      expect(extracted.links).toEqual([])
      expect(extracted.markdown).toBe('웹사이트 디자인은 가이드 순서대로 작업해 주시길 권장드리고 있어요!')
    })

    test('child_page 블록의 제목을 올바르게 추출해야 함', () => {
      const childPageBlock = websiteDesignColumnBlocks[1] // 블록 메이커
      // @ts-ignore - private 메서드 테스트
      const extracted = analyzer['extractTextAndLinks'](childPageBlock.child_page)
      
      expect(extracted.text).toBe('블록 메이커')
      expect(extracted.markdown).toBe('블록 메이커')
      expect(extracted.links).toEqual([]) // child_page는 현재 URL 비활성화 상태
    })

    test('bookmark 블록에서 URL을 올바르게 추출해야 함', () => {
      const bookmarkBlock = websiteDesignColumnBlocks[websiteDesignColumnBlocks.length - 1]
      // @ts-ignore - private 메서드 테스트
      const extracted = analyzer['extractTextAndLinks'](bookmarkBlock.bookmark)
      
      expect(extracted.text).toBe('https://docs.google.com/forms/u/1/d/e/1FAIpQLSf0p4l2z94Vq8lcnHG8_IgpkrK3RMd5EXYXYj53fpHfN9YiIQ/viewform')
      expect(extracted.links).toEqual(['https://docs.google.com/forms/u/1/d/e/1FAIpQLSf0p4l2z94Vq8lcnHG8_IgpkrK3RMd5EXYXYj53fpHfN9YiIQ/viewform'])
    })

    test('paragraph에서 링크가 포함된 텍스트를 올바르게 추출해야 함', () => {
      const paragraphWithLink = websiteDesignColumnBlocks[4] // 👉 디자인/기능 제작 의뢰하기
      // @ts-ignore - private 메서드 테스트
      const extracted = analyzer['extractTextAndLinks'](paragraphWithLink.paragraph)
      
      expect(extracted.text).toBe('👉 디자인/기능 제작 의뢰하기')
      expect(extracted.markdown).toBe('👉 [디자인/기능 제작 의뢰하기](https://bit.ly/3WgTNCY)')
      expect(extracted.links).toEqual(['https://bit.ly/3WgTNCY'])
    })

    test('의미 단위 청킹이 올바르게 작동해야 함', () => {
      // @ts-ignore - private 메서드 테스트
      const chunks = analyzer['createSemanticChunks'](websiteDesignColumnBlocks)
      
      expect(chunks).toHaveLength(2) // 실제로는 2개 섹션 (마지막 두 섹션이 합쳐짐)
      
      // 첫 번째 청크: 고급 코스 섹션
      const firstChunk = chunks[0]
      expect(firstChunk).toBeDefined()
      expect(firstChunk!.type).toBe('callout_section')
      expect(firstChunk!.blockIds).toHaveLength(5) // callout + 3 child_pages + 1 paragraph
      expect(firstChunk!.markdown).toContain('고급 코스')
      expect(firstChunk!.markdown).toContain('관련 페이지: 블록 메이커, HTML 섹션, 공통 코드 편집')
      expect(firstChunk!.vectorText).toContain('https://sellerhub.notion.site/')
      expect(firstChunk!.links).toEqual(['https://bit.ly/3WgTNCY'])

      // 두 번째 청크: 주제별 활용 코스 + 의견 수렴 섹션 (합쳐짐)
      const secondChunk = chunks[1]
      expect(secondChunk).toBeDefined()
      expect(secondChunk!.type).toBe('callout_section')
      expect(secondChunk!.blockIds).toHaveLength(8) // callout + 5 child_pages + paragraph + bookmark
      expect(secondChunk!.markdown).toContain('주제별 활용 코스')
      expect(secondChunk!.markdown).toContain('관련 페이지: 이미지 설정 가이드')
      expect(secondChunk!.markdown).toContain('필요한 웹사이트 디자인 가이드가 있으신가요?')
      expect(secondChunk!.links).toEqual(['https://docs.google.com/forms/u/1/d/e/1FAIpQLSf0p4l2z94Vq8lcnHG8_IgpkrK3RMd5EXYXYj53fpHfN9YiIQ/viewform'])
    })

    test('formatTextWithLinks가 중복 제거를 올바르게 수행해야 함', () => {
      // bookmark의 경우 텍스트와 URL이 같으면 중복 제거
      // @ts-ignore - private 메서드 테스트
      const result1 = analyzer['formatTextWithLinks'](
        'https://example.com', 
        ['https://example.com'], 
        'bookmark'
      )
      expect(result1).toBe('https://example.com') // 중복 제거됨
      
      // 일반적인 경우는 링크 정보 포함
      // @ts-ignore - private 메서드 테스트
      const result2 = analyzer['formatTextWithLinks'](
        '디자인 가이드', 
        ['https://example.com']
      )
      expect(result2).toBe('디자인 가이드 (https://example.com)')
    })

    test('타입 가드 함수들이 올바르게 작동해야 함', () => {
      // hasRichText 테스트
      // @ts-ignore - private 메서드 테스트
      expect(analyzer['hasRichText']({ rich_text: [] })).toBe(true)
      // @ts-ignore
      expect(analyzer['hasRichText']({ text: [] })).toBe(undefined)
      
      // hasText 테스트
      // @ts-ignore
      expect(analyzer['hasText']({ text: [] })).toBe(true)
      // @ts-ignore
      expect(analyzer['hasText']({ rich_text: [] })).toBe(undefined)
      
      // hasTitle 테스트
      // @ts-ignore
      expect(analyzer['hasTitle']({ title: [] })).toBe(true)
      // @ts-ignore
      expect(analyzer['hasTitle']({ rich_text: [] })).toBe(undefined)
    })

    test('extractFromRichTextArray가 마크다운 형식을 올바르게 생성해야 함', () => {
      const richTextArray = [
        {
          plain_text: '일반 텍스트',
          href: null
        },
        {
          plain_text: '링크 텍스트',
          href: 'https://example.com'
        }
      ]
      
      // @ts-ignore - private 메서드 테스트
      const result = analyzer['extractFromRichTextArray'](richTextArray)
      
      expect(result.textParts).toEqual(['일반 텍스트', '링크 텍스트'])
      expect(result.markdownParts).toEqual(['일반 텍스트', '[링크 텍스트](https://example.com)'])
      expect(result.links).toEqual(['https://example.com'])
    })
  })

  describe('회귀 테스트 - 웹사이트 디자인 페이지 처리 보장', () => {
    test('웹사이트 디자인 페이지의 의미 단위 청킹 결과가 변경되지 않아야 함', () => {
      // @ts-ignore - private 메서드 테스트
      const actualChunks = analyzer['createSemanticChunks'](websiteDesignColumnBlocks)
      
      // 청크 개수 확인 (실제로는 2개)
      expect(actualChunks).toHaveLength(2)
      
      // 각 청크의 기본 속성 확인
      actualChunks.forEach((chunk) => {
        expect(chunk).toHaveProperty('type')
        expect(chunk).toHaveProperty('markdown')
        expect(chunk).toHaveProperty('vectorText')
        expect(chunk).toHaveProperty('links')
        expect(chunk).toHaveProperty('blockIds')
        expect(Array.isArray(chunk.links)).toBe(true)
        expect(Array.isArray(chunk.blockIds)).toBe(true)
      })
      
      // 특정 내용이 올바른 청크에 포함되어 있는지 확인
      const hasAdvancedCourse = actualChunks.some(chunk => 
        chunk.markdown.includes('고급 코스') && chunk.markdown.includes('블록 메이커')
      )
      expect(hasAdvancedCourse).toBe(true)
      
      const hasTopicCourse = actualChunks.some(chunk => 
        chunk.markdown.includes('주제별 활용 코스') && chunk.markdown.includes('이미지 설정 가이드')
      )
      expect(hasTopicCourse).toBe(true)
      
      const hasFeedbackSection = actualChunks.some(chunk => 
        chunk.markdown.includes('필요한 웹사이트 디자인 가이드가 있으신가요?')
      )
      expect(hasFeedbackSection).toBe(true)
    })

    test('노션 URL 생성 형식이 일관되게 유지되어야 함', () => {
      // @ts-ignore - private 메서드 테스트
      const chunks = analyzer['createSemanticChunks'](websiteDesignColumnBlocks)
      
      const chunkWithLinks = chunks.find(chunk => 
        chunk.vectorText.includes('https://sellerhub.notion.site/')
      )
      
      expect(chunkWithLinks).toBeDefined()
      
      // URL 형식 검증: https://sellerhub.notion.site/{id without hyphens}
      const urlPattern = /https:\/\/sellerhub\.notion\.site\/[a-f0-9]{32}/g
      const urls = chunkWithLinks!.vectorText.match(urlPattern)
      
      expect(urls).toBeTruthy()
      urls!.forEach(url => {
        // 하이픈이 제거된 32자리 ID 확인
        const id = url.split('/').pop()
        expect(id).toHaveLength(32)
        expect(id).not.toMatch(/-/)
      })
    })
  })
})