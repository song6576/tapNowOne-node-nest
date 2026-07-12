import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { DashScopeService } from '../agent/dashscope.service';
import { DEFAULT_IMAGE_MODEL } from '../agent/agent-models';
import { GenerateDto } from './dto/generate.dto';
import { TaskStore, type GenerateTask } from './task-store';

@Injectable()
export class GenerateService {
  private readonly logger = new Logger(GenerateService.name);
  private readonly uploadRoot: string;
  private readonly publicBase: string;

  constructor(
    private readonly tasks: TaskStore,
    private readonly dashscope: DashScopeService,
    private readonly config: ConfigService,
  ) {
    this.uploadRoot = config.get<string>(
      'UPLOAD_DIR',
      join(process.cwd(), 'uploads'),
    );
    this.publicBase = (
      config.get<string>('PUBLIC_BASE_URL') ||
      `http://127.0.0.1:${config.get<number>('PORT', 3000)}`
    ).replace(/\/$/, '');
  }

  /**
   * POST /api/generate — 创建异步任务并后台执行
   * image：调用百炼文生图；video/audio：暂未接入（Mock 下返回占位图）
   */
  submit(dto: GenerateDto): Pick<GenerateTask, 'task_id' | 'state'> {
    const prompt = dto.prompt.trim();
    if (!prompt) throw new BadRequestException('prompt 不能为空');

    const task = this.tasks.create(dto.node_type);
    void this.runTask(task.task_id, dto).catch((err) => {
      this.logger.error(
        `task ${task.task_id} crashed: ${err instanceof Error ? err.message : err}`,
      );
      this.tasks.update(task.task_id, {
        state: 'failed',
        error: err instanceof Error ? err.message : '生成失败',
      });
    });

    return { task_id: task.task_id, state: task.state };
  }

  /** GET /api/tasks/:id */
  getTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) throw new NotFoundException('任务不存在或已过期');
    return {
      task_id: task.task_id,
      state: task.state,
      result_url: task.result_url,
      error: task.error,
    };
  }

  private async runTask(taskId: string, dto: GenerateDto) {
    this.tasks.update(taskId, { state: 'running' });

    try {
      if (dto.node_type === 'image') {
        const url = await this.generateImage(dto);
        this.tasks.update(taskId, { state: 'completed', result_url: url });
        return;
      }

      if (this.dashscope.mockMode) {
        const url = this.mockPlaceholder(dto.node_type, dto.prompt);
        this.tasks.update(taskId, { state: 'completed', result_url: url });
        return;
      }

      this.tasks.update(taskId, {
        state: 'failed',
        error: `${dto.node_type} 生成尚未接入，请先使用图片节点`,
      });
    } catch (err) {
      this.tasks.update(taskId, {
        state: 'failed',
        error: err instanceof Error ? err.message : '生成失败',
      });
    }
  }

  private resolveImageModel(dto: GenerateDto): string {
    if (dto.auto || !dto.model || dto.model === 'auto') {
      return DEFAULT_IMAGE_MODEL;
    }
    return dto.model;
  }

  private buildPrompt(dto: GenerateDto): string {
    const parts = [dto.prompt.trim()];
    if (dto.upstream_text?.trim()) {
      parts.unshift(`参考上文：${dto.upstream_text.trim()}`);
    }
    return parts.join('\n');
  }

  private async generateImage(dto: GenerateDto): Promise<string> {
    if (this.dashscope.mockMode) {
      return this.mockPlaceholder('image', dto.prompt);
    }

    const model = this.resolveImageModel(dto);
    const prompt = this.buildPrompt(dto);
    const remoteUrl = await this.dashscope.generateImage({
      model,
      prompt,
      imageUrl: this.toAbsoluteUrl(dto.upstream_image_url),
      size: this.config.get<string>('IMAGE_SIZE', '1328*1328'),
    });

    return this.persistRemoteImage(remoteUrl);
  }

  /** 将百炼临时 URL 下载到本地 uploads，避免 24h 过期 */
  private async persistRemoteImage(remoteUrl: string): Promise<string> {
    const resp = await fetch(remoteUrl);
    if (!resp.ok) {
      this.logger.warn(`下载生成图失败 (${resp.status})，回退远端 URL`);
      return remoteUrl;
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    const contentType = resp.headers.get('content-type') ?? 'image/png';
    const ext = contentType.includes('jpeg') || contentType.includes('jpg')
      ? '.jpg'
      : contentType.includes('webp')
        ? '.webp'
        : '.png';

    const dir = join(this.uploadRoot, 'generated');
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}${ext}`;
    await writeFile(join(dir, filename), buf);
    return `/uploads/generated/${filename}`;
  }

  private toAbsoluteUrl(url?: string): string | undefined {
    if (!url?.trim()) return undefined;
    const u = url.trim();
    if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
    if (u.startsWith('/')) return `${this.publicBase}${u}`;
    return u;
  }

  private mockPlaceholder(
    nodeType: 'image' | 'video' | 'audio',
    prompt: string,
  ): string {
    const label = prompt.slice(0, 40).replace(/[<"&]/g, '');
    const color =
      nodeType === 'video' ? '#fbbf24' : nodeType === 'audio' ? '#34d399' : '#a78bfa';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#18181b"/><text x="256" y="230" text-anchor="middle" fill="${color}" font-size="16" font-family="sans-serif">${nodeType} (mock)</text><text x="256" y="270" text-anchor="middle" fill="#71717a" font-size="12" font-family="sans-serif">${label}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
}
