import type { NotionPage, NotionBlock } from '@/types/notion'
import type { Document, DocumentSource, DocumentMetadata } from '@/types/document'

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
  static mapBlocksToMarkdown(blocks: NotionBlock[]): string {
    // TODO: 노션 블록 → 마크다운 변환 로직 구현
    return blocks.map(block => block.content).join('\n\n')
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