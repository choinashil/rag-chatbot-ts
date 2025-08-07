// 테스트 전역 설정
import dotenv from 'dotenv'

// 테스트 환경 변수 로드
dotenv.config({ path: 'env/.env.test' })

// 콘솔 출력 억제 (필요시)
if (process.env.SUPPRESS_TEST_LOGS === 'true') {
  console.log = jest.fn()
  console.error = jest.fn()
  console.warn = jest.fn()
}