import { Controller, Get } from '@nestjs/common';
import { DashScopeService } from './agent/dashscope.service';
import { PrismaService } from './prisma/prisma.service';

@Controller('api')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashscope: DashScopeService,
  ) {}

  @Get('health')
  async health() {
    let database: 'ok' | 'error' = 'ok';
    let databaseError: string | undefined;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      database = 'error';
      databaseError =
        err instanceof Error ? err.message : 'database connection failed';
    }

    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      service: 'tapnow-backend-nest',
      auth: true,
      database,
      mock_mode: this.dashscope.mockMode,
      dashscope_configured: this.dashscope.isConfigured,
      ...(databaseError && { databaseError }),
    };
  }
}
