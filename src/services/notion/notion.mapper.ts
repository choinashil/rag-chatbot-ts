import type { NotionPage, NotionBlock } from '@/types/notion'
import type { Document, DocumentSource, DocumentMetadata, CollectionMethod } from '@/types/document'
import { NOTION_BLOCK_TYPES, NOTION_PROPERTY_TYPES } from './notion.constants'

export class NotionMapper {
  /**
   * 노션 페이지를 Document 형식으로 변환
   */
  static mapPageToDocument(
    notionPage: NotionPage, 
    options: {
      collectionMethod?: CollectionMethod
      parentPageId?: string
      depthLevel?: number
      extractedLinks?: Array<{text: string, url: string}>
    } = {}
  ): Document {
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
      // 새로운 메타데이터
      pageUrl: notionPage.url,
      pageTitle: notionPage.title,
      ...(options.collectionMethod && { collectionMethod: options.collectionMethod }),
      ...(options.parentPageId && { parentPageId: options.parentPageId }),
      ...(options.depthLevel !== undefined && { depthLevel: options.depthLevel }),
      ...(options.extractedLinks && options.extractedLinks.length > 0 && { links: options.extractedLinks }),
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
   * 노션 블록을 마크다운으로 변환 (이미지/동영상 제외, 링크 정보 포함)
   */
  static blocksToMarkdown(blocks: any[]): string {
    const markdown: string[] = []
    
    console.log(`블록 변환 시작: 총 ${blocks.length}개 블록`)
    
    for (const block of blocks) {
      if (!block.type) {
        console.log('블록 타입이 없는 블록 건너뜀:', block.id || 'unknown')
        continue
      }

      // 이미지/동영상/파일 블록 제외
      if (this.isMediaBlock(block.type)) {
        console.log(`미디어 블록 건너뜀: ${block.type}`)
        continue
      }

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
        case 'quote':
          if (block.quote?.rich_text) {
            const text = this.extractRichText(block.quote.rich_text)
            if (text.trim()) markdown.push(`> ${text}`)
          }
          break
        case 'code':
          if (block.code?.rich_text) {
            const text = this.extractRichText(block.code.rich_text)
            const language = block.code.language || ''
            if (text.trim()) markdown.push(`\`\`\`${language}\n${text}\n\`\`\``)
          }
          break
        default:
          console.log(`지원하지 않는 블록 타입: ${block.type}`)
          // 기본적으로 rich_text 필드가 있는지 확인해서 텍스트 추출 시도
          if (block[block.type]?.rich_text) {
            const text = this.extractRichText(block[block.type].rich_text)
            if (text.trim()) {
              console.log(`지원하지 않는 블록에서 텍스트 추출 성공: ${block.type}`)
              markdown.push(text)
            }
          }
          break
      }
    }
    
    console.log(`블록 변환 완료: ${markdown.length}개 텍스트 블록 추출`)
    const result = markdown.join('\n\n')
    console.log(`최종 텍스트 길이: ${result.length}자`)
    
    return result
  }

  /**
   * 미디어 블록인지 확인 (이미지, 동영상, 파일 등)
   */
  static isMediaBlock(blockType: string): boolean {
    const mediaTypes = [
      'image',
      'video', 
      'audio',
      'file',
      'pdf',
      'embed',
      'bookmark'
    ]
    
    return mediaTypes.includes(blockType)
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
   * 리치 텍스트에서 플레인 텍스트 및 링크 정보 추출
   */
  static extractRichText(richText: any[]): string {
    if (!Array.isArray(richText)) return ''
    
    return richText
      .map((text) => {
        const plainText = text.plain_text || ''
        
        // 링크가 있는 경우 링크 정보 포함
        if (text.href) {
          return `[${plainText}](${text.href})`
        }
        
        return plainText
      })
      .join('')
  }

  /**
   * 블록에서 링크 정보 추출 (메타데이터용)
   */
  static extractLinksFromBlock(block: any): Array<{text: string, url: string}> {
    const links: Array<{text: string, url: string}> = []
    
    // 블록 타입에 따라 rich_text 필드 위치가 다름
    let richTextArray: any[] = []
    
    switch (block.type) {
      case NOTION_BLOCK_TYPES.PARAGRAPH:
        richTextArray = block.paragraph?.rich_text || []
        break
      case NOTION_BLOCK_TYPES.HEADING_1:
        richTextArray = block.heading_1?.rich_text || []
        break
      case NOTION_BLOCK_TYPES.HEADING_2:
        richTextArray = block.heading_2?.rich_text || []
        break
      case NOTION_BLOCK_TYPES.HEADING_3:
        richTextArray = block.heading_3?.rich_text || []
        break
      case NOTION_BLOCK_TYPES.BULLETED_LIST_ITEM:
        richTextArray = block.bulleted_list_item?.rich_text || []
        break
      case NOTION_BLOCK_TYPES.NUMBERED_LIST_ITEM:
        richTextArray = block.numbered_list_item?.rich_text || []
        break
    }
    
    // 링크 정보 추출
    for (const textItem of richTextArray) {
      if (textItem.href && textItem.plain_text) {
        links.push({
          text: textItem.plain_text,
          url: textItem.href
        })
      }
    }
    
    return links
  }

  /**
   * 모든 블록에서 링크 정보 추출
   */
  static extractAllLinksFromBlocks(blocks: any[]): Array<{text: string, url: string}> {
    const allLinks: Array<{text: string, url: string}> = []
    
    for (const block of blocks) {
      if (!block.type) continue
      
      const links = this.extractLinksFromBlock(block)
      allLinks.push(...links)
    }
    
    return allLinks
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