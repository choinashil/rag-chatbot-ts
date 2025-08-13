/**
 * LangSmith 프로젝트 생성 스크립트
 */

import dotenv from 'dotenv'
import path from 'path'
import { createLangSmithClient } from '../src/config/langsmith'

// 환경변수 로드
dotenv.config({ path: path.join(__dirname, '../env/.env.dev') })

async function createLangSmithProject() {
  console.log('🚀 LangSmith 프로젝트 생성 시작...')
  
  const projectName = process.env.LANGSMITH_PROJECT_NAME
  if (!projectName) {
    console.error('❌ LANGSMITH_PROJECT_NAME이 설정되지 않았습니다')
    process.exit(1)
  }

  console.log(`📝 프로젝트 이름: ${projectName}`)

  try {
    const client = createLangSmithClient()
    
    // 기존 프로젝트 확인
    try {
      const existingProject = await client.readProject({ projectName })
      console.log('✅ 프로젝트가 이미 존재합니다:', {
        id: existingProject.id,
        name: existingProject.name
      })
      return
    } catch (error) {
      console.log('📋 프로젝트가 존재하지 않아 새로 생성합니다...')
    }

    // 새 프로젝트 생성
    const newProject = await client.createProject({
      projectName,
      description: 'Sixshop AI Agent - RAG 챗봇 모니터링 및 추적'
    })

    console.log('✅ 프로젝트 생성 완료:', {
      id: newProject.id,
      name: newProject.name,
      description: newProject.description
    })

    // 프로젝트 목록 확인
    console.log('📋 현재 프로젝트 목록:')
    const projects: any[] = []
    for await (const project of client.listProjects()) {
      projects.push(project)
      console.log(`  - ${project.name} (ID: ${project.id})`)
    }

  } catch (error) {
    console.error('❌ LangSmith 프로젝트 생성 실패:', error)
    throw error
  }
}

// 스크립트 실행
if (require.main === module) {
  createLangSmithProject()
    .then(() => {
      console.log('🎉 LangSmith 프로젝트 설정 완료!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 LangSmith 프로젝트 설정 실패:', error)
      process.exit(1)
    })
}