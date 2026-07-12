import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GenerateDto } from './dto/generate.dto';
import { GenerateService } from './generate.service';

@Controller('api')
export class GenerateController {
  constructor(private readonly generateService: GenerateService) {}

  /**
   * POST /api/generate
   * 提交图片/视频/音频生成任务（异步）；前端再轮询 GET /api/tasks/:id
   */
  @Post('generate')
  @UseGuards(JwtAuthGuard)
  submit(@Body() dto: GenerateDto) {
    return this.generateService.submit(dto);
  }

  /**
   * GET /api/tasks/:taskId
   * 查询生成任务状态：pending | running | completed | failed
   */
  @Get('tasks/:taskId')
  getTask(@Param('taskId') taskId: string) {
    return this.generateService.getTask(taskId);
  }
}
