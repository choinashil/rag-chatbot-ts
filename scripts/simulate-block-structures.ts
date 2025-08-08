#!/usr/bin/env npx tsx

/**
 * 노션 블록 구조 시뮬레이션 및 텍스트 추출 방법 테스트
 * 
 * 실제 노션 API 문서와 커뮤니티 예시를 바탕으로 
 * callout, column_list, column 블록의 구조를 시뮬레이션하고
 * 텍스트 추출 방법을 테스트합니다.
 */

// 실제 노션 API에서 반환되는 callout 블록 구조 (시뮬레이션)
const SAMPLE_CALLOUT_BLOCK = {
  "object": "block",
  "id": "sample-callout-id-123",
  "parent": {
    "type": "page_id",
    "page_id": "sample-page-id"
  },
  "created_time": "2025-08-08T00:00:00.000Z",
  "last_edited_time": "2025-08-08T00:00:00.000Z",
  "created_by": { "object": "user", "id": "user-id" },
  "last_edited_by": { "object": "user", "id": "user-id" },
  "has_children": false,
  "archived": false,
  "in_trash": false,
  "type": "callout",
  "callout": {
    "rich_text": [
      {
        "type": "text",
        "text": {
          "content": "이것은 중요한 정보입니다. ",
          "link": null
        },
        "annotations": {
          "bold": true,
          "italic": false,
          "strikethrough": false,
          "underline": false,
          "code": false,
          "color": "default"
        },
        "plain_text": "이것은 중요한 정보입니다. ",
        "href": null
      },
      {
        "type": "text",
        "text": {
          "content": "여기를 클릭하세요",
          "link": {
            "url": "https://example.com"
          }
        },
        "annotations": {
          "bold": false,
          "italic": false,
          "strikethrough": false,
          "underline": true,
          "code": false,
          "color": "blue"
        },
        "plain_text": "여기를 클릭하세요",
        "href": "https://example.com"
      }
    ],
    "icon": {
      "type": "emoji",
      "emoji": "💡"
    },
    "color": "yellow_background"
  }
}

// 실제 노션 API에서 반환되는 column_list 블록 구조 (시뮬레이션)
const SAMPLE_COLUMN_LIST_BLOCK = {
  "object": "block",
  "id": "sample-column-list-id-123",
  "parent": {
    "type": "page_id",
    "page_id": "sample-page-id"
  },
  "created_time": "2025-08-08T00:00:00.000Z",
  "last_edited_time": "2025-08-08T00:00:00.000Z",
  "created_by": { "object": "user", "id": "user-id" },
  "last_edited_by": { "object": "user", "id": "user-id" },
  "has_children": true,
  "archived": false,
  "in_trash": false,
  "type": "column_list",
  "column_list": {}  // column_list 자체는 빈 객체, 실제 내용은 하위 column 블록들에 있음
}

// 실제 노션 API에서 반환되는 column 블록 구조 (시뮬레이션)
const SAMPLE_COLUMN_BLOCKS = [
  {
    "object": "block",
    "id": "sample-column-1-id-123",
    "parent": {
      "type": "block_id",
      "block_id": "sample-column-list-id-123"
    },
    "created_time": "2025-08-08T00:00:00.000Z",
    "last_edited_time": "2025-08-08T00:00:00.000Z",
    "created_by": { "object": "user", "id": "user-id" },
    "last_edited_by": { "object": "user", "id": "user-id" },
    "has_children": true,
    "archived": false,
    "in_trash": false,
    "type": "column",
    "column": {}  // column 자체도 빈 객체, 실제 내용은 하위 블록들에 있음
  },
  {
    "object": "block",
    "id": "sample-column-2-id-123",
    "parent": {
      "type": "block_id",
      "block_id": "sample-column-list-id-123"
    },
    "created_time": "2025-08-08T00:00:00.000Z",
    "last_edited_time": "2025-08-08T00:00:00.000Z",
    "created_by": { "object": "user", "id": "user-id" },
    "last_edited_by": { "object": "user", "id": "user-id" },
    "has_children": true,
    "archived": false,
    "in_trash": false,
    "type": "column",
    "column": {}
  }
]

// column 블록 내부의 실제 내용 블록들 (시뮬레이션)
const SAMPLE_COLUMN_CHILDREN = {
  "sample-column-1-id-123": [
    {
      "object": "block",
      "id": "column1-content1-id",
      "type": "heading_2",
      "heading_2": {
        "rich_text": [
          {
            "type": "text",
            "text": { "content": "왼쪽 컬럼 제목", "link": null },
            "annotations": { "bold": true, "italic": false, "strikethrough": false, "underline": false, "code": false, "color": "default" },
            "plain_text": "왼쪽 컬럼 제목",
            "href": null
          }
        ],
        "color": "default"
      },
      "has_children": false
    },
    {
      "object": "block",
      "id": "column1-content2-id",
      "type": "paragraph",
      "paragraph": {
        "rich_text": [
          {
            "type": "text",
            "text": { "content": "왼쪽 컬럼의 내용입니다.", "link": null },
            "annotations": { "bold": false, "italic": false, "strikethrough": false, "underline": false, "code": false, "color": "default" },
            "plain_text": "왼쪽 컬럼의 내용입니다.",
            "href": null
          }
        ],
        "color": "default"
      },
      "has_children": false
    }
  ],
  "sample-column-2-id-123": [
    {
      "object": "block",
      "id": "column2-content1-id",
      "type": "heading_2",
      "heading_2": {
        "rich_text": [
          {
            "type": "text",
            "text": { "content": "오른쪽 컬럼 제목", "link": null },
            "annotations": { "bold": true, "italic": false, "strikethrough": false, "underline": false, "code": false, "color": "default" },
            "plain_text": "오른쪽 컬럼 제목",
            "href": null
          }
        ],
        "color": "default"
      },
      "has_children": false
    },
    {
      "object": "block",
      "id": "column2-content2-id",
      "type": "bulleted_list_item",
      "bulleted_list_item": {
        "rich_text": [
          {
            "type": "text",
            "text": { "content": "오른쪽 컬럼의 첫 번째 항목", "link": null },
            "annotations": { "bold": false, "italic": false, "strikethrough": false, "underline": false, "code": false, "color": "default" },
            "plain_text": "오른쪽 컬럼의 첫 번째 항목",
            "href": null
          }
        ],
        "color": "default"
      },
      "has_children": false
    }
  ]
}

class BlockStructureAnalyzer {
  /**
   * callout 블록에서 텍스트 추출
   */
  extractTextFromCallout(block: any): { text: string; icon: string; color: string; links: Array<{text: string, url: string}> } {
    if (block.type !== 'callout' || !block.callout) {
      throw new Error('callout 블록이 아닙니다')
    }

    const callout = block.callout
    const links: Array<{text: string, url: string}> = []
    
    // rich_text에서 텍스트와 링크 추출
    let text = ''
    if (callout.rich_text && Array.isArray(callout.rich_text)) {
      text = callout.rich_text
        .map((item: any) => {
          const plainText = item.plain_text || ''
          
          // 링크 정보 수집
          if (item.href) {
            links.push({
              text: plainText,
              url: item.href
            })
          }
          
          return plainText
        })
        .join('')
    }

    // 아이콘 정보 추출
    let icon = ''
    if (callout.icon) {
      if (callout.icon.type === 'emoji') {
        icon = callout.icon.emoji
      } else if (callout.icon.type === 'external') {
        icon = callout.icon.external.url
      } else if (callout.icon.type === 'file') {
        icon = callout.icon.file.url
      }
    }

    return {
      text: text.trim(),
      icon,
      color: callout.color || 'default',
      links
    }
  }

  /**
   * column_list와 column 블록에서 텍스트 추출 (시뮬레이션)
   * 실제로는 has_children이 true인 경우 API를 호출해서 하위 블록들을 가져와야 함
   */
  extractTextFromColumns(columnListBlock: any, columnBlocks: any[], columnChildren: any): Array<{columnIndex: number, content: string}> {
    if (columnListBlock.type !== 'column_list') {
      throw new Error('column_list 블록이 아닙니다')
    }

    const results: Array<{columnIndex: number, content: string}> = []

    columnBlocks.forEach((columnBlock, index) => {
      if (columnBlock.type !== 'column') {
        return
      }

      // 실제로는 이 부분에서 API 호출이 필요
      // const children = await client.blocks.children.list({ block_id: columnBlock.id })
      const children = columnChildren[columnBlock.id] || []

      const columnTexts: string[] = []

      children.forEach((childBlock: any) => {
        const extractedText = this.extractTextFromGenericBlock(childBlock)
        if (extractedText.trim()) {
          columnTexts.push(extractedText)
        }
      })

      results.push({
        columnIndex: index,
        content: columnTexts.join('\n')
      })
    })

    return results
  }

  /**
   * 일반적인 블록에서 텍스트 추출
   */
  extractTextFromGenericBlock(block: any): string {
    if (!block.type || !block[block.type]) {
      return ''
    }

    const blockData = block[block.type]

    // rich_text 필드가 있는 경우
    if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
      return blockData.rich_text
        .map((item: any) => item.plain_text || '')
        .join('')
    }

    return ''
  }

  /**
   * 개선된 NotionMapper 블록 처리 방법 제안
   */
  generateImprovedMapper(): string {
    return `
// 개선된 NotionMapper의 blocksToMarkdown 메서드

static blocksToMarkdown(blocks: any[]): string {
  const markdown: string[] = []
  
  console.log(\`블록 변환: \${blocks.length}개 블록 처리\`)
  
  for (const block of blocks) {
    if (!block.type) {
      console.log('블록 타입이 없는 블록 건너뜀:', block.id || 'unknown')
      continue
    }

    // 이미지/동영상/파일 블록 제외
    if (this.isMediaBlock(block.type)) {
      console.log(\`미디어 블록 건너뜀: \${block.type}\`)
      continue
    }

    const extractedText = this.extractTextFromBlock(block)
    if (extractedText.trim()) {
      markdown.push(extractedText)
    }
  }
  
  const result = markdown.join('\\n\\n')
  console.log(\`텍스트 추출 완료: \${result.length}자 (\${markdown.length}개 블록)\`)
  
  return result
}

// 새로운 통합된 텍스트 추출 메서드
static extractTextFromBlock(block: any): string {
  if (!block.type) return ''

  switch (block.type) {
    // 기존 블록들
    case 'paragraph':
      return this.extractRichText(block.paragraph?.rich_text || [])
    
    case 'heading_1':
      const h1Text = this.extractRichText(block.heading_1?.rich_text || [])
      return h1Text ? \`# \${h1Text}\` : ''
    
    case 'heading_2':
      const h2Text = this.extractRichText(block.heading_2?.rich_text || [])
      return h2Text ? \`## \${h2Text}\` : ''
    
    case 'heading_3':
      const h3Text = this.extractRichText(block.heading_3?.rich_text || [])
      return h3Text ? \`### \${h3Text}\` : ''
    
    case 'bulleted_list_item':
      const bulletText = this.extractRichText(block.bulleted_list_item?.rich_text || [])
      return bulletText ? \`- \${bulletText}\` : ''
    
    case 'numbered_list_item':
      const numberedText = this.extractRichText(block.numbered_list_item?.rich_text || [])
      return numberedText ? \`1. \${numberedText}\` : ''
    
    // 새로운 callout 블록 처리
    case 'callout':
      const calloutText = this.extractRichText(block.callout?.rich_text || [])
      const icon = block.callout?.icon?.emoji || ''
      const color = block.callout?.color || 'default'
      
      if (calloutText.trim()) {
        // 마크다운에서 callout 형태로 표현
        return \`> \${icon} **[\${color}]** \${calloutText}\`
      }
      return ''
    
    // column_list는 자체적으로 텍스트가 없으므로 빈 문자열 반환
    // 하위 column 블록들은 별도 처리됨
    case 'column_list':
      return '' // column_list 자체는 컨테이너 역할만 함
    
    // column 블록도 자체적으로 텍스트가 없음
    // has_children이 true인 경우 하위 블록들을 재귀적으로 처리해야 함
    case 'column':
      return '' // column 자체는 컨테이너 역할만 함
    
    case 'quote':
      const quoteText = this.extractRichText(block.quote?.rich_text || [])
      return quoteText ? \`> \${quoteText}\` : ''
    
    case 'code':
      const codeText = this.extractRichText(block.code?.rich_text || [])
      const language = block.code?.language || ''
      return codeText ? \`\\\`\\\`\\\`\${language}\\n\${codeText}\\n\\\`\\\`\\\`\` : ''
    
    default:
      console.log(\`지원하지 않는 블록 타입: \${block.type}\`)
      
      // 일반적인 rich_text 필드 확인
      if (block[block.type]?.rich_text) {
        const text = this.extractRichText(block[block.type].rich_text)
        if (text.trim()) {
          console.log(\`지원하지 않는 블록에서 텍스트 추출 성공: \${block.type}\`)
          return text
        }
      }
      return ''
  }
}

// has_children이 true인 블록들을 처리하기 위한 새로운 메서드
static async processBlocksWithChildren(
  blocks: any[], 
  client: Client, 
  processedBlockIds: Set<string> = new Set()
): Promise<string> {
  const allTexts: string[] = []

  for (const block of blocks) {
    if (!block.type || processedBlockIds.has(block.id)) continue
    
    processedBlockIds.add(block.id)

    // 1. 현재 블록에서 직접 텍스트 추출
    const directText = this.extractTextFromBlock(block)
    if (directText.trim()) {
      allTexts.push(directText)
    }

    // 2. has_children이 true인 경우 하위 블록들 처리
    if (block.has_children) {
      try {
        const childResponse = await client.blocks.children.list({
          block_id: block.id,
          page_size: 100
        })

        // 특별한 처리가 필요한 블록 타입들
        if (block.type === 'column_list') {
          const columnTexts = await this.processColumnList(childResponse.results, client)
          allTexts.push(...columnTexts)
        } else {
          // 일반적인 하위 블록들 재귀 처리
          const childTexts = await this.processBlocksWithChildren(
            childResponse.results, 
            client, 
            processedBlockIds
          )
          if (childTexts.trim()) {
            allTexts.push(childTexts)
          }
        }
      } catch (error) {
        console.warn(\`하위 블록 조회 실패: \${block.id}\`, error)
      }
    }
  }

  return allTexts.join('\\n\\n')
}

// column_list 특별 처리
static async processColumnList(columnBlocks: any[], client: Client): Promise<string[]> {
  const columnTexts: string[] = []

  for (let i = 0; i < columnBlocks.length; i++) {
    const columnBlock = columnBlocks[i]
    
    if (columnBlock.type === 'column' && columnBlock.has_children) {
      try {
        const columnContent = await client.blocks.children.list({
          block_id: columnBlock.id,
          page_size: 100
        })

        const columnText = await this.processBlocksWithChildren(columnContent.results, client)
        if (columnText.trim()) {
          columnTexts.push(\`**[컬럼 \${i + 1}]**\\n\${columnText}\`)
        }
      } catch (error) {
        console.warn(\`컬럼 블록 조회 실패: \${columnBlock.id}\`, error)
      }
    }
  }

  return columnTexts
}
    `
  }

  /**
   * 메인 분석 실행
   */
  analyze(): void {
    console.log('🚀 노션 블록 구조 시뮬레이션 및 분석')
    console.log('=' .repeat(80))

    // 1. Callout 블록 분석
    console.log('\n🎯 CALLOUT 블록 분석:')
    console.log('=' .repeat(60))
    console.log('📋 샘플 callout 블록 JSON:')
    console.log(JSON.stringify(SAMPLE_CALLOUT_BLOCK, null, 2))
    
    try {
      const calloutResult = this.extractTextFromCallout(SAMPLE_CALLOUT_BLOCK)
      console.log('\n✅ 추출 결과:')
      console.log(`📝 텍스트: "${calloutResult.text}"`)
      console.log(`🎨 아이콘: ${calloutResult.icon}`)
      console.log(`🎨 색상: ${calloutResult.color}`)
      console.log(`🔗 링크 수: ${calloutResult.links.length}`)
      if (calloutResult.links.length > 0) {
        calloutResult.links.forEach((link, index) => {
          console.log(`  링크 ${index + 1}: "${link.text}" -> ${link.url}`)
        })
      }
    } catch (error) {
      console.error('❌ callout 블록 처리 실패:', error)
    }

    // 2. Column 블록들 분석
    console.log('\n📊 COLUMN 블록 분석:')
    console.log('=' .repeat(60))
    console.log('📋 샘플 column_list 블록 JSON:')
    console.log(JSON.stringify(SAMPLE_COLUMN_LIST_BLOCK, null, 2))
    
    console.log('\n📋 샘플 column 블록들 JSON:')
    SAMPLE_COLUMN_BLOCKS.forEach((block, index) => {
      console.log(`\n컬럼 ${index + 1}:`)
      console.log(JSON.stringify(block, null, 2))
    })

    console.log('\n📋 컬럼 내부 내용 블록들:')
    Object.entries(SAMPLE_COLUMN_CHILDREN).forEach(([columnId, children], index) => {
      console.log(`\n컬럼 ${index + 1} 내용 (${columnId}):`)
      children.forEach((child: any, childIndex: number) => {
        console.log(`  내용 블록 ${childIndex + 1}:`)
        console.log(JSON.stringify(child, null, 2))
      })
    })

    try {
      const columnResults = this.extractTextFromColumns(
        SAMPLE_COLUMN_LIST_BLOCK, 
        SAMPLE_COLUMN_BLOCKS, 
        SAMPLE_COLUMN_CHILDREN
      )
      
      console.log('\n✅ 컬럼 추출 결과:')
      columnResults.forEach((result) => {
        console.log(`📐 컬럼 ${result.columnIndex + 1}:`)
        console.log(result.content)
        console.log()
      })
    } catch (error) {
      console.error('❌ column 블록 처리 실패:', error)
    }

    // 3. 개선된 NotionMapper 코드 제안
    console.log('\n💡 개선된 NotionMapper 코드 제안:')
    console.log('=' .repeat(60))
    console.log(this.generateImprovedMapper())

    // 4. 주요 포인트 요약
    console.log('\n📝 주요 분석 결과 요약:')
    console.log('=' .repeat(60))
    console.log(`
🎯 Callout 블록:
  - 구조: block.callout.rich_text[]에 텍스트 데이터
  - 아이콘: block.callout.icon.emoji (emoji 타입인 경우)
  - 색상: block.callout.color
  - 링크: rich_text 배열의 각 항목에서 href 필드로 확인
  - 텍스트 추출: rich_text 배열을 순회하며 plain_text 결합

📊 Column_List 블록:
  - 구조: block.column_list는 빈 객체 (컨테이너 역할만)
  - has_children: true (하위에 column 블록들 존재)
  - 처리 방법: 하위 블록들을 API로 조회 필요

📐 Column 블록:
  - 구조: block.column도 빈 객체 (컨테이너 역할만)
  - has_children: true (실제 내용 블록들이 하위에 존재)
  - 처리 방법: 각 column의 하위 블록들을 재귀적으로 처리

🔄 처리 전략:
  1. 직접 텍스트가 있는 블록: 즉시 추출
  2. has_children이 true인 블록: API 호출로 하위 블록 조회 후 재귀 처리
  3. column_list: 특별히 컬럼별로 구분해서 마크다운에 표현
  4. 무한 재귀 방지: 이미 처리된 블록 ID 추적

💡 성능 고려사항:
  - has_children이 true인 블록마다 추가 API 호출 필요
  - 깊은 중첩 구조에서는 많은 API 호출 발생 가능
  - 병렬 처리나 배치 요청을 고려할 필요
`)

    console.log('\n🎉 시뮬레이션 완료!')
  }
}

// 스크립트 실행
async function main() {
  const analyzer = new BlockStructureAnalyzer()
  analyzer.analyze()
}

// 직접 실행 시에만 main 함수 호출
if (require.main === module) {
  main().catch(error => {
    console.error('스크립트 실행 실패:', error)
    process.exit(1)
  })
}

export { BlockStructureAnalyzer }