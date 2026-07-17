import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { TaskStore, type GenerateTask } from '../generate/task-store';
import { ComposeDto } from './dto/compose.dto';
import { FfmpegRunner } from './ffmpeg.runner';

@Injectable()
export class ComposeService implements OnModuleInit {
  private readonly logger = new Logger(ComposeService.name);

  constructor(
    private readonly tasks: TaskStore,
    private readonly ffmpeg: FfmpegRunner,
  ) {}

  async onModuleInit() {
    const tasks = await this.tasks.listRecoverable('compose');
    for (const task of tasks) {
      const timeline = this.parseMetadata(task);
      if (!timeline) {
        await this.tasks.update(task.task_id, {
          state: 'failed',
          error: '合成任务数据损坏，请重新导出',
        });
        continue;
      }
      void this.runTask(task, timeline);
    }
  }

  async submit(dto: ComposeDto, userId: number) {
    if (!(await this.ffmpeg.isAvailable())) {
      throw new BadRequestException(
        '服务器未安装 FFmpeg 或 FFMPEG_PATH 配置错误',
      );
    }
    const task = await this.tasks.create({
      userId,
      kind: 'compose',
      metadata: JSON.stringify(dto),
    });
    void this.runTask(task, dto);
    return { task_id: task.task_id, state: task.state };
  }

  private async runTask(task: GenerateTask, timeline: ComposeDto) {
    await this.tasks.update(task.task_id, { state: 'running', progress: 2 });
    try {
      const resultUrl = await this.ffmpeg.compose(
        timeline,
        task.user_id,
        async (progress) => {
          await this.tasks.update(task.task_id, {
            state: 'running',
            progress,
          });
        },
      );
      await this.tasks.update(task.task_id, {
        state: 'completed',
        progress: 100,
        result_url: resultUrl,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '视频合成失败';
      this.logger.error(`compose ${task.task_id} failed: ${message}`);
      await this.tasks.update(task.task_id, {
        state: 'failed',
        error: message,
      });
    }
  }

  private parseMetadata(task: GenerateTask): ComposeDto | undefined {
    if (!task.metadata) return undefined;
    try {
      return JSON.parse(task.metadata) as ComposeDto;
    } catch {
      return undefined;
    }
  }
}
