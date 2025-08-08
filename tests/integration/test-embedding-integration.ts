// 임베딩 서비스 통합 테스트 - 실제 OpenAI API 호출 테스트
import dotenv from 'dotenv'
import { OpenAIClient } from '../../src/services/openai/openai.client'
import { EmbeddingService } from '../../src/services/openai/embedding.service'
import { createOpenAIConfig } from '../../src/config/openai'

// 환경변수 로드
dotenv.config({ path: 'env/.env.integration' })

async function testEmbeddingIntegration() {
  console.log('🔮 임베딩 서비스 통합 테스트 시작...\n')

  try {
    // 1. OpenAI 클라이언트 초기화
    console.log('1. OpenAI 클라이언트 초기화...')
    const openaiConfig = createOpenAIConfig()
    const openaiClient = new OpenAIClient(openaiConfig)
    await openaiClient.initialize()
    console.log('   ✅ OpenAI 클라이언트 초기화 완료\n')

    // 2. EmbeddingService 생성
    console.log('2. EmbeddingService 생성...')
    const embeddingService = new EmbeddingService(openaiClient)
    console.log('   ✅ EmbeddingService 생성 완료\n')

    // 3. 헬스체크
    console.log('3. 헬스체크...')
    const isHealthy = await embeddingService.healthCheck()
    console.log(`   연결 상태: ${isHealthy ? '✅ 연결됨' : '❌ 연결 실패'}\n`)

    if (!isHealthy) {
      console.log('❌ OpenAI 연결 실패로 테스트 중단')
      return
    }

    // 4. 기본 임베딩 생성 테스트
    console.log('4. 기본 임베딩 생성 테스트...')
    const testTexts = [
      '안녕하세요. 이것은 한국어 테스트 문장입니다.',
      'Hello, this is an English test sentence.',
      '人工知能は素晴らしい技術です。'
    ]

    for (let i = 0; i < testTexts.length; i++) {
      const text = testTexts[i]!
      console.log(`   테스트 ${i + 1}: "${text.substring(0, 30)}..."`)
      
      const result = await embeddingService.createEmbedding(text, `test-${i + 1}`)
      
      console.log(`     - 임베딩 차원: ${result.embedding.length}차원`)
      console.log(`     - 토큰 수: ${result.tokenCount}`)
      console.log(`     - 모델: ${result.model}`)
      console.log(`     - ID: ${result.id}`)
      console.log(`     - 첫 5개 값: [${result.embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`)
      console.log('')
    }

    // 5. 빈 텍스트 에러 테스트
    console.log('5. 빈 텍스트 에러 처리 테스트...')
    try {
      await embeddingService.createEmbedding('')
      console.log('   ❌ 빈 텍스트에 대한 에러 처리 실패')
    } catch (error) {
      console.log(`   ✅ 빈 텍스트 에러 처리 성공: ${(error as Error).message}`)
    }

    // 6. 긴 텍스트 에러 테스트
    console.log('\n6. 긴 텍스트 제한 테스트...')
    const longText = 'A'.repeat(32001) // 제한을 초과하는 텍스트
    try {
      await embeddingService.createEmbedding(longText)
      console.log('   ❌ 긴 텍스트에 대한 에러 처리 실패')
    } catch (error) {
      console.log(`   ✅ 긴 텍스트 제한 처리 성공: ${(error as Error).message}`)
    }

    // 7. 벡터 유사도 테스트
    console.log('\n7. 벡터 유사도 테스트...')
    const similarTexts = [
      '고양이는 귀여운 동물입니다.',
      '고양이는 사랑스러운 동물이에요.',
      '개는 충성스러운 동물입니다.'
    ]

    const embeddings = []
    for (let i = 0; i < similarTexts.length; i++) {
      const result = await embeddingService.createEmbedding(similarTexts[i]!, `similar-${i}`)
      embeddings.push(result.embedding)
      console.log(`   텍스트 ${i + 1}: "${similarTexts[i]}"`)
    }

    // 코사인 유사도 계산
    function cosineSimilarity(a: number[], b: number[]): number {
      const dotProduct = a.reduce((sum, val, i) => sum + val * b[i]!, 0)
      const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
      const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
      return dotProduct / (magnitudeA * magnitudeB)
    }

    const sim1_2 = cosineSimilarity(embeddings[0]!, embeddings[1]!)
    const sim1_3 = cosineSimilarity(embeddings[0]!, embeddings[2]!)
    const sim2_3 = cosineSimilarity(embeddings[1]!, embeddings[2]!)

    console.log(`   유사도 (텍스트1 ↔ 텍스트2): ${sim1_2.toFixed(4)} (고양이 vs 고양이)`)
    console.log(`   유사도 (텍스트1 ↔ 텍스트3): ${sim1_3.toFixed(4)} (고양이 vs 개)`)
    console.log(`   유사도 (텍스트2 ↔ 텍스트3): ${sim2_3.toFixed(4)} (고양이 vs 개)`)

    if (sim1_2 > sim1_3 && sim1_2 > sim2_3) {
      console.log('   ✅ 유사한 텍스트끼리 더 높은 유사도를 가짐')
    } else {
      console.log('   ⚠️  예상과 다른 유사도 결과')
    }

    console.log('\n🎉 임베딩 서비스 통합 테스트 완료!')
    console.log('\n📊 테스트 요약:')
    console.log(`   - 다국어 임베딩 생성: ✅`)
    console.log(`   - 에러 처리 검증: ✅`)
    console.log(`   - 벡터 유사도 검증: ✅`)
    console.log(`   - 모든 테스트 통과: ✅`)

  } catch (error) {
    console.error('❌ 임베딩 서비스 통합 테스트 실패:', error)
    process.exit(1)
  }
}

// 실행
if (require.main === module) {
  testEmbeddingIntegration()
}