import { NotionMapper } from '../../../../src/services/notion/notion.mapper'
import { NOTION_BLOCK_TYPES } from '../../../../src/services/notion/notion.constants'

describe('NotionMapper - Callout and Column Blocks', () => {
  describe('callout 블록 처리', () => {
    it('기본 callout 블록을 마크다운으로 변환해야 함', () => {
      const calloutBlock = {
        object: 'block',
        id: 'test-callout-id',
        type: NOTION_BLOCK_TYPES.CALLOUT,
        callout: {
          rich_text: [
            {
              type: 'text',
              text: { content: '중요한 정보입니다!', link: null },
              plain_text: '중요한 정보입니다!',
              href: null
            }
          ],
          icon: { type: 'emoji', emoji: '💡' },
          color: 'yellow_background'
        }
      }

      const result = NotionMapper.blocksToMarkdown([calloutBlock])
      
      expect(result).toBe('> 💡 **[yellow_background]** 중요한 정보입니다!')
    })

    it('링크가 포함된 callout 블록을 마크다운으로 변환해야 함', () => {
      const calloutBlock = {
        object: 'block',
        id: 'test-callout-id',
        type: NOTION_BLOCK_TYPES.CALLOUT,
        callout: {
          rich_text: [
            {
              type: 'text',
              text: { content: '자세한 내용은 ', link: null },
              plain_text: '자세한 내용은 ',
              href: null
            },
            {
              type: 'text',
              text: { content: '여기를 클릭', link: { url: 'https://example.com' } },
              plain_text: '여기를 클릭',
              href: 'https://example.com'
            }
          ],
          icon: { type: 'emoji', emoji: '📖' },
          color: 'blue_background'
        }
      }

      const result = NotionMapper.blocksToMarkdown([calloutBlock])
      
      expect(result).toBe('> 📖 **[blue_background]** 자세한 내용은 [여기를 클릭](https://example.com)')
    })

    it('아이콘이 없는 callout 블록을 처리해야 함', () => {
      const calloutBlock = {
        object: 'block',
        id: 'test-callout-id',
        type: NOTION_BLOCK_TYPES.CALLOUT,
        callout: {
          rich_text: [
            {
              type: 'text',
              text: { content: '일반 알림', link: null },
              plain_text: '일반 알림',
              href: null
            }
          ],
          color: 'default'
        }
      }

      const result = NotionMapper.blocksToMarkdown([calloutBlock])
      
      expect(result).toBe('>  **[default]** 일반 알림')
    })

    it('빈 callout 블록을 건너뛰어야 함', () => {
      const calloutBlock = {
        object: 'block',
        id: 'test-callout-id',
        type: NOTION_BLOCK_TYPES.CALLOUT,
        callout: {
          rich_text: [],
          color: 'default'
        }
      }

      const result = NotionMapper.blocksToMarkdown([calloutBlock])
      
      expect(result).toBe('')
    })
  })

  describe('callout 상세 정보 추출', () => {
    it('callout에서 상세 정보를 올바르게 추출해야 함', () => {
      const calloutBlock = {
        object: 'block',
        id: 'test-callout-id',
        type: NOTION_BLOCK_TYPES.CALLOUT,
        callout: {
          rich_text: [
            {
              type: 'text',
              text: { content: '일반 텍스트 ', link: null },
              plain_text: '일반 텍스트 ',
              href: null
            },
            {
              type: 'text',
              text: { content: '링크 텍스트', link: { url: 'https://example.com' } },
              plain_text: '링크 텍스트',
              href: 'https://example.com'
            }
          ],
          icon: { type: 'emoji', emoji: '🎯' },
          color: 'red_background'
        }
      }

      const result = NotionMapper.extractCalloutDetails(calloutBlock)
      
      expect(result).toEqual({
        text: '일반 텍스트 링크 텍스트',
        icon: '🎯',
        color: 'red_background',
        links: [
          { text: '링크 텍스트', url: 'https://example.com' }
        ]
      })
    })

    it('callout이 아닌 블록에 대해 null을 반환해야 함', () => {
      const paragraphBlock = {
        object: 'block',
        id: 'test-paragraph-id',
        type: NOTION_BLOCK_TYPES.PARAGRAPH,
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: '일반 문단', link: null },
              plain_text: '일반 문단',
              href: null
            }
          ]
        }
      }

      const result = NotionMapper.extractCalloutDetails(paragraphBlock)
      
      expect(result).toBeNull()
    })
  })

  describe('column 블록 처리', () => {
    it('column_list 블록을 건너뛰어야 함', () => {
      const columnListBlock = {
        object: 'block',
        id: 'test-column-list-id',
        type: NOTION_BLOCK_TYPES.COLUMN_LIST,
        column_list: {},
        has_children: true
      }

      const result = NotionMapper.blocksToMarkdown([columnListBlock])
      
      expect(result).toBe('')
    })

    it('column 블록을 건너뛰어야 함', () => {
      const columnBlock = {
        object: 'block',
        id: 'test-column-id',
        type: NOTION_BLOCK_TYPES.COLUMN,
        column: {},
        has_children: true
      }

      const result = NotionMapper.blocksToMarkdown([columnBlock])
      
      expect(result).toBe('')
    })

    it('column_marker 블록을 올바르게 처리해야 함', () => {
      const columnMarkerBlock = {
        object: 'block',
        id: 'test-column-marker-id',
        type: 'column_marker',
        column_marker: {
          columnIndex: 0,
          originalColumnId: 'original-column-id'
        }
      }

      const result = NotionMapper.blocksToMarkdown([columnMarkerBlock])
      
      expect(result).toBe('\n**[컬럼 1]**')
    })

    it('여러 컬럼과 내용이 함께 있을 때 올바르게 처리해야 함', () => {
      const blocks = [
        {
          object: 'block',
          id: 'column-marker-1',
          type: 'column_marker',
          column_marker: { columnIndex: 0, originalColumnId: 'col1' }
        },
        {
          object: 'block',
          id: 'paragraph-1',
          type: NOTION_BLOCK_TYPES.PARAGRAPH,
          paragraph: {
            rich_text: [
              { type: 'text', text: { content: '첫 번째 컬럼 내용', link: null }, plain_text: '첫 번째 컬럼 내용', href: null }
            ]
          }
        },
        {
          object: 'block',
          id: 'column-marker-2',
          type: 'column_marker',
          column_marker: { columnIndex: 1, originalColumnId: 'col2' }
        },
        {
          object: 'block',
          id: 'paragraph-2',
          type: NOTION_BLOCK_TYPES.PARAGRAPH,
          paragraph: {
            rich_text: [
              { type: 'text', text: { content: '두 번째 컬럼 내용', link: null }, plain_text: '두 번째 컬럼 내용', href: null }
            ]
          }
        }
      ]

      const result = NotionMapper.blocksToMarkdown(blocks)
      
      expect(result).toBe('\n**[컬럼 1]**\n\n첫 번째 컬럼 내용\n\n\n**[컬럼 2]**\n\n두 번째 컬럼 내용')
    })
  })

  describe('링크 추출', () => {
    it('callout 블록에서 링크를 추출해야 함', () => {
      const calloutBlock = {
        object: 'block',
        id: 'test-callout-id',
        type: NOTION_BLOCK_TYPES.CALLOUT,
        callout: {
          rich_text: [
            {
              type: 'text',
              text: { content: '일반 텍스트 ', link: null },
              plain_text: '일반 텍스트 ',
              href: null
            },
            {
              type: 'text',
              text: { content: '링크1', link: { url: 'https://example1.com' } },
              plain_text: '링크1',
              href: 'https://example1.com'
            },
            {
              type: 'text',
              text: { content: ' 그리고 ', link: null },
              plain_text: ' 그리고 ',
              href: null
            },
            {
              type: 'text',
              text: { content: '링크2', link: { url: 'https://example2.com' } },
              plain_text: '링크2',
              href: 'https://example2.com'
            }
          ]
        }
      }

      const links = NotionMapper.extractLinksFromBlock(calloutBlock)
      
      expect(links).toEqual([
        { text: '링크1', url: 'https://example1.com' },
        { text: '링크2', url: 'https://example2.com' }
      ])
    })

    it('링크가 없는 callout 블록에서 빈 배열을 반환해야 함', () => {
      const calloutBlock = {
        object: 'block',
        id: 'test-callout-id',
        type: NOTION_BLOCK_TYPES.CALLOUT,
        callout: {
          rich_text: [
            {
              type: 'text',
              text: { content: '링크가 없는 텍스트', link: null },
              plain_text: '링크가 없는 텍스트',
              href: null
            }
          ]
        }
      }

      const links = NotionMapper.extractLinksFromBlock(calloutBlock)
      
      expect(links).toEqual([])
    })
  })

  describe('has_children 블록 타입 확인', () => {
    it('컨테이너 블록 타입들을 올바르게 식별해야 함', () => {
      expect(NotionMapper.hasChildrenBlocks(NOTION_BLOCK_TYPES.COLUMN_LIST)).toBe(true)
      expect(NotionMapper.hasChildrenBlocks(NOTION_BLOCK_TYPES.COLUMN)).toBe(true)
      expect(NotionMapper.hasChildrenBlocks('toggle')).toBe(true)
      expect(NotionMapper.hasChildrenBlocks('child_page')).toBe(true)
      expect(NotionMapper.hasChildrenBlocks('child_database')).toBe(true)
    })

    it('일반 블록 타입들을 올바르게 식별해야 함', () => {
      expect(NotionMapper.hasChildrenBlocks(NOTION_BLOCK_TYPES.PARAGRAPH)).toBe(false)
      expect(NotionMapper.hasChildrenBlocks(NOTION_BLOCK_TYPES.HEADING_1)).toBe(false)
      expect(NotionMapper.hasChildrenBlocks(NOTION_BLOCK_TYPES.CALLOUT)).toBe(false)
      expect(NotionMapper.hasChildrenBlocks(NOTION_BLOCK_TYPES.BULLETED_LIST_ITEM)).toBe(false)
    })
  })
})