import type { NotionPage, NotionBlock } from '@/types/notion'
import type { Document, DocumentSource, DocumentMetadata } from '@/types/document'
import { NOTION_BLOCK_TYPES, NOTION_PROPERTY_TYPES } from './notion.constants'

export class NotionMapper {
  /**
   * 노션 페이지를 Document 형식으로 변환
   */
  static mapPageToDocument(notionPage: NotionPage): Document {
    const documentSource: DocumentSource = {
      type: 'notion',
      sourceId: notionPage.id,
      url: notionPage.url,
      ...(notionPage.publicUrl && { publicUrl: notionPage.publicUrl }),
    }

    const documentMetadata: DocumentMetadata = {
      filename: `${notionPage.title}.md`,
      ...(notionPage.properties.tags && { tags: notionPage.properties.tags }),
      author: '노션',
      lastModified: notionPage.updatedAt,
      version: '1.0',
    }

    return {
      id: notionPage.id,
      title: notionPage.title,
      content: notionPage.content,
      source: documentSource,
      metadata: documentMetadata,
      createdAt: notionPage.createdAt,
      updatedAt: notionPage.updatedAt,
    }
  }

  /**
   * 노션 블록을 마크다운으로 변환
   */
  static blocksToMarkdown(blocks: any[]): string {
    const markdown: string[] = []
    
    for (const block of blocks) {
      if (!block.type) continue

      switch (block.type) {
        case NOTION_BLOCK_TYPES.PARAGRAPH:
          if (block.paragraph?.rich_text) {
            const text = this.extractRichText(block.paragraph.rich_text)
            if (text.trim()) markdown.push(text)
          }
          break
        case NOTION_BLOCK_TYPES.HEADING_1:
          if (block.heading_1?.rich_text) {
            const text = this.extractRichText(block.heading_1.rich_text)
            if (text.trim()) markdown.push(`# ${text}`)
          }
          break
        case NOTION_BLOCK_TYPES.HEADING_2:
          if (block.heading_2?.rich_text) {
            const text = this.extractRichText(block.heading_2.rich_text)
            if (text.trim()) markdown.push(`## ${text}`)
          }
          break
        case NOTION_BLOCK_TYPES.HEADING_3:
          if (block.heading_3?.rich_text) {
            const text = this.extractRichText(block.heading_3.rich_text)
            if (text.trim()) markdown.push(`### ${text}`)
          }
          break
        case NOTION_BLOCK_TYPES.BULLETED_LIST_ITEM:
          if (block.bulleted_list_item?.rich_text) {
            const text = this.extractRichText(block.bulleted_list_item.rich_text)
            if (text.trim()) markdown.push(`- ${text}`)
          }
          break
        case NOTION_BLOCK_TYPES.NUMBERED_LIST_ITEM:
          if (block.numbered_list_item?.rich_text) {
            const text = this.extractRichText(block.numbered_list_item.rich_text)
            if (text.trim()) markdown.push(`1. ${text}`)
          }
          break
      }
    }
    
    return markdown.join('\n\n')
  }

  /**
   * 노션 페이지 속성에서 제목 추출
   */
  static extractTitle(properties: any): string {
    for (const [key, property] of Object.entries(properties)) {
      if (property && typeof property === 'object' && 'type' in property) {
        if (property.type === NOTION_PROPERTY_TYPES.TITLE && 'title' in property) {
          const titleArray = property.title as any[]
          if (titleArray && titleArray.length > 0 && titleArray[0].plain_text) {
            return titleArray[0].plain_text
          }
        }
      }
    }
    return 'Untitled'
  }

  /**
   * 리치 텍스트에서 플레인 텍스트 추출
   */
  static extractRichText(richText: any[]): string {
    if (!Array.isArray(richText)) return ''
    
    return richText
      .map((text) => text.plain_text || '')
      .join('')
  }

  /**
   * 노션 페이지 제목 정리
   */
  static sanitizeTitle(title: string): string {
    return title
      .replace(/[^\w\s가-힣]/g, '') // 특수문자 제거
      .replace(/\s+/g, ' ')         // 여러 공백을 하나로
      .trim()                       // 앞뒤 공백 제거
  }
}