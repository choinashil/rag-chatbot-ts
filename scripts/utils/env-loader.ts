/**
 * 스크립트용 환경변수 로더
 * 
 * 환경을 인자로 받아 적절한 .env 파일을 로드합니다.
 */

import dotenv from 'dotenv'

export type Environment = 'dev' | 'test' | 'prod'

/**
 * 환경에 따른 .env 파일 경로 매핑
 */
const ENV_FILE_MAP: Record<Environment, string> = {
  dev: 'env/.env.dev',
  test: 'env/.env.integration',  // test 환경은 integration 설정 사용
  prod: 'env/.env.prod'
}

/**
 * 명령행 인자에서 환경을 파싱
 */
export function parseEnvironment(args: string[]): Environment {
  const envFlag = args.find(arg => arg.startsWith('--env='))
  
  if (envFlag) {
    const env = envFlag.split('=')[1] as Environment
    if (['dev', 'test', 'prod'].includes(env)) {
      return env
    }
  }

  // 기본값은 dev
  return 'dev'
}

/**
 * 환경에 맞는 .env 파일 로드
 */
export function loadEnvironment(env: Environment): void {
  const envFile = ENV_FILE_MAP[env]
  
  console.log(`🔧 환경: ${env} (${envFile})`)
  
  const result = dotenv.config({ path: envFile })
  
  if (result.error) {
    console.error(`❌ 환경변수 파일 로드 실패: ${envFile}`)
    console.error(`   파일이 존재하는지 확인하거나 .env.example을 참고하여 생성해주세요.`)
    process.exit(1)
  }
  
  // 필수 환경변수 검증
  const requiredVars = [
    'NOTION_INTEGRATION_TOKEN',
    'OPENAI_API_KEY',
    'PINECONE_API_KEY',
    'PINECONE_INDEX_NAME'
  ]
  
  const missingVars = requiredVars.filter(varName => !process.env[varName])
  
  if (missingVars.length > 0) {
    console.error(`❌ 필수 환경변수가 설정되지 않았습니다: ${missingVars.join(', ')}`)
    console.error(`   ${envFile} 파일을 확인해주세요.`)
    process.exit(1)
  }
}

/**
 * 도움말에 환경 옵션 추가
 */
export function getEnvironmentHelp(): string {
  return `
환경 설정:
  --env=dev         개발 환경 (기본값)
  --env=test        테스트 환경 
  --env=prod        운영 환경

환경별 설정 파일:
  dev  → env/.env.dev
  test → env/.env.integration
  prod → env/.env.prod
`
}