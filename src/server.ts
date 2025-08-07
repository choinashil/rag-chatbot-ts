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

// 서비스 임포트 (테스트용)
import { NotionService } from './services/notion/notion.service';
import { createNotionConfig } from './config/notion';

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
    max: 100,
    timeWindow: '1 minute',
  });

  // CORS 설정
  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production' ? false : true,
  });

  // 정적 파일 서빙 제거 (별도 FE 프로젝트 예정)

  // 서비스 초기화 (테스트용)
  let notionService: NotionService | null = null;
  try {
    const notionConfig = createNotionConfig();
    notionService = new NotionService(notionConfig);
    await notionService.initialize();
  } catch (error) {
    console.log('노션 서비스 초기화 건너뜀 (환경변수 미설정):', (error as Error).message);
  }

  // 서비스를 라우트에서 사용할 수 있도록 설정
  if (notionService) {
    app.decorate('notionService', notionService);
  }

  // 라우트 등록
  await app.register(registerHealthRoutes, { prefix: '/api' });

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
