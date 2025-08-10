#!/usr/bin/env npx tsx

/**
 * 노션 페이지 블록 구조 분석 스크립트
 * 
 * 목표:
 * 1. 특정 페이지의 실제 블록 구조 확인
 * 2. callout 블록의 JSON 구조 분석
 * 3. column_list와 column 블록의 구조 분석
 * 4. 각 블록에서 텍스트를 추출하는 방법 제안
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { NotionService } from '../../src/services/notion/notion.service'
import type { NotionConfig } from '../../src/types/notion'
import { Client } from '@notionhq/client'

// 환경변수 로드
config({ path: resolve(__dirname, '../env/.env.prod') })

const PAGE = {
  WEBSITE_DESIGN: 'e7b780d5b6554f4e8bc957dcfcebfab3', // 웹사이트 디자인
  WEBSITE_DESIGN_INTRO: 'ed3854bf53934425a3ef0161ca54690f' // 웹사이트 디자인 입문하기
}

let TARGET_PAGE_ID = PAGE.WEBSITE_DESIGN_INTRO // Default page ID

class NotionBlockAnalyzer {
  private static readonly NOTION_BASE_URL = 'https://sellerhub.notion.site'
  private notionService: NotionService
  private client: Client

  /**
   * 블록 타입별 특화 분석기 레지스트리
   */
  private blockAnalyzers: Map<string, (blocks: any[]) => Promise<void> | void> = new Map([
    ['callout', this.analyzeCalloutBlocks.bind(this)],
    ['column_list', this.analyzeColumnBlocks.bind(this)],
    ['column', this.analyzeColumnBlocks.bind(this)]
  ])

  /**
   * 타입 가드: rich_text 배열이 있는지 확인
   */
  private hasRichText(blockData: any): blockData is { rich_text: Array<any> } {
    return blockData.rich_text && Array.isArray(blockData.rich_text)
  }

  /**
   * 타입 가드: text 배열이 있는지 확인
   */
  private hasText(blockData: any): blockData is { text: Array<any> } {
    return blockData.text && Array.isArray(blockData.text)
  }

  /**
   * 타입 가드: title 배열이 있는지 확인
   */
  private hasTitle(blockData: any): blockData is { title: Array<any> } {
    return blockData.title && Array.isArray(blockData.title)
  }

  /**
   * rich_text 배열에서 텍스트와 링크를 추출하는 유틸리티 함수 (스타일링 포함)
   */
  private extractFromRichTextArray(items: any[]): { textParts: string[], markdownParts: string[], links: string[] } {
    const textParts: string[] = []
    const markdownParts: string[] = []
    const links: string[] = []
    
    items.forEach((item: any) => {
      if (item.plain_text) {
        textParts.push(item.plain_text)
        
        let markdownText = item.plain_text
        
        // 스타일링 적용 (우선순위: 링크 > 코드 > 볼드)
        if (item.href) {
          links.push(item.href)
          markdownText = `[${item.plain_text}](${item.href})`
        } else if (item.annotations) {
          // 코드 스타일
          if (item.annotations.code) {
            markdownText = `\`${item.plain_text}\``
          }
          // 볼드 스타일
          else if (item.annotations.bold) {
            markdownText = `**${item.plain_text}**`
          }
          // 이탤릭 스타일
          else if (item.annotations.italic) {
            markdownText = `*${item.plain_text}*`
          }
        }
        
        markdownParts.push(markdownText)
      }
    })
    
    return { textParts, markdownParts, links }
  }

  /**
   * 텍스트에 링크 정보를 포함하여 포맷팅 (중복 제거)
   */
  private formatTextWithLinks(text: string, links: string[], blockType: string = ''): string {
    if (links.length === 0) return text
    
    // bookmark의 경우 텍스트와 URL이 같으면 중복 제거
    if (blockType === 'bookmark' && text === links[0]) {
      return text
    }
    
    return `${text} (${links.join(', ')})`
  }

  constructor() {
    const notionConfig: NotionConfig = {
      integrationToken: process.env.NOTION_INTEGRATION_TOKEN!,
      timeout: 30000,
      retryAttempts: 1
    }

    this.notionService = new NotionService(notionConfig)
    this.client = new Client({ auth: notionConfig.integrationToken })
  }

  /**
   * 페이지의 모든 블록을 재귀적으로 수집
   */
  private async getAllBlocks(blockId: string, depth: number = 0): Promise<any[]> {
    const maxDepth = 2 // callout 하위 블록 수집을 위해 깊이 증가
    if (depth > maxDepth) {
      console.log(`⚠️  최대 깊이(${maxDepth}) 도달, 블록 ${blockId} 건너뜀`)
      return []
    }

    try {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        page_size: 100
      })

      const blocks: any[] = []
      const indent = '  '.repeat(depth)

      for (const block of response.results) {
        if ('type' in block) {
          console.log(`${indent}📦 블록 발견: ${block.type} (${block.id})`)
          blocks.push(block as any)

          // 하위 블록이 있는 경우 재귀적으로 수집
          if (block.has_children) {
            console.log(`${indent}  └─ 하위 블록 탐색 중...`)
            const childBlocks = await this.getAllBlocks(block.id, depth + 1)
            // 하위 블록들을 parent 정보와 함께 저장
            childBlocks.forEach(childBlock => {
              childBlock._parent = {
                id: block.id,
                type: block.type
              }
            })
            blocks.push(...childBlocks)
          }
        }
      }

      return blocks
    } catch (error) {
      console.error(`❌ 블록 조회 실패 (${blockId}, 깊이: ${depth}):`, error)
      return []
    }
  }

  /**
   * 블록 타입별 통계 생성
   */
  private generateBlockStats(blocks: any[]): Record<string, number> {
    const stats: Record<string, number> = {}
    
    for (const block of blocks) {
      if ('type' in block) {
        stats[block.type] = (stats[block.type] || 0) + 1
      }
    }

    return stats
  }



  /**
   * 텍스트와 링크 정보를 마크다운 형식으로 추출
   */
  private extractTextAndLinks(blockData: any): { text: string; links: string[]; markdown: string } {
    const result = { text: '', links: [] as string[], markdown: '' }

    // Method 1: rich_text 필드에서 추출 (링크 포함)
    if (this.hasRichText(blockData)) {
      const extracted = this.extractFromRichTextArray(blockData.rich_text)
      result.text = extracted.textParts.join('')
      result.markdown = extracted.markdownParts.join('')
      result.links.push(...extracted.links)
    }
    
    // Method 2: text 필드에서 추출 (callout 등)
    else if (this.hasText(blockData)) {
      const extracted = this.extractFromRichTextArray(blockData.text)
      result.text = extracted.textParts.join('')
      result.markdown = extracted.markdownParts.join('')
      result.links.push(...extracted.links)
    }
    
    // Method 3: title 필드에서 추출
    else if (this.hasTitle(blockData)) {
      const extracted = this.extractFromRichTextArray(blockData.title)
      result.text = extracted.textParts.join('')
      result.markdown = extracted.markdownParts.join('')
      result.links.push(...extracted.links)
    }
    
    // Method 4: bookmark 블록 처리
    else if (blockData.url) {
      const caption = blockData.caption ? 
        blockData.caption.map((item: any) => item.plain_text || '').join('') : ''
      result.text = caption || blockData.url
      result.links.push(blockData.url)
      result.markdown = caption ? `[${caption}](${blockData.url})` : blockData.url
    }
    
    // Method 5: child_page 블록 처리
    else if (blockData.title) {
      result.text = blockData.title
      result.markdown = blockData.title
      // child_page의 노션 URL 생성 (페이지 ID 기반)
      result.links = [] // 현재는 노션 URL 생성 비활성화 (필요시 활성화)
    }
    
    // Method 5.5: link_to_page 블록 처리
    else if (blockData.page_id || blockData.database_id) {
      // page_id나 database_id를 가진 링크 블록
      result.text = 'Link to page'
      result.markdown = result.text
      // 실제 페이지 제목을 얻으려면 추가 API 호출이 필요하지만 일단 기본값 사용
    }
    
    // Method 6: 기타 모든 블록 타입에 대한 범용 텍스트 추출
    else {
      const genericResult = this.extractTextFromGenericBlock(blockData)
      result.text = genericResult.text
      result.markdown = genericResult.markdown
      result.links.push(...genericResult.links)
    }

    return result
  }

  /**
   * 범용 블록에서 텍스트 추출 (heading_3, toggle, quote, code, table 등)
   */
  private extractTextFromGenericBlock(blockData: any): { text: string; links: string[]; markdown: string } {
    let result = { text: '', links: [] as string[], markdown: '' }

    // 가능한 텍스트 필드들을 순서대로 확인
    const textFields = ['rich_text', 'text', 'title', 'caption', 'plain_text']
    
    for (const field of textFields) {
      if (blockData[field]) {
        if (Array.isArray(blockData[field])) {
          // rich_text 배열 형태
          const extracted = this.extractFromRichTextArray(blockData[field])
          result.text = extracted.textParts.join('')
          result.markdown = extracted.markdownParts.join('')
          result.links.push(...extracted.links)
          break
        } else if (typeof blockData[field] === 'string') {
          // 단순 문자열
          result.text = blockData[field]
          result.markdown = blockData[field]
          break
        }
      }
    }

    // 특별 케이스: code 블록
    if (blockData.language && blockData.caption) {
      result.text = `Code (${blockData.language}): ${blockData.caption.map((c: any) => c.plain_text || '').join('')}`
      result.markdown = result.text
    }

    return result
  }

  /**
   * 블록들을 의미 단위로 그룹화하여 벡터 저장 단위 생성
   */
  private createSemanticChunks(blocks: any[]): Array<{
    type: string;
    markdown: string;
    vectorText: string;
    links: string[];
    blockIds: string[];
  }> {
    const chunks: Array<{
      type: string;
      markdown: string;
      vectorText: string;
      links: string[];
      blockIds: string[];
    }> = []

    let currentChunk: {
      type: string;
      markdown: string;
      vectorText: string;
      links: string[];
      blockIds: string[];
    } | null = null

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      const blockData = block[block.type] || {}
      const extracted = this.extractTextAndLinks(blockData)

      // 빈 블록은 경계로 사용 (현재 청크 마무리)
      if (!extracted.text && !extracted.markdown && extracted.links.length === 0) {
        if (currentChunk) {
          chunks.push(currentChunk)
          currentChunk = null
        }
        continue
      }

      // callout 블록이면 새로운 청크 시작
      if (block.type === 'callout') {
        // 이전 청크 마무리
        if (currentChunk) {
          chunks.push(currentChunk)
        }
        
        // 새 callout 청크 시작 (링크 정보 포함, 중복 방지)
        const calloutTextWithLinks = this.formatTextWithLinks(extracted.text, extracted.links, 'callout')
          
        currentChunk = {
          type: 'callout_section',
          markdown: extracted.markdown,
          vectorText: calloutTextWithLinks,
          links: [...extracted.links],
          blockIds: [block.id]
        }
        
        // 다음 블록들이 child_page라면 포함
        let nextIndex = i + 1
        const childPageTitles: string[] = []
        
        while (nextIndex < blocks.length && blocks[nextIndex].type === 'child_page') {
          const childBlock = blocks[nextIndex]
          const childExtracted = this.extractTextAndLinks(childBlock[childBlock.type] || {})
          
          if (childExtracted.text) {
            childPageTitles.push(childExtracted.text)
          }
          
          currentChunk.blockIds.push(childBlock.id)
          nextIndex++
        }
        
        // 하위 페이지 제목들을 콘텐칠에 추가
        if (childPageTitles.length > 0) {
          const childPagesText = `관련 페이지: ${childPageTitles.join(', ')}`
          currentChunk.markdown += `\n\n${childPagesText}`
          
          // vectorText에는 페이지 제목과 노션 링크 포함
          const childPagesWithLinks = childPageTitles.map((title, index) => {
            const childBlockId = blocks[i + 1 + index]?.id
            return childBlockId ? `${title} (${NotionBlockAnalyzer.NOTION_BASE_URL}/${childBlockId.replace(/-/g, '')})` : title
          }).join(', ')
          
          currentChunk.vectorText += `\n\n관련 페이지: ${childPagesWithLinks}`
        }
        
        i = nextIndex - 1 // 다음 반복에서 올바른 인덱스가 되도록
      }
      // paragraph와 bookmark은 연속된 콘텐츠로 처리
      else if (block.type === 'paragraph' || block.type === 'bookmark') {
        if (!currentChunk) {
          currentChunk = {
            type: 'content_section',
            markdown: '',
            vectorText: '',
            links: [],
            blockIds: []
          }
        }
        
        // 내용 추가 (링크 정보 포함)
        if (extracted.markdown) {
          currentChunk.markdown += (currentChunk.markdown ? '\n' : '') + extracted.markdown
          // vectorText에 링크 정보 포함 (중복 방지)
          const textWithLinks = this.formatTextWithLinks(extracted.text, extracted.links, block.type)
          
          currentChunk.vectorText += (currentChunk.vectorText ? '\n' : '') + textWithLinks
        }
        currentChunk.links.push(...extracted.links)
        currentChunk.blockIds.push(block.id)
        
        // paragraph와 bookmark은 단순히 연속된 콘텐츠로 처리 (특수 케이스 제거)
      }
      // 기타 블록들은 개별 청크로
      else {
        if (currentChunk && currentChunk.type !== 'mixed_content') {
          chunks.push(currentChunk)
          currentChunk = null
        }
        
        if (extracted.markdown || extracted.text) {
          // vectorText에 링크 정보 포함 (중복 방지)
          const textWithLinks = this.formatTextWithLinks(extracted.text, extracted.links, block.type)
            
          chunks.push({
            type: `${block.type}_block`,
            markdown: extracted.markdown,
            vectorText: textWithLinks,
            links: [...extracted.links],
            blockIds: [block.id]
          })
        }
      }
    }

    // 마지막 청크 처리
    if (currentChunk) {
      chunks.push(currentChunk)
    }

    return chunks.filter(chunk => chunk.markdown || chunk.vectorText || chunk.links.length > 0)
  }

  /**
   * callout 블록 특화 분석
   */
  private analyzeCalloutBlocks(blocks: any[]): void {
    const calloutBlocks = blocks.filter(block => block.type === 'callout')
    
    if (calloutBlocks.length === 0) {
      console.log(`⚠️  callout 블록을 찾을 수 없습니다.`)
      return
    }

    console.log(`\n🎯 CALLOUT 블록 특화 분석:`)
    console.log('=' .repeat(60))

    calloutBlocks.forEach((block, index) => {
      console.log(`\n📋 Callout #${index + 1}:`)
      
      const callout = block.callout
      if (callout) {
        console.log(`🎨 아이콘: ${callout.icon?.emoji || callout.icon?.type || 'none'}`)
        console.log(`🎨 색상: ${callout.color || 'default'}`)
        
        if (callout.rich_text && Array.isArray(callout.rich_text)) {
          console.log(`📝 텍스트 요소 개수: ${callout.rich_text.length}`)
          
          callout.rich_text.forEach((textItem: any, textIndex: number) => {
            console.log(`  📄 텍스트 #${textIndex + 1}:`)
            console.log(`    - 내용: "${textItem.plain_text || ''}"`)
            console.log(`    - 링크: ${textItem.href || 'none'}`)
            console.log(`    - 스타일: ${JSON.stringify(textItem.annotations || {})}`)
          })

          // 마크다운 형식으로 변환하여 표시
          const extracted = this.extractFromRichTextArray(callout.rich_text)
          console.log(`✨ 완성된 텍스트: "${extracted.textParts.join('')}"`)
          console.log(`🔗 마크다운 형식: "${extracted.markdownParts.join('')}"`)
          if (extracted.links.length > 0) {
            console.log(`🔗 추출된 링크: ${extracted.links.join(', ')}`)
          }
        }

        // 하위 블록들 확인
        const childBlocks = blocks.filter(childBlock => 
          childBlock._parent && childBlock._parent.id === block.id
        )
        
        if (childBlocks.length > 0) {
          console.log(`📎 하위 블록 (${childBlocks.length}개):`)
          childBlocks.forEach((childBlock, childIndex) => {
            const childData = childBlock[childBlock.type] || {}
            const childExtracted = this.extractTextAndLinks(childData)
            console.log(`  ${childIndex + 1}. ${childBlock.type}: "${childExtracted.text}"`)
            if (childExtracted.links.length > 0) {
              console.log(`     링크: ${childExtracted.links.join(', ')}`)
            }
          })
        }
      }
    })
  }

  /**
   * column_list와 column 블록 특화 분석
   */
  private async analyzeColumnBlocks(blocks: any[]): Promise<void> {
    const columnListBlocks = blocks.filter(block => block.type === 'column_list')
    const columnBlocks = blocks.filter(block => block.type === 'column')

    console.log(`\n📊 COLUMN 블록 특화 분석:`)
    console.log('=' .repeat(60))
    console.log(`📋 column_list 블록: ${columnListBlocks.length}개`)
    console.log(`📋 column 블록: ${columnBlocks.length}개`)

    // column_list 분석
    for (const [index, block] of columnListBlocks.entries()) {
      console.log(`\n🏛️ Column List #${index + 1} (ID: ${block.id}):`)
      console.log(JSON.stringify(block, null, 2))
      
      // 하위 column 블록들 조회
      if (block.has_children) {
        console.log(`\n  📋 하위 Column 블록들:`)
        const childBlocks = await this.getAllBlocks(block.id, 0)
        const childColumns = childBlocks.filter(child => child.type === 'column')
        
        for (const [childIndex, childColumn] of childColumns.entries()) {
          console.log(`\n    📐 Column #${childIndex + 1} (ID: ${childColumn.id}):`)
          
          // Column 내부의 실제 내용 블록들 조회
          if (childColumn.has_children) {
            const columnChildBlocks = await this.getAllBlocks(childColumn.id, 0)
            console.log(`    📝 Column 내용 (${columnChildBlocks.length}개 블록):`)
            
            // 의미 단위로 그룹화하여 출력
            const semanticChunks = this.createSemanticChunks(columnChildBlocks)
            
            console.log(`    🧩 의미 단위로 그룹화된 콘텐츠 (${semanticChunks.length}개 단위):`)
            
            semanticChunks.forEach((chunk, chunkIndex) => {
              console.log(`\n    📝 콘텐츠 단위 #${chunkIndex + 1}:`)
              console.log(`      종류: ${chunk.type}`)
              console.log(`      마크다운: "${chunk.markdown}"`)
              if (chunk.links.length > 0) {
                console.log(`      링크: ${chunk.links.join(', ')}`)
              }
              console.log(`      블록 ID들: ${chunk.blockIds.join(', ')}`)
              console.log(`      벡터 저장용 텍스트: "${chunk.vectorText}"`)
            })
          } else {
            console.log(`    ⚠️  Column에 하위 블록이 없습니다.`)
          }
        }
      }
    }

    // column 분석 (개별적으로 발견된 column들)
    for (const [index, block] of columnBlocks.entries()) {
      console.log(`\n📐 독립 Column #${index + 1} (ID: ${block.id}):`)
      console.log(JSON.stringify(block, null, 2))
      
      // Column 내부 내용 분석
      if (block.has_children) {
        const columnChildBlocks = await this.getAllBlocks(block.id, 0)
        console.log(`\n  📝 Column 내용 (${columnChildBlocks.length}개 블록):`)
        
        // 의미 단위로 그룹화하여 출력
        const semanticChunks = this.createSemanticChunks(columnChildBlocks)
        
        console.log(`  🧩 의미 단위로 그룹화된 콘텐츠 (${semanticChunks.length}개 단위):`)
        
        semanticChunks.forEach((chunk, chunkIndex) => {
          console.log(`\n  📝 콘텐츠 단위 #${chunkIndex + 1}:`)
          console.log(`    종류: ${chunk.type}`)
          console.log(`    마크다운: "${chunk.markdown}"`)
          if (chunk.links.length > 0) {
            console.log(`    링크: ${chunk.links.join(', ')}`)
          }
          console.log(`    블록 ID들: ${chunk.blockIds.join(', ')}`)
          console.log(`    벡터 저장용 텍스트: "${chunk.vectorText}"`)
        })
      }
    }
  }


  /**
   * 등록된 블록 타입별 분석기 실행
   */
  private async runRegisteredAnalyzers(allBlocks: any[]): Promise<void> {
    const stats = this.generateBlockStats(allBlocks)
    
    for (const [blockType, analyzer] of this.blockAnalyzers) {
      if (stats[blockType] && stats[blockType] > 0) {
        await analyzer(allBlocks)
      }
    }
  }

  /**
   * 메인 분석 실행
   */
  async analyze(): Promise<void> {
    try {
      console.log(`🚀 노션 페이지 블록 구조 분석 시작`)
      console.log(`📄 대상 페이지: ${TARGET_PAGE_ID}`)
      console.log('=' .repeat(80))

      // 노션 서비스 초기화
      await this.notionService.initialize()
      console.log(`✅ 노션 서비스 초기화 완료`)

      // 페이지 기본 정보 조회
      console.log(`\n📖 페이지 기본 정보 조회 중...`)
      const page = await this.client.pages.retrieve({ page_id: TARGET_PAGE_ID })
      console.log(`📋 페이지 제목: ${JSON.stringify(page, null, 2)}`)

      // 모든 블록 수집 (재귀적)
      console.log(`\n🔍 모든 블록 수집 중...`)
      const allBlocks = await this.getAllBlocks(TARGET_PAGE_ID)
      console.log(`✅ 총 ${allBlocks.length}개 블록 수집 완료`)

      // 블록 타입별 통계
      console.log(`\n📊 블록 타입별 통계:`)
      const stats = this.generateBlockStats(allBlocks)
      Object.entries(stats)
        .sort(([,a], [,b]) => b - a)
        .forEach(([type, count]) => {
          console.log(`  📦 ${type}: ${count}개`)
        })

      // 등록된 블록 타입별 특화 분석 실행
      await this.runRegisteredAnalyzers(allBlocks)

      console.log(`\n🎉 분석 완료!`)

    } catch (error) {
      console.error('❌ 분석 실패:', error)
      
      if (error instanceof Error) {
        console.error('상세 오류:', error.message)
        console.error('스택 트레이스:', error.stack)
      }
      
      process.exit(1)
    }
  }
}

// 스크립트 실행
async function main() {
  // 명령행 인수로 TARGET_PAGE_ID 받기
  const pageId = process.argv[2]
  if (pageId) {
    TARGET_PAGE_ID = pageId
    console.log(`📄 사용자 지정 페이지 ID: ${TARGET_PAGE_ID}`)
  } else {
    console.log(`📄 기본 페이지 ID 사용: ${TARGET_PAGE_ID}`)
  }
  
  const analyzer = new NotionBlockAnalyzer()
  await analyzer.analyze()
}

// 직접 실행 시에만 main 함수 호출
if (require.main === module) {
  main().catch(error => {
    console.error('스크립트 실행 실패:', error)
    process.exit(1)
  })
}

export { NotionBlockAnalyzer }