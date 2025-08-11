/**
 * 정적 vs 동적 크롤링 성능 및 결과 비교
 */

import { HtmlService } from '../src/services/html/html.service'

async function compareCrawlingMethods(url: string): Promise<void> {
  console.log(`🔍 크롤링 방법 비교 테스트: ${url}\n`)
  
  const htmlService = new HtmlService()
  
  try {
    // 1. 새로운 하이브리드 방식 (parseUrl)
    console.log('🚀 하이브리드 크롤링 (parseUrl) 테스트...')
    const startHybrid = Date.now()
    const hybridResult = await htmlService.parseUrl(url)
    const hybridTime = Date.now() - startHybrid
    
    // 2. 기존 정적 방식 (extractFromUrl) 
    console.log('\n⚡ 정적 크롤링 (extractFromUrl) 테스트...')
    const startStatic = Date.now()
    const staticResult = await htmlService.extractFromUrl(url)
    const staticTime = Date.now() - startStatic
    
    // 3. 결과 비교
    console.log('\n📊 결과 비교:')
    console.log('┌─────────────────┬──────────────┬──────────────┐')
    console.log('│     방식        │   하이브리드  │    정적      │')
    console.log('├─────────────────┼──────────────┼──────────────┤')
    console.log(`│ 처리 시간       │ ${hybridTime.toString().padStart(8)}ms │ ${staticTime.toString().padStart(8)}ms │`)
    console.log(`│ 콘텐츠 길이     │ ${hybridResult.content.length.toString().padStart(8)}자 │ ${staticResult.content.length.toString().padStart(8)}자 │`)
    console.log(`│ 성능 차이       │ ${hybridTime > staticTime ? `+${hybridTime - staticTime}ms` : `-${staticTime - hybridTime}ms`} │              │`)
    console.log(`│ 콘텐츠 증가     │ ${hybridResult.content.length > staticResult.content.length ? `+${hybridResult.content.length - staticResult.content.length}자` : '변화없음'} │              │`)
    console.log('└─────────────────┴──────────────┴──────────────┘')
    
    // 4. 콘텐츠 샘플 비교
    console.log('\n📝 콘텐츠 샘플 비교:')
    console.log('\n🚀 하이브리드 결과:')
    console.log(`"${hybridResult.content.substring(0, 200)}..."`)
    console.log('\n⚡ 정적 결과:')
    console.log(`"${staticResult.content.substring(0, 200)}..."`)
    
    // 5. 권장사항
    const improvement = ((hybridResult.content.length - staticResult.content.length) / staticResult.content.length * 100).toFixed(1)
    if (hybridResult.content.length > staticResult.content.length) {
      console.log(`\n✅ 하이브리드 크롤링으로 ${improvement}% 더 많은 콘텐츠 수집!`)
    } else {
      console.log(`\n⚡ 이 페이지는 토글이 없어서 정적 크롤링이 효율적입니다.`)
    }
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error)
  } finally {
    await htmlService.closeBrowser()
  }
}

// 명령행 인수에서 URL 가져오기
const url = process.argv[2]
if (!url) {
  console.log('사용법: npx tsx scripts/compare-crawling-methods.ts <URL>')
  console.log('예시: npx tsx scripts/compare-crawling-methods.ts https://help.pro.sixshop.com/design/header-footer')
  process.exit(1)
}

compareCrawlingMethods(url)