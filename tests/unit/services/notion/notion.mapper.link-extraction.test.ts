import { NotionMapper } from '../../../../src/services/notion/notion.mapper'
import type { NotionPage } from '../../../../src/types/notion'

describe('NotionMapper - 링크 추출 기능', () => {
  describe('extractLinksFromBlock', () => {
    test('paragraph 블록에서 링크를 추출해야 한다', () => {
      // Given
      const block = {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { plain_text: 'Visit our ', href: null },
            { plain_text: 'website', href: 'https://example.com' },
            { plain_text: ' and our ', href: null },
            { plain_text: 'blog', href: 'https://blog.example.com' }
          ]
        }
      }

      // When
      const links = NotionMapper.extractLinksFromBlock(block)

      // Then
      expect(links).toHaveLength(2)
      expect(links[0]).toEqual({ text: 'website', url: 'https://example.com' })
      expect(links[1]).toEqual({ text: 'blog', url: 'https://blog.example.com' })
    })

    test('heading 블록에서 링크를 추출해야 한다', () => {
      // Given
      const headingBlock = {
        type: 'heading_1',
        heading_1: {
          rich_text: [
            { plain_text: 'See ', href: null },
            { plain_text: 'documentation', href: 'https://docs.example.com' }
          ]
        }
      }

      // When
      const links = NotionMapper.extractLinksFromBlock(headingBlock)

      // Then
      expect(links).toHaveLength(1)
      expect(links[0]).toEqual({ text: 'documentation', url: 'https://docs.example.com' })
    })

    test('list item 블록에서 링크를 추출해야 한다', () => {
      // Given
      const listBlock = {
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [
            { plain_text: 'Check out ', href: null },
            { plain_text: 'this resource', href: 'https://resource.com' }
          ]
        }
      }

      // When
      const links = NotionMapper.extractLinksFromBlock(listBlock)

      // Then
      expect(links).toHaveLength(1)
      expect(links[0]).toEqual({ text: 'this resource', url: 'https://resource.com' })
    })

    test('링크가 없는 블록은 빈 배열을 반환해야 한다', () => {
      // Given
      const blockWithoutLinks = {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { plain_text: 'Simple text without any links', href: null }
          ]
        }
      }

      // When
      const links = NotionMapper.extractLinksFromBlock(blockWithoutLinks)

      // Then
      expect(links).toHaveLength(0)
    })

    test('지원하지 않는 블록 타입은 빈 배열을 반환해야 한다', () => {
      // Given
      const unsupportedBlock = {
        type: 'image',
        image: {
          // 이미지 블록에는 rich_text가 없음
        }
      }

      // When
      const links = NotionMapper.extractLinksFromBlock(unsupportedBlock)

      // Then
      expect(links).toHaveLength(0)
    })

    test('rich_text가 없는 블록은 빈 배열을 반환해야 한다', () => {
      // Given
      const blockWithoutRichText = {
        type: 'paragraph',
        paragraph: {}
      }

      // When
      const links = NotionMapper.extractLinksFromBlock(blockWithoutRichText)

      // Then
      expect(links).toHaveLength(0)
    })
  })

  describe('extractAllLinksFromBlocks', () => {
    test('여러 블록에서 모든 링크를 추출해야 한다', () => {
      // Given
      const blocks = [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { plain_text: 'Visit ', href: null },
              { plain_text: 'our website', href: 'https://example.com' }
            ]
          }
        },
        {
          type: 'heading_1',
          heading_1: {
            rich_text: [
              { plain_text: 'See ', href: null },
              { plain_text: 'docs', href: 'https://docs.example.com' },
              { plain_text: ' and ', href: null },
              { plain_text: 'API reference', href: 'https://api.example.com' }
            ]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { plain_text: 'No links here', href: null }
            ]
          }
        }
      ]

      // When
      const allLinks = NotionMapper.extractAllLinksFromBlocks(blocks)

      // Then
      expect(allLinks).toHaveLength(3)
      expect(allLinks[0]).toEqual({ text: 'our website', url: 'https://example.com' })
      expect(allLinks[1]).toEqual({ text: 'docs', url: 'https://docs.example.com' })
      expect(allLinks[2]).toEqual({ text: 'API reference', url: 'https://api.example.com' })
    })

    test('빈 블록 배열은 빈 링크 배열을 반환해야 한다', () => {
      // Given
      const emptyBlocks: any[] = []

      // When
      const allLinks = NotionMapper.extractAllLinksFromBlocks(emptyBlocks)

      // Then
      expect(allLinks).toHaveLength(0)
    })

    test('링크가 없는 블록들은 빈 배열을 반환해야 한다', () => {
      // Given
      const blocksWithoutLinks = [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { plain_text: 'Just text', href: null }
            ]
          }
        },
        {
          type: 'heading_2',
          heading_2: {
            rich_text: [
              { plain_text: 'Another heading', href: null }
            ]
          }
        }
      ]

      // When
      const allLinks = NotionMapper.extractAllLinksFromBlocks(blocksWithoutLinks)

      // Then
      expect(allLinks).toHaveLength(0)
    })

    test('타입이 없는 블록들은 무시해야 한다', () => {
      // Given
      const blocksWithInvalidTypes = [
        {
          // type이 없는 블록
          paragraph: {
            rich_text: [
              { plain_text: 'link text', href: 'https://should-be-ignored.com' }
            ]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [
              { plain_text: 'valid link', href: 'https://valid.com' }
            ]
          }
        }
      ]

      // When
      const allLinks = NotionMapper.extractAllLinksFromBlocks(blocksWithInvalidTypes)

      // Then
      expect(allLinks).toHaveLength(1)
      expect(allLinks[0]).toEqual({ text: 'valid link', url: 'https://valid.com' })
    })
  })

  describe('extractRichText - 링크 정보 포함', () => {
    test('링크가 포함된 rich text를 마크다운 형식으로 변환해야 한다', () => {
      // Given
      const richText = [
        { plain_text: 'Visit our ', href: null },
        { plain_text: 'website', href: 'https://example.com' },
        { plain_text: ' for more information.', href: null }
      ]

      // When
      const result = NotionMapper.extractRichText(richText)

      // Then
      expect(result).toBe('Visit our [website](https://example.com) for more information.')
    })

    test('링크가 없는 rich text는 평문으로 반환해야 한다', () => {
      // Given
      const richText = [
        { plain_text: 'Simple text without links', href: null }
      ]

      // When
      const result = NotionMapper.extractRichText(richText)

      // Then
      expect(result).toBe('Simple text without links')
    })

    test('여러 링크가 있는 rich text를 올바르게 처리해야 한다', () => {
      // Given
      const richText = [
        { plain_text: 'Check out our ', href: null },
        { plain_text: 'website', href: 'https://example.com' },
        { plain_text: ' and ', href: null },
        { plain_text: 'documentation', href: 'https://docs.example.com' },
        { plain_text: '.', href: null }
      ]

      // When
      const result = NotionMapper.extractRichText(richText)

      // Then
      expect(result).toBe('Check out our [website](https://example.com) and [documentation](https://docs.example.com).')
    })

    test('빈 배열은 빈 문자열을 반환해야 한다', () => {
      // Given
      const emptyRichText: any[] = []

      // When
      const result = NotionMapper.extractRichText(emptyRichText)

      // Then
      expect(result).toBe('')
    })

    test('배열이 아닌 입력은 빈 문자열을 반환해야 한다', () => {
      // Given
      const invalidInput = null as any

      // When
      const result = NotionMapper.extractRichText(invalidInput)

      // Then
      expect(result).toBe('')
    })
  })

  describe('mapPageToDocument - 링크 메타데이터 포함', () => {
    const mockNotionPage: NotionPage = {
      id: 'test-page-id',
      title: 'Test Page',
      content: 'Test content',
      properties: {},
      createdAt: new Date('2025-01-08T12:00:00Z'),
      updatedAt: new Date('2025-01-08T12:00:00Z'),
      url: 'https://notion.so/test-page-id'
    }

    test('추출된 링크를 메타데이터에 포함해야 한다', () => {
      // Given
      const extractedLinks = [
        { text: 'website', url: 'https://example.com' },
        { text: 'docs', url: 'https://docs.example.com' }
      ]

      const options = {
        collectionMethod: 'page' as const,
        parentPageId: 'parent-id',
        depthLevel: 2,
        extractedLinks
      }

      // When
      const document = NotionMapper.mapPageToDocument(mockNotionPage, options)

      // Then
      expect(document.metadata.links).toEqual(extractedLinks)
      expect(document.metadata.collectionMethod).toBe('page')
      expect(document.metadata.parentPageId).toBe('parent-id')
      expect(document.metadata.depthLevel).toBe(2)
    })

    test('링크가 없는 경우 links 메타데이터를 포함하지 않아야 한다', () => {
      // Given
      const options = {
        collectionMethod: 'database' as const,
        depthLevel: 0,
        extractedLinks: []
      }

      // When
      const document = NotionMapper.mapPageToDocument(mockNotionPage, options)

      // Then
      expect(document.metadata.links).toBeUndefined()
      expect(document.metadata.collectionMethod).toBe('database')
    })

    test('옵션이 없는 경우 기본값으로 문서를 생성해야 한다', () => {
      // When
      const document = NotionMapper.mapPageToDocument(mockNotionPage)

      // Then
      expect(document.metadata.collectionMethod).toBeUndefined()
      expect(document.metadata.parentPageId).toBeUndefined()
      expect(document.metadata.depthLevel).toBeUndefined()
      expect(document.metadata.links).toBeUndefined()
      expect(document.metadata.pageUrl).toBe(mockNotionPage.url)
      expect(document.metadata.pageTitle).toBe(mockNotionPage.title)
    })
  })
})