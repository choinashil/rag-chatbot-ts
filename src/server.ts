import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
// 정적 파일 관련 임포트 제거
import dotenv from 'dotenv';

// 환경변수 로드
dotenv.config({ path: 'env/.env.dev' });

// 라우트 임포트
import { registerHealthRoutes } from './routes/health.routes';
import { chatRoutes } from './routes';
import sessionChatRoutes from './routes/session-chat.routes';
import { SERVER_CONFIG } from './constants/system.constants';

// 서비스 임포트
import { NotionService } from './services/notion/notion.service';
import { createNotionConfig } from './config/notion';
import { OpenAIClient } from './services/openai/openai.client';
import { createOpenAIConfig } from './config/openai';
import { PineconeService } from './services/pinecone/pinecone.service';
import { PineconeClient } from './services/pinecone/pinecone.client';
import { createPineconeConfig } from './config/pinecone';

// 데이터베이스 및 추적 서비스 임포트
import { createDatabasePool, checkDatabaseConnection } from './config/database';
import { IntegratedChatService } from './services/chat/integrated-chat.service';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8000;

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // 보안 미들웨어
  await app.register(helmet, {
    contentSecurityPolicy: false, // 개발환경에서 비활성화
  });

  await app.register(rateLimit, {
    max: SERVER_CONFIG.RATE_LIMIT_MAX_REQUESTS,
    timeWindow: '1 minute',
  });

  // CORS 설정 (개발 환경에서 모든 origin 허용)
  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  });

  // 정적 파일 서빙 제거 (별도 FE 프로젝트 예정)

  // 데이터베이스 초기화
  let databasePool: any = null;
  let integratedChatService: IntegratedChatService | null = null;
  
  try {
    databasePool = createDatabasePool();
    const isConnected = await checkDatabaseConnection(databasePool);
    
    if (isConnected) {
      integratedChatService = new IntegratedChatService(databasePool);
      console.log('✅ 통합 채팅 서비스 초기화 완료');
    } else {
      console.log('❌ 데이터베이스 연결 실패 - 통합 채팅 서비스 비활성화');
    }
  } catch (error) {
    console.log('데이터베이스 초기화 건너뜀 (환경변수 미설정):', (error as Error).message);
  }

  // 서비스 초기화
  let notionService: NotionService | null = null;
  try {
    const notionConfig = createNotionConfig();
    notionService = new NotionService(notionConfig);
    await notionService.initialize();
  } catch (error) {
    console.log('노션 서비스 초기화 건너뜀 (환경변수 미설정):', (error as Error).message);
  }

  let openaiClient: OpenAIClient | null = null;
  try {
    const openaiConfig = createOpenAIConfig();
    openaiClient = new OpenAIClient(openaiConfig);
    await openaiClient.initialize();
  } catch (error) {
    console.log('OpenAI 클라이언트 초기화 건너뜀 (환경변수 미설정):', (error as Error).message);
  }

  let pineconeService: PineconeService | null = null;
  try {
    const pineconeConfig = createPineconeConfig();
    const pineconeClient = new PineconeClient(pineconeConfig);
    pineconeService = new PineconeService(pineconeClient);
    console.log('Pinecone 서비스 초기화 완료');
  } catch (error) {
    console.log('Pinecone 서비스 초기화 건너뜀 (환경변수 미설정):', (error as Error).message);
  }

  // 서비스를 라우트에서 사용할 수 있도록 설정
  if (databasePool) {
    app.decorate('databasePool', databasePool);
  }
  if (integratedChatService) {
    app.decorate('integratedChatService', integratedChatService);
  }
  if (notionService) {
    app.decorate('notionService', notionService);
  }
  if (openaiClient) {
    app.decorate('openaiClient', openaiClient);
  }
  if (pineconeService) {
    app.decorate('pineconeService', pineconeService);
  }

  // 라우트 등록
  await app.register(registerHealthRoutes, { prefix: '/api' });
  await app.register(chatRoutes, { prefix: '/api/chat' });
  
  // 세션 기반 채팅 라우트 (통합 채팅 서비스가 있을 때만)
  if (integratedChatService) {
    await app.register(sessionChatRoutes, { prefix: '/api/session-chat' });
    console.log('✅ 세션 기반 채팅 API 활성화');
  } else {
    console.log('⚠️  세션 기반 채팅 API 비활성화 (데이터베이스 연결 필요)');
  }

  return app;
}

async function start(): Promise<void> {
  try {
    const app = await buildApp();

    await app.listen({
      port: PORT,
      host: '0.0.0.0',
    });

    console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다`);
  } catch (error) {
    console.error('서버 시작 실패:', error);
    process.exit(1);
  }
}

// 우아한 종료 처리
process.on('SIGINT', async () => {
  console.log('SIGINT 신호 수신, 우아하게 종료합니다');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM 신호 수신, 우아하게 종료합니다');
  process.exit(0);
});

if (require.main === module) {
  start();
}

export { buildApp };
