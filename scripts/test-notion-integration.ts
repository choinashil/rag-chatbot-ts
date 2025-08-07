#!/usr/bin/env tsx
// Notion API 실제 연동 테스트 스크립트
import dotenv from 'dotenv'
import { NotionService } from '../src/services/notion/notion.service'
import { createNotionConfig } from '../src/config/notion'

// 환경변수 로드
dotenv.config({ path: 'env/.env.dev' })

async function testNotionIntegration() {
  console.log('🔍 Notion API 연동 테스트 시작...\n')

  try {
    // 1. 설정 확인
    console.log('1. 환경변수 확인:')
    const hasToken = !!process.env.NOTION_INTEGRATION_TOKEN
    const hasDatabase = !!process.env.NOTION_DATABASE_ID
    
    console.log(`   ✅ NOTION_INTEGRATION_TOKEN: ${hasToken ? '설정됨' : '❌ 없음'}`)
    console.log(`   ✅ NOTION_DATABASE_ID: ${hasDatabase ? '설정됨' : '❌ 없음'}`)
    
    if (!hasToken || !hasDatabase) {
      console.log('\n❌ 필수 환경변수가 설정되지 않았습니다.')
      console.log('다음 환경변수를 .env 파일에 추가해주세요:')
      console.log('NOTION_INTEGRATION_TOKEN=your_integration_token')
      console.log('NOTION_DATABASE_ID=your_database_id')
      return
    }

    // 2. NotionService 초기화
    console.log('\n2. NotionService 초기화...')
    const config = createNotionConfig()
    const notionService = new NotionService(config)
    
    await notionService.initialize()
    console.log('   ✅ 초기화 성공!')

    // 3. 상태 확인
    console.log('\n3. 연결 상태 확인:')
    const status = notionService.getStatus()
    console.log(`   연결 상태: ${status.connected ? '✅ 연결됨' : '❌ 연결 안됨'}`)
    console.log(`   마지막 확인: ${status.lastCheck}`)
    console.log(`   데이터베이스 ID: ${status.metadata?.databaseId}`)

    // 4. 페이지 목록 조회 (최대 5개)
    console.log('\n4. 페이지 목록 조회 (최대 5개):')
    const pages = await notionService.getPages()
    
    if (pages.length === 0) {
      console.log('   📭 데이터베이스에 페이지가 없습니다.')
    } else {
      console.log(`   📚 총 ${pages.length}개 페이지 발견:`)
      
      const displayPages = pages.slice(0, 5) // 최대 5개만 표시
      displayPages.forEach((page, index) => {
        console.log(`   ${index + 1}. "${page.title}"`)
        console.log(`      ID: ${page.id}`)
        console.log(`      URL: ${page.url}`)
        console.log(`      생성일: ${new Date(page.createdAt).toLocaleDateString()}`)
        console.log(`      수정일: ${new Date(page.updatedAt).toLocaleDateString()}\n`)
      })

      if (pages.length > 5) {
        console.log(`   ... 그 외 ${pages.length - 5}개 페이지`)
      }
    }

    // 5. 첫 번째 페이지 상세 조회 (있는 경우)
    if (pages.length > 0) {
      console.log('\n5. 첫 번째 페이지 상세 조회:')
      const firstPage = pages[0]
      console.log(`   "${firstPage.title}" 상세 내용 조회 중...`)
      
      const pageDetail = await notionService.getPage(firstPage.id)
      console.log(`   제목: ${pageDetail.title}`)
      console.log(`   내용 길이: ${pageDetail.content.length} 문자`)
      
      if (pageDetail.content.length > 0) {
        // 내용 미리보기 (처음 200자)
        const preview = pageDetail.content.substring(0, 200)
        console.log(`   내용 미리보기:\n   ${preview}${pageDetail.content.length > 200 ? '...' : ''}`)
      } else {
        console.log('   📝 페이지 내용이 비어있습니다.')
      }
    }

    console.log('\n🎉 Notion API 연동 테스트 완료!')
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('API 연결 실패')) {
        console.log('\n💡 해결 방법:')
        console.log('1. Notion Integration Token이 올바른지 확인')
        console.log('2. Integration이 해당 데이터베이스에 접근 권한이 있는지 확인')
      } else if (error.message.includes('조회할 수 없습니다')) {
        console.log('\n💡 해결 방법:')
        console.log('1. Database ID가 올바른지 확인')
        console.log('2. Database가 Integration에 공유되었는지 확인')
      }
    }
  }
}

// 스크립트 실행
testNotionIntegration().catch(console.error)