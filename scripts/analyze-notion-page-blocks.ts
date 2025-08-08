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
import { NotionService } from '../src/services/notion/notion.service'
import type { NotionConfig } from '../src/types/notion'
import { Client } from '@notionhq/client'

// 환경변수 로드
config({ path: resolve(__dirname, '../env/.env.dev') })

const TARGET_PAGE_ID = process.env.NOTION_PAGE_ID || 'e7b780d5b6554f4e8bc957dcfcebfab3'

class NotionBlockAnalyzer {
  private notionService: NotionService
  private client: Client

  constructor() {
    const notionConfig: NotionConfig = {
      integrationToken: process.env.NOTION_INTEGRATION_TOKEN!,
      databaseId: process.env.NOTION_DATABASE_ID!,
      timeout: parseInt(process.env.NOTION_TIMEOUT || '30000')
    }

    this.notionService = new NotionService(notionConfig)
    this.client = new Client({ auth: notionConfig.integrationToken })
  }

  /**
   * 페이지의 모든 블록을 재귀적으로 수집
   */
  private async getAllBlocks(blockId: string, depth: number = 0): Promise<any[]> {
    const maxDepth = 5 // 무한 재귀 방지
    if (depth > maxDepth) {
      console.log(`⚠️  최대 깊이(${maxDepth}) 도달, 블록 ${blockId} 건너뜀`)
      return []
    }

    try {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
        page_size: 100
      })

      const blocks = []
      const indent = '  '.repeat(depth)

      for (const block of response.results) {
        if ('type' in block) {
          console.log(`${indent}📦 블록 발견: ${block.type} (${block.id})`)
          blocks.push(block)

          // 하위 블록이 있는 경우 재귀적으로 수집
          if (block.has_children) {
            console.log(`${indent}  └─ 하위 블록 탐색 중...`)
            const childBlocks = await this.getAllBlocks(block.id, depth + 1)
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
   * 특정 블록 타입의 상세 구조 분석
   */
  private analyzeBlockStructure(blocks: any[], blockType: string): void {
    const targetBlocks = blocks.filter(block => block.type === blockType)
    
    if (targetBlocks.length === 0) {
      console.log(`⚠️  ${blockType} 블록을 찾을 수 없습니다.`)
      return
    }

    console.log(`\n🔍 ${blockType.toUpperCase()} 블록 상세 분석 (${targetBlocks.length}개):`)
    console.log('=' .repeat(60))

    targetBlocks.forEach((block, index) => {
      console.log(`\n📋 ${blockType} 블록 #${index + 1} (ID: ${block.id}):`)
      console.log(JSON.stringify(block, null, 2))
      
      // 텍스트 추출 시도
      const extractedText = this.extractTextFromBlock(block)
      if (extractedText) {
        console.log(`📝 추출된 텍스트: "${extractedText}"`)
      } else {
        console.log(`⚠️  텍스트 추출 실패`)
      }
    })
  }

  /**
   * 블록에서 텍스트 추출 시도 (다양한 방법으로)
   */
  private extractTextFromBlock(block: any): string | null {
    if (!block.type || !block[block.type]) {
      return null
    }

    const blockData = block[block.type]

    // Method 1: rich_text 필드에서 추출
    if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
      const text = blockData.rich_text
        .map((item: any) => item.plain_text || '')
        .join('')
      if (text.trim()) return text
    }

    // Method 2: text 필드에서 추출 (callout 등)
    if (blockData.text && Array.isArray(blockData.text)) {
      const text = blockData.text
        .map((item: any) => item.plain_text || '')
        .join('')
      if (text.trim()) return text
    }

    // Method 3: title 필드에서 추출
    if (blockData.title && Array.isArray(blockData.title)) {
      const text = blockData.title
        .map((item: any) => item.plain_text || '')
        .join('')
      if (text.trim()) return text
    }

    // Method 4: children의 텍스트 추출 (column_list 등)
    if (blockData.children && Array.isArray(blockData.children)) {
      const childTexts = blockData.children
        .map((child: any) => this.extractTextFromBlock(child))
        .filter(Boolean)
      if (childTexts.length > 0) return childTexts.join(' | ')
    }

    return null
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

          const fullText = callout.rich_text
            .map((item: any) => item.plain_text || '')
            .join('')
          console.log(`✨ 완성된 텍스트: "${fullText}"`)
        }
      }
    })
  }

  /**
   * column_list와 column 블록 특화 분석
   */
  private analyzeColumnBlocks(blocks: any[]): void {
    const columnListBlocks = blocks.filter(block => block.type === 'column_list')
    const columnBlocks = blocks.filter(block => block.type === 'column')

    console.log(`\n📊 COLUMN 블록 특화 분석:`)
    console.log('=' .repeat(60))
    console.log(`📋 column_list 블록: ${columnListBlocks.length}개`)
    console.log(`📋 column 블록: ${columnBlocks.length}개`)

    // column_list 분석
    columnListBlocks.forEach((block, index) => {
      console.log(`\n🏛️ Column List #${index + 1} (ID: ${block.id}):`)
      console.log(JSON.stringify(block, null, 2))
    })

    // column 분석
    columnBlocks.forEach((block, index) => {
      console.log(`\n📐 Column #${index + 1} (ID: ${block.id}):`)
      console.log(JSON.stringify(block, null, 2))
    })
  }

  /**
   * 텍스트 추출 방법 제안
   */
  private suggestTextExtractionMethods(blocks: any[]): void {
    console.log(`\n💡 텍스트 추출 방법 제안:`)
    console.log('=' .repeat(60))

    const blockTypes = [...new Set(blocks.map(block => block.type))].sort()

    console.log(`\n🔧 발견된 블록 타입들:`)
    blockTypes.forEach(type => {
      const count = blocks.filter(block => block.type === type).length
      console.log(`  - ${type}: ${count}개`)
    })

    console.log(`\n📝 권장 텍스트 추출 로직:`)
    
    console.log(`
🎯 1. Callout 블록:
   - 경로: block.callout.rich_text[].plain_text
   - 아이콘: block.callout.icon.emoji
   - 색상: block.callout.color
   - 예시: const text = block.callout.rich_text.map(item => item.plain_text).join('')

📊 2. Column_List 블록:
   - column_list는 컨테이너 역할만 수행
   - 실제 내용은 하위 column 블록들에 있음
   - has_children이 true이면 하위 블록 조회 필요

📐 3. Column 블록:
   - 직접적인 텍스트 없음, has_children이 true
   - 하위 블록들(paragraph, heading 등)에서 텍스트 추출
   - 재귀적으로 하위 블록 탐색 필요

🔄 4. 일반적인 접근법:
   function extractTextFromBlock(block) {
     const blockData = block[block.type]
     
     // 1. rich_text 필드 확인
     if (blockData?.rich_text) {
       return blockData.rich_text.map(item => item.plain_text).join('')
     }
     
     // 2. 하위 블록이 있으면 재귀 탐색
     if (block.has_children) {
       return extractFromChildren(block.id)
     }
     
     return ''
   }
`)
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

      // callout 블록 상세 분석
      this.analyzeCalloutBlocks(allBlocks)

      // column 블록 상세 분석  
      this.analyzeColumnBlocks(allBlocks)

      // 기타 관심 블록들 분석
      const interestingTypes = ['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item']
      interestingTypes.forEach(type => {
        if (stats[type] > 0) {
          this.analyzeBlockStructure(allBlocks, type)
        }
      })

      // 텍스트 추출 방법 제안
      this.suggestTextExtractionMethods(allBlocks)

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