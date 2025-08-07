/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // TypeScript 설정
  transform: {
    '^.+\\.ts$': ['ts-jest'],
  },
  
  // 테스트 파일 패턴
  testMatch: [
    '**/tests/unit/**/*.test.ts'
  ],
  
  // 커버리지 설정 (필요시 npm run test:coverage)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  
  // 모듈 디렉토리 설정
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  
  // 테스트 전/후 설정
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  
  // 타임아웃 설정 (빠른 테스트를 위해 단축)
  testTimeout: 5000,
  
  // 빠른 테스트를 위한 설정
  maxWorkers: 1, // 단일 워커로 실행하여 안정성 향상
};