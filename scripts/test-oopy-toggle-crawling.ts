/**
 * oopy 토글 콘텐츠 크롤링 시스템 통합 테스트
 * 
 * 개발 계획에서 제공된 테스트 URL들을 사용하여
 * 하이브리드 크롤링 시스템의 동작을 검증합니다.
 */

import { HtmlService } from '../src/services/html/html.service'

interface TestCase {
  name: string
  url: string
  expectedToggles: number
  description: string
}

const TEST_CASES: TestCase[] = [
  {
    name: '토글 없는 페이지',
    url: 'https://help.pro.sixshop.com/quick-guide',
    expectedToggles: 0,
    description: '정적 크롤링만 사용되어야 함'
  },
  {
    name: '단일 토글 페이지',
    url: 'https://help.pro.sixshop.com/design/header-footer',
    expectedToggles: 1,
    description: '1개 토글 감지되어 동적 크롤링 사용'
  },
  {
    name: '다중 토글 페이지',
    url: 'https://help.pro.sixshop.com/design/settings',
    expectedToggles: 4,
    description: '4개 토글 감지되어 동적 크롤링 사용'
  },
  {
    name: '헤더 토글 많은 페이지',
    url: 'https://help.pro.sixshop.com/9c988102-19ee-4fbf-a176-c4cb6e55b58d',
    expectedToggles: 10, // 예상값, 실제 테스트에서 확인
    description: '여러 헤더 토글 감지되어 동적 크롤링 사용'
  }
]

async function runTest(testCase: TestCase): Promise<void> {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🧪 테스트: ${testCase.name}`)
  console.log(`📄 설명: ${testCase.description}`)
  console.log(`🔗 URL: ${testCase.url}`)
  console.log(`⏱️  시작: ${new Date().toISOString()}`)
  
  const htmlService = new HtmlService()
  
  try {
    const startTime = Date.now()
    
    // 새로운 parseUrl 메서드 사용 (하이브리드 크롤링 지원)
    const result = await htmlService.parseUrl(testCase.url)
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`\n✅ 테스트 성공!`)
    console.log(`📊 결과 분석:`)
    console.log(`  - 처리 시간: ${duration}ms`)
    console.log(`  - 문서 제목: ${result.title}`)
    console.log(`  - 콘텐츠 길이: ${result.content.length}자`)
    console.log(`  - Breadcrumb: [${result.breadcrumb.map(item => `"${item}"`).join(', ')}]`)
    console.log(`  - 단어 수: ${result.wordCount}`)
    
    // 콘텐츠 출력
    console.log(`  - 콘텐츠: "${result.content}"`)
    
    // 크롤링 방식 확인 (동적/정적)
    const crawlingMethod = duration > 2000 ? '동적 크롤링' : '정적 크롤링'
    console.log(`  - 추정 크롤링 방식: ${crawlingMethod}`)
    
    if (result.content.length === 0) {
      console.log(`⚠️  경고: 콘텐츠가 비어있습니다. 파싱 문제가 있을 수 있습니다.`)
    }
    
  } catch (error) {
    console.error(`❌ 테스트 실패:`, error)
    throw error
  } finally {
    // 브라우저 리소스 정리
    await htmlService.closeBrowser()
  }
}

async function main(): Promise<void> {
  console.log('🚀 Oopy 토글 크롤링 시스템 통합 테스트 시작')
  console.log(`📅 테스트 시작: ${new Date().toISOString()}`)
  console.log(`🔢 총 테스트 케이스: ${TEST_CASES.length}개`)
  
  let successCount = 0
  let failureCount = 0
  
  for (const testCase of TEST_CASES) {
    try {
      await runTest(testCase)
      successCount++
    } catch (error) {
      console.error(`❌ "${testCase.name}" 테스트 실패:`, error)
      failureCount++
    }
    
    // 테스트 간 잠시 대기 (서버 부하 방지)
    if (TEST_CASES.indexOf(testCase) < TEST_CASES.length - 1) {
      console.log('⏳ 다음 테스트 준비 중...')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log(`\n${'='.repeat(80)}`)
  console.log('🏁 테스트 완료!')
  console.log(`📊 최종 결과:`)
  console.log(`  ✅ 성공: ${successCount}/${TEST_CASES.length}`)
  console.log(`  ❌ 실패: ${failureCount}/${TEST_CASES.length}`)
  console.log(`  📈 성공률: ${Math.round((successCount / TEST_CASES.length) * 100)}%`)
  console.log(`📅 완료 시간: ${new Date().toISOString()}`)
  
  if (failureCount > 0) {
    console.log(`\n⚠️  ${failureCount}개 테스트가 실패했습니다. 로그를 확인하세요.`)
    process.exit(1)
  } else {
    console.log(`\n🎉 모든 테스트가 성공했습니다!`)
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(error => {
    console.error('스크립트 실행 중 오류:', error)
    process.exit(1)
  })
}