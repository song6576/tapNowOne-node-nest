import { Controller, Get } from '@nestjs/common';
import { AiRouterService } from './ai/ai-router.service';
import { FfmpegRunner } from './compose/ffmpeg.runner';
import { PrismaService } from './prisma/prisma.service';

@Controller('api')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRouter: AiRouterService,
    private readonly ffmpeg: FfmpegRunner,
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
      providers: this.aiRouter.providersConfigured,
      dashscope_configured: this.aiRouter.providersConfigured.dashscope,
      ark_configured: this.aiRouter.providersConfigured.ark,
      ffmpeg_configured: await this.ffmpeg.isAvailable(),
      ...(databaseError && { databaseError }),
    };
  }
}
