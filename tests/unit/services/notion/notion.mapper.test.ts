// NotionMapper 단위 테스트
import { NotionMapper } from '../../../../src/services/notion/notion.mapper'
import type { NotionPage } from '../../../../src/types/notion'

describe('NotionMapper', () => {
  describe('blocksToMarkdown() 동작', () => {
    test('빈 블록 배열 처리', () => {
      const result = NotionMapper.blocksToMarkdown([])
      expect(result).toBe('')
    })

    test('문단 블록 변환', () => {
      const blocks = [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'This is a paragraph.' }]
          }
        }
      ]

      const result = NotionMapper.blocksToMarkdown(blocks)
      expect(result).toBe('This is a paragraph.')
    })

    test('제목 블록들 변환', () => {
      const blocks = [
        {
          type: 'heading_1',
          heading_1: {
            rich_text: [{ plain_text: 'Main Title' }]
          }
        },
        {
          type: 'heading_2',
          heading_2: {
            rich_text: [{ plain_text: 'Sub Title' }]
          }
        },
        {
          type: 'heading_3',
          heading_3: {
            rich_text: [{ plain_text: 'Minor Title' }]
          }
        }
      ]

      const result = NotionMapper.blocksToMarkdown(blocks)
      expect(result).toBe('# Main Title\n\n## Sub Title\n\n### Minor Title')
    })

    test('리스트 블록 변환', () => {
      const blocks = [
        {
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ plain_text: 'First bullet point' }]
          }
        },
        {
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: [{ plain_text: 'First numbered item' }]
          }
        }
      ]

      const result = NotionMapper.blocksToMarkdown(blocks)
      expect(result).toBe('- First bullet point\n\n1. First numbered item')
    })

    test('혼합 블록 변환', () => {
      const blocks = [
        {
          type: 'heading_1',
          heading_1: {
            rich_text: [{ plain_text: 'Introduction' }]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'This is an introduction paragraph.' }]
          }
        },
        {
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ plain_text: 'Key point one' }]
          }
        }
      ]

      const result = NotionMapper.blocksToMarkdown(blocks)
      expect(result).toBe('# Introduction\n\nThis is an introduction paragraph.\n\n- Key point one')
    })

    test('빈 텍스트 블록 제외', () => {
      const blocks = [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: '   ' }] // 공백만 있는 경우
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'Valid content' }]
          }
        }
      ]

      const result = NotionMapper.blocksToMarkdown(blocks)
      expect(result).toBe('Valid content')
    })

    test('지원하지 않는 블록 타입 무시', () => {
      const blocks = [
        {
          type: 'unsupported_block',
          unsupported_block: {
            rich_text: [{ plain_text: 'This should be ignored' }]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'This should be included' }]
          }
        }
      ]

      const result = NotionMapper.blocksToMarkdown(blocks)
      expect(result).toBe('This should be included')
    })

    test('type 속성이 없는 블록 무시', () => {
      const blocks = [
        {
          // type 속성 없음
          paragraph: {
            rich_text: [{ plain_text: 'This should be ignored' }]
          }
        },
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [{ plain_text: 'This should be included' }]
          }
        }
      ]

      const result = NotionMapper.blocksToMarkdown(blocks)
      expect(result).toBe('This should be included')
    })
  })

  describe('extractTitle() 동작', () => {
    test('유효한 title 속성 추출', () => {
      const properties = {
        Name: {
          type: 'title',
          title: [{ plain_text: 'Test Page Title' }]
        }
      }

      const result = NotionMapper.extractTitle(properties)
      expect(result).toBe('Test Page Title')
    })

    test('빈 title 배열 처리', () => {
      const properties = {
        Name: {
          type: 'title',
          title: []
        }
      }

      const result = NotionMapper.extractTitle(properties)
      expect(result).toBe('Untitled')
    })

    test('title 속성이 없는 경우', () => {
      const properties = {
        Status: {
          type: 'select',
          select: { name: 'Published' }
        }
      }

      const result = NotionMapper.extractTitle(properties)
      expect(result).toBe('Untitled')
    })

    test('여러 title 중 첫 번째 사용', () => {
      const properties = {
        Name: {
          type: 'title',
          title: [
            { plain_text: 'First Title' },
            { plain_text: 'Second Title' }
          ]
        }
      }

      const result = NotionMapper.extractTitle(properties)
      expect(result).toBe('First Title')
    })

    test('잘못된 속성 구조 처리', () => {
      const properties = {
        Name: {
          type: 'title',
          title: [{ no_plain_text: 'Invalid Structure' }]
        }
      }

      const result = NotionMapper.extractTitle(properties)
      expect(result).toBe('Untitled')
    })
  })

  describe('extractRichText() 동작', () => {
    test('유효한 rich_text 배열 처리', () => {
      const richText = [
        { plain_text: 'First part ' },
        { plain_text: 'second part' }
      ]

      const result = NotionMapper.extractRichText(richText)
      expect(result).toBe('First part second part')
    })

    test('빈 배열 처리', () => {
      const result = NotionMapper.extractRichText([])
      expect(result).toBe('')
    })

    test('배열이 아닌 경우 처리', () => {
      const result = NotionMapper.extractRichText(null as any)
      expect(result).toBe('')

      const result2 = NotionMapper.extractRichText('invalid' as any)
      expect(result2).toBe('')
    })

    test('plain_text가 없는 객체 처리', () => {
      const richText = [
        { other_property: 'value' },
        { plain_text: 'valid text' }
      ]

      const result = NotionMapper.extractRichText(richText)
      expect(result).toBe('valid text')
    })

    test('null/undefined plain_text 처리', () => {
      const richText = [
        { plain_text: null },
        { plain_text: 'valid text' },
        { plain_text: undefined }
      ]

      const result = NotionMapper.extractRichText(richText)
      expect(result).toBe('valid text')
    })
  })

  describe('mapPageToDocument() 동작', () => {
    const sampleNotionPage: NotionPage = {
      id: 'test-page-id',
      title: 'Test Page',
      content: '# Test\n\nThis is test content.',
      properties: {
        status: 'Published',
        tags: ['test', 'notion']
      },
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
      updatedAt: new Date('2023-01-02T00:00:00.000Z'),
      url: 'https://notion.so/test-page-id',
      publicUrl: 'https://public.notion.so/test-page-id'
    }

    test('NotionPage를 Document로 정상 변환', () => {
      const result = NotionMapper.mapPageToDocument(sampleNotionPage)

      expect(result).toMatchObject({
        id: 'test-page-id',
        title: 'Test Page',
        content: '# Test\n\nThis is test content.',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-02T00:00:00.000Z')
      })

      expect(result.source).toMatchObject({
        type: 'notion',
        sourceId: 'test-page-id',
        url: 'https://notion.so/test-page-id',
        publicUrl: 'https://public.notion.so/test-page-id'
      })

      expect(result.metadata).toMatchObject({
        filename: 'Test Page.md',
        tags: ['test', 'notion'],
        author: '노션',
        lastModified: new Date('2023-01-02T00:00:00.000Z'),
        version: '1.0'
      })
    })

    test('publicUrl이 없는 경우 처리', () => {
      const pageWithoutPublicUrl = { ...sampleNotionPage }
      delete pageWithoutPublicUrl.publicUrl

      const result = NotionMapper.mapPageToDocument(pageWithoutPublicUrl)

      expect(result.source).not.toHaveProperty('publicUrl')
      expect(result.source.url).toBe('https://notion.so/test-page-id')
    })

    test('properties.tags가 없는 경우 처리', () => {
      const pageWithoutTags: NotionPage = {
        ...sampleNotionPage,
        properties: {
          status: 'Draft'
        }
      }

      const result = NotionMapper.mapPageToDocument(pageWithoutTags)

      expect(result.metadata).not.toHaveProperty('tags')
      expect(result.metadata.author).toBe('노션')
    })
  })

  describe('sanitizeTitle() 동작', () => {
    test('특수문자 제거', () => {
      const result = NotionMapper.sanitizeTitle('Test@#$%^&*()Title!')
      expect(result).toBe('TestTitle')
    })

    test('한글 보존', () => {
      const result = NotionMapper.sanitizeTitle('테스트 제목입니다!')
      expect(result).toBe('테스트 제목입니다')
    })

    test('여러 공백을 하나로 변환', () => {
      const result = NotionMapper.sanitizeTitle('Test    Multiple     Spaces')
      expect(result).toBe('Test Multiple Spaces')
    })

    test('앞뒤 공백 제거', () => {
      const result = NotionMapper.sanitizeTitle('   Test Title   ')
      expect(result).toBe('Test Title')
    })

    test('복합 처리', () => {
      const result = NotionMapper.sanitizeTitle('  테스트@#$   제목입니다!!!   ')
      expect(result).toBe('테스트 제목입니다')
    })

    test('빈 문자열 처리', () => {
      const result = NotionMapper.sanitizeTitle('')
      expect(result).toBe('')
    })
  })
})