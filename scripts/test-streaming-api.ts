#!/usr/bin/env ts-node

/**
 * SSE 스트리밍 채팅 API 통합 테스트
 * 실제 서버에서 POST /api/chat/stream 엔드포인트 테스트
 */

import axios from 'axios'

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8000'
const TEST_QUESTIONS = [
  '호두는 뭘 좋아하나요?',
  '존재하지 않는 질문입니다',
  '노션 문서에 대해 알려주세요'
]

interface StreamingEvent {
  type: 'status' | 'token' | 'sources' | 'done' | 'error'
  content?: string
  data?: any
}

async function testStreamingAPI(question: string): Promise<void> {
  console.log(`\n🧪 스트리밍 테스트: "${question}"`)
  console.log('=' .repeat(50))

  try {
    const response = await axios.post(
      `${SERVER_URL}/api/chat/stream`,
      { message: question },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        responseType: 'stream'
      }
    )

    let eventCount = 0
    let fullAnswer = ''
    let sources: any[] = []
    let processingTime = 0

    response.data.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n')
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const eventData = line.substring(6).trim()
            if (eventData) {
              const event: StreamingEvent = JSON.parse(eventData)
              eventCount++

              switch (event.type) {
                case 'status':
                  console.log(`📍 상태: ${event.content}`)
                  break
                
                case 'token':
                  process.stdout.write(event.content || '')
                  fullAnswer += event.content || ''
                  break
                
                case 'sources':
                  sources = event.data || []
                  console.log(`\n📚 출처: ${sources.length}개 문서`)
                  sources.forEach((source, index) => {
                    console.log(`  ${index + 1}. ${source.title} (점수: ${source.score.toFixed(3)})`)
                  })
                  break
                
                case 'done':
                  processingTime = event.data?.processingTime || 0
                  console.log(`\n✅ 완료 (${processingTime}ms, ${eventCount}개 이벤트)`)
                  break
                
                case 'error':
                  console.log(`\n❌ 에러: ${event.content}`)
                  break
              }
            }
          } catch (parseError) {
            // JSON 파싱 실패는 무시 (빈 줄 등)
          }
        }
      }
    })

    await new Promise((resolve, reject) => {
      response.data.on('end', resolve)
      response.data.on('error', reject)
    })

    console.log(`\n📊 요약:`)
    console.log(`  - 전체 답변 길이: ${fullAnswer.length}자`)
    console.log(`  - 처리 시간: ${processingTime}ms`)
    console.log(`  - 이벤트 수: ${eventCount}개`)
    console.log(`  - 출처 수: ${sources.length}개`)

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ HTTP 에러 [${error.response?.status}]: ${error.message}`)
      if (error.response?.data) {
        console.error(`응답 데이터:`, error.response.data)
      }
    } else {
      console.error('❌ 예상치 못한 에러:', error)
    }
  }
}

async function testBackupAPI(question: string): Promise<void> {
  console.log(`\n🔄 백업 REST API 테스트: "${question}"`)
  console.log('-'.repeat(50))

  try {
    const startTime = Date.now()
    
    const response = await axios.post(
      `${SERVER_URL}/api/chat`,
      { message: question },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    const endTime = Date.now()
    const processingTime = endTime - startTime

    console.log(`✅ 응답 받음 (${processingTime}ms)`)
    console.log(`📝 답변: ${response.data.answer}`)
    console.log(`📚 출처: ${response.data.sources?.length || 0}개`)
    
    if (response.data.sources?.length > 0) {
      response.data.sources.forEach((source: any, index: number) => {
        console.log(`  ${index + 1}. ${source.title} (점수: ${source.score?.toFixed(3) || 'N/A'})`)
      })
    }

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ HTTP 에러 [${error.response?.status}]: ${error.message}`)
    } else {
      console.error('❌ 예상치 못한 에러:', error)
    }
  }
}

async function main(): Promise<void> {
  console.log('🚀 SSE 스트리밍 채팅 API 통합 테스트')
  console.log(`📡 서버 URL: ${SERVER_URL}`)
  
  // 서버 상태 확인
  try {
    await axios.get(`${SERVER_URL}/api/health`)
    console.log('✅ 서버 연결 확인됨')
  } catch (error) {
    console.error('❌ 서버 연결 실패. 서버가 실행 중인지 확인하세요.')
    process.exit(1)
  }

  // 스트리밍 API 테스트
  for (const question of TEST_QUESTIONS) {
    await testStreamingAPI(question)
    await new Promise(resolve => setTimeout(resolve, 1000)) // 1초 대기
  }

  // 백업 REST API 테스트
  console.log('\n' + '='.repeat(70))
  console.log('백업 REST API 테스트')
  console.log('='.repeat(70))

  for (const question of TEST_QUESTIONS.slice(0, 2)) { // 처음 2개만 테스트
    await testBackupAPI(question)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log('\n🎉 모든 테스트 완료!')
}

if (require.main === module) {
  main().catch(console.error)
}