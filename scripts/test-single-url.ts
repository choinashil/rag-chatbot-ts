/**
 * 단일 URL 토글 크롤링 테스트
 * 사용법: npx tsx scripts/test-single-url.ts <URL>
 */

import { HtmlService } from '../src/services/html/html.service'

async function testSingleUrl(url: string): Promise<void> {
  console.log(`🔍 URL 테스트: ${url}`)
  
  const htmlService = new HtmlService()
  
  try {
    const result = await htmlService.parseUrl(url)
    
    console.log(`\n📊 결과:`)
    console.log(`  제목: ${result.title}`)
    console.log(`  콘텐츠 길이: ${result.content.length}자`)
    console.log(`  Breadcrumb: ${result.breadcrumb.join(' > ')}`)
    console.log(`\n📝 콘텐츠 미리보기:`)
    console.log(`${result.content}`)
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error)
  } finally {
    await htmlService.closeBrowser()
  }
}

// 명령행 인수에서 URL 가져오기
const url = process.argv[2]
if (!url) {
  console.log('사용법: npx tsx scripts/test-single-url.ts <URL>')
  console.log('예시: npx tsx scripts/test-single-url.ts https://help.pro.sixshop.com/design/header-footer')
  process.exit(1)
}

testSingleUrl(url)