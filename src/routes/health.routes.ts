import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ApiResponse, HealthStatus } from '../types';

export async function registerHealthRoutes(fastify: FastifyInstance): Promise<void> {
  // 헬스체크 API 엔드포인트
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 노션 서비스 상태 확인
      const services: Record<string, any> = {};
      
      if (fastify.notionService) {
        services.notion = fastify.notionService.getStatus();
      } else {
        services.notion = {
          connected: false,
          lastCheck: new Date().toISOString(),
          error: '환경변수 미설정으로 비활성화됨'
        };
      }

      const healthStatus: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services,
      };
      
      const apiResponse: ApiResponse<HealthStatus> = {
        success: true,
        data: healthStatus,
        timestamp: new Date().toISOString(),
      };

      return reply.status(200).send(apiResponse);
    } catch (error) {
      fastify.log.error('헬스체크 오류:', error);
      
      return reply.status(503).send({
        success: false,
        error: '헬스체크 실패',
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 단순 핑 API 엔드포인트
  fastify.get('/ping', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send({
      success: true,
      data: 'pong',
      timestamp: new Date().toISOString(),
    });
  });
}