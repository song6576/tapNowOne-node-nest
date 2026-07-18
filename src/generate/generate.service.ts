import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiRouterService } from '../ai/ai-router.service';
import { UploadService } from '../upload/upload.service';
import { GenerateDto } from './dto/generate.dto';
import { TaskStore, type GenerateTask } from './task-store';

@Injectable()
export class GenerateService implements OnModuleInit {
  private readonly logger = new Logger(GenerateService.name);
  private readonly publicBase: string;

  constructor(
    private readonly tasks: TaskStore,
    private readonly aiRouter: AiRouterService,
    private readonly config: ConfigService,
    private readonly uploadService: UploadService,
  ) {
    this.publicBase = (
      config.get<string>('PUBLIC_BASE_URL') ||
      `http://127.0.0.1:${config.get<number>('PORT', 3000)}`
    ).replace(/\/$/, '');
  }

  async onModuleInit() {
    const tasks = await this.tasks.listRecoverable('generate');
    for (const task of tasks) {
      if (
        task.provider &&
        task.provider_task_id &&
        task.node_type === 'video'
      ) {
        void this.resumeVideoTask(task);
      } else {
        await this.tasks.update(task.task_id, {
          state: 'failed',
          error: '服务重启前任务尚未提交到供应商，请重新生成',
        });
      }
    }
  }

  /** POST /api/generate — 创建异步任务并后台执行 */
  async submit(
    dto: GenerateDto,
    userId: number,
  ): Promise<Pick<GenerateTask, 'task_id' | 'state'>> {
    const prompt = this.buildPrompt(dto);
    if (!prompt) throw new BadRequestException('prompt 不能为空');

    const task = await this.tasks.create({
      userId,
      kind: 'generate',
      nodeType: dto.node_type,
      metadata: JSON.stringify({ ...dto, prompt }),
    });
    void this.runTask(task.task_id, { ...dto, prompt, upstream_text: undefined }, userId).catch((err) => {
      this.logger.error(
        `task ${task.task_id} crashed: ${err instanceof Error ? err.message : err}`,
      );
      void this.tasks.update(task.task_id, {
        state: 'failed',
        error: err instanceof Error ? err.message : '生成失败',
      });
    });

    return { task_id: task.task_id, state: task.state };
  }

  /** GET /api/tasks/:id */
  async getTask(taskId: string, userId: number) {
    const task = await this.tasks.get(taskId, userId);
    if (!task) throw new NotFoundException('任务不存在或已过期');
    return {
      task_id: task.task_id,
      state: task.state,
      progress: task.progress,
      result_url: task.result_url,
      error: task.error,
    };
  }

  private async runTask(taskId: string, dto: GenerateDto, userId: number) {
    await this.tasks.update(taskId, { state: 'running', progress: 5 });
    try {
      if (this.isForcedMock) {
        const url = this.mockPlaceholder(dto.node_type, dto.prompt ?? '');
        await this.tasks.update(taskId, {
          state: 'completed',
          progress: 100,
          result_url: url,
        });
        return;
      }

      if (dto.node_type === 'image') {
        const result = await this.aiRouter.generateImage(
          dto.model,
          dto.auto !== false,
          {
            prompt: this.buildPrompt(dto),
            imageUrl: this.toAbsoluteUrl(dto.upstream_image_url),
            size: this.config.get<string>('IMAGE_SIZE', '1328*1328'),
          },
        );
        await this.tasks.update(taskId, {
          provider: result.provider,
          progress: 80,
        });
        const url = await this.persistRemoteMedia(result.url, 'image', userId);
        await this.tasks.update(taskId, {
          state: 'completed',
          progress: 100,
          result_url: url,
        });
        return;
      }

      if (dto.node_type === 'video') {
        const referenceImageUrls = [
          ...(dto.upstream_image_urls ?? []),
          ...(dto.upstream_image_url ? [dto.upstream_image_url] : []),
        ]
          .map((url) => this.toAbsoluteUrl(url))
          .filter((url): url is string => Boolean(url));

        const remote = await this.aiRouter.createVideo(
          dto.model,
          dto.auto !== false,
          {
            prompt: this.buildPrompt(dto),
            imageUrl: referenceImageUrls[0],
            referenceImageUrls,
            duration: dto.duration,
            ratio:
              dto.ratio ?? this.config.get<string>('VIDEO_RATIO', '16:9'),
            resolution:
              dto.resolution ??
              this.config.get<string>('VIDEO_RESOLUTION', '720P'),
            watermark: dto.watermark ?? false,
          },
        );
        await this.tasks.update(taskId, {
          provider: remote.provider,
          provider_task_id: remote.taskId,
          progress: 10,
        });
        await this.pollVideoTask(taskId, remote.provider, remote.taskId, userId);
        return;
      }

      throw new BadRequestException(
        '语音生成尚未接入；当前可上传音频并用于总视频合成',
      );
    } catch (err) {
      await this.tasks.update(taskId, {
        state: 'failed',
        error: err instanceof Error ? err.message : '生成失败',
      });
    }
  }

  private async resumeVideoTask(task: GenerateTask) {
    try {
      await this.pollVideoTask(
        task.task_id,
        task.provider!,
        task.provider_task_id!,
        task.user_id,
      );
    } catch (err) {
      await this.tasks.update(task.task_id, {
        state: 'failed',
        error: err instanceof Error ? err.message : '恢复视频任务失败',
      });
    }
  }

  private async pollVideoTask(
    taskId: string,
    provider: string,
    providerTaskId: string,
    userId: number,
  ) {
    const maxAttempts = this.config.get<number>('VIDEO_POLL_MAX_ATTEMPTS', 150);
    const intervalMs = this.config.get<number>('VIDEO_POLL_INTERVAL_MS', 8_000);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const remote = await this.aiRouter.getVideoTask(provider, providerTaskId);
      if (remote.state === 'failed') {
        throw new Error(remote.error ?? '视频生成失败');
      }
      if (remote.state === 'completed' && remote.resultUrl) {
        const url = await this.persistRemoteMedia(remote.resultUrl, 'video', userId);
        await this.tasks.update(taskId, {
          state: 'completed',
          progress: 100,
          result_url: url,
        });
        return;
      }
      await this.tasks.update(taskId, {
        state: 'running',
        progress:
          remote.progress ??
          Math.min(90, 10 + Math.floor((attempt / maxAttempts) * 80)),
      });
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error('视频生成超时，请稍后重试');
  }

  private buildPrompt(dto: GenerateDto): string {
    const upstream = dto.upstream_text?.trim() ?? ''
    const self = dto.prompt?.trim() ?? ''
    if (upstream && self) return `${upstream}${self}`
    return self || upstream
  }

  /** 将供应商临时 URL / base64 保存到对象存储（或本地 uploads），避免链接过期 */
  private async persistRemoteMedia(
    remoteUrl: string,
    kind: 'image' | 'video',
    userId: number,
  ): Promise<string> {
    let buffer: Buffer;
    let contentType = '';

    if (remoteUrl.startsWith('data:')) {
      const match = remoteUrl.match(/^data:([^;,]+);base64,(.+)$/s);
      if (!match) throw new Error('生成结果 data URL 无法解析');
      contentType = match[1];
      buffer = Buffer.from(match[2], 'base64');
    } else {
      const response = await fetch(remoteUrl, {
        signal: AbortSignal.timeout(
          this.config.get<number>('MEDIA_DOWNLOAD_TIMEOUT_MS', 180_000),
        ),
      });
      if (!response.ok) {
        throw new Error(`下载生成结果失败 (${response.status})`);
      }
      contentType = response.headers.get('content-type') ?? '';
      const length = Number(response.headers.get('content-length') ?? 0);
      const maxBytes = this.config.get<number>(
        'MEDIA_DOWNLOAD_MAX_BYTES',
        250 * 1024 * 1024,
      );
      if (length > maxBytes) throw new Error('生成结果超过允许的文件大小');
      buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > maxBytes) {
        throw new Error('生成结果超过允许的文件大小');
      }
    }

    return this.uploadService.persistGeneratedBuffer({
      userId,
      buffer,
      contentType,
      kind,
    });
  }

  private toAbsoluteUrl(url?: string): string | undefined {
    if (!url?.trim()) return undefined;
    const value = url.trim();
    if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
    if (value.startsWith('/')) return `${this.publicBase}${value}`;
    return value;
  }

  private get isForcedMock(): boolean {
    return ['1', 'true', 'yes'].includes(
      this.config.get<string>('MOCK_MODE', '').toLowerCase(),
    );
  }

  private mockPlaceholder(
    nodeType: 'image' | 'video' | 'audio',
    prompt: string,
  ): string {
    const label = prompt.slice(0, 40).replace(/[<"&]/g, '');
    const color =
      nodeType === 'video'
        ? '#fbbf24'
        : nodeType === 'audio'
          ? '#34d399'
          : '#a78bfa';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#18181b"/><text x="256" y="230" text-anchor="middle" fill="${color}" font-size="16" font-family="sans-serif">${nodeType} (mock)</text><text x="256" y="270" text-anchor="middle" fill="#71717a" font-size="12" font-family="sans-serif">${label}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
}
