import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RemoteVideoTask, VideoGenerationInput } from '../ai/ai.types';
import {
  normalizeVideoDuration,
  normalizeVideoRatio,
  normalizeVideoResolution,
} from '../ai/video-params';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const CHAT_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

@Injectable()
export class DashScopeService {
  private readonly logger = new Logger(DashScopeService.name);

  constructor(private readonly config: ConfigService) {}

  get apiKey(): string {
    return this.config.get<string>('DASHSCOPE_API_KEY', '') ?? '';
  }

  get model(): string {
    return this.config.get<string>('DASHSCOPE_MODEL', 'qwen-plus') ?? 'qwen-plus';
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey.trim());
  }

  /** 多模态生图 API 根路径，可配成 Workspace 专属域名 */
  private get apiBase(): string {
    return (
      this.config.get<string>('DASHSCOPE_BASE_URL') ||
      'https://dashscope.aliyuncs.com/api/v1'
    ).replace(/\/$/, '');
  }

  /** HappyHorse 等视频生成 API 根路径，可配成 Workspace 专属 MaaS 域名 */
  private get videoApiBase(): string {
    return (
      this.config.get<string>('DASHSCOPE_VIDEO_BASE_URL') ||
      this.config.get<string>('DASHSCOPE_BASE_URL') ||
      'https://dashscope.aliyuncs.com/api/v1'
    ).replace(/\/$/, '');
  }

  async chatCompletion(
    messages: ChatMessage[],
    model?: string,
  ): Promise<string> {
    if (!this.isConfigured) throw new Error('DASHSCOPE_API_KEY 未配置');

    const body = {
      model: model ?? this.model,
      messages,
      temperature: 0.7,
    };

    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      this.logger.error(`DashScope chat failed (${resp.status}): ${detail}`);
      throw new Error(`百炼 API 调用失败 (${resp.status})`);
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(data.error?.message ?? '百炼未返回有效回复');
    }
    return content;
  }

  /**
   * 文生图 / 图生图（指令编辑）
   * POST .../services/aigc/multimodal-generation/generation
   */
  async generateImage(opts: {
    model: string;
    prompt: string;
    imageUrl?: string;
    size?: string;
  }): Promise<string> {
    const content: Array<Record<string, string>> = [];
    if (opts.imageUrl) {
      content.push({ image: opts.imageUrl });
    }
    content.push({ text: opts.prompt });

    const body = {
      model: opts.model,
      input: {
        messages: [{ role: 'user', content }],
      },
      parameters: {
        negative_prompt:
          '低分辨率，低画质，肢体畸形，手指畸形，画面过饱和，蜡像感，人脸无细节，过度光滑，构图混乱，文字模糊扭曲',
        prompt_extend: true,
        watermark: false,
        size: opts.size ?? '1328*1328',
        n: 1,
      },
    };

    const url = `${this.apiBase}/services/aigc/multimodal-generation/generation`;
    this.logger.log(`DashScope image generate model=${opts.model}`);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      this.logger.error(`DashScope image failed (${resp.status}): ${raw}`);
      throw new Error(this.parseDashScopeError(raw, resp.status));
    }

    let data: {
      output?: {
        choices?: Array<{
          message?: { content?: Array<Record<string, string>> | string };
        }>;
      };
      code?: string;
      message?: string;
    };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      throw new Error('百炼生图返回无法解析');
    }

    if (data.code && data.message) {
      throw new Error(`百炼生图失败：${data.message}`);
    }

    const parts = data.output?.choices?.[0]?.message?.content;
    if (Array.isArray(parts)) {
      for (const part of parts) {
        const image = part.image || part.url;
        if (image) return image;
      }
    }

    throw new Error('百炼未返回图片地址');
  }

  /**
   * HappyHorse 参考生视频（异步）
   * POST .../services/aigc/video-generation/video-synthesis
   *
   * 官方要求：media 必填（1~9 张公网可访问参考图）；prompt 用 [Image N] 指代。
   * parameters 与文档一致：resolution / ratio / duration / watermark。
   */
  async createVideoTask(
    model: string,
    input: VideoGenerationInput,
  ): Promise<string> {
    const referenceUrls = this.collectReferenceImages(input);
    const requiresMedia = /happyhorse/i.test(model) && /r2v/i.test(model);

    if (requiresMedia && referenceUrls.length === 0) {
      throw new Error(
        'HappyHorse 参考生视频需要至少 1 张参考图：请先连接已生成的图片节点，或上传公网可访问的图片',
      );
    }

    const privateUrl = referenceUrls.find((u) => this.isNonPublicMediaUrl(u));
    if (privateUrl) {
      throw new Error(
        `参考图地址百炼无法拉取（需公网 HTTPS）：${privateUrl}。请使用对象存储公网链接，不要使用本机 /uploads 路径`,
      );
    }

    const prompt = this.ensureImageRefsInPrompt(input.prompt, referenceUrls.length);
    const body: Record<string, unknown> = {
      model,
      input: {
        prompt,
        ...(referenceUrls.length > 0
          ? {
              media: referenceUrls.map((url) => ({
                type: 'reference_image',
                url,
              })),
            }
          : {}),
      },
      parameters: {
        resolution: normalizeVideoResolution(input.resolution),
        ratio: normalizeVideoRatio(input.ratio),
        duration: normalizeVideoDuration(input.duration),
        watermark: input.watermark ?? false,
      },
    };

    const url = `${this.videoApiBase}/services/aigc/video-generation/video-synthesis`;
    this.logger.log(
      `DashScope video task model=${model} refs=${referenceUrls.length}`,
    );

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(body),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      this.logger.error(`DashScope video failed (${resp.status}): ${raw}`);
      throw new Error(this.parseDashScopeError(raw, resp.status));
    }

    let data: {
      output?: { task_id?: string; task_status?: string };
      code?: string;
      message?: string;
    };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      throw new Error('百炼视频任务返回无法解析');
    }

    if (data.code && data.message) {
      throw new Error(`百炼视频任务创建失败：${data.message}`);
    }

    const taskId = data.output?.task_id;
    if (!taskId) {
      throw new Error('百炼视频任务未返回 task_id');
    }
    return taskId;
  }

  async getVideoTask(taskId: string): Promise<RemoteVideoTask> {
    const url = `${this.videoApiBase}/tasks/${encodeURIComponent(taskId)}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    const raw = await resp.text();
    if (!resp.ok) {
      this.logger.error(`DashScope video poll failed (${resp.status}): ${raw}`);
      throw new Error(this.parseDashScopeError(raw, resp.status));
    }

    let data: {
      output?: {
        task_status?: string;
        video_url?: string;
        message?: string;
      };
      code?: string;
      message?: string;
    };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      throw new Error('百炼视频任务状态返回无法解析');
    }

    if (data.code && data.message) {
      return { state: 'failed', error: data.message };
    }

    const status = (data.output?.task_status ?? '').toUpperCase();
    if (status === 'SUCCEEDED') {
      const resultUrl = data.output?.video_url;
      return resultUrl
        ? { state: 'completed', progress: 100, resultUrl }
        : { state: 'failed', error: '百炼视频任务成功但未返回视频地址' };
    }
    if (['FAILED', 'CANCELED', 'CANCELLED', 'UNKNOWN'].includes(status)) {
      return {
        state: 'failed',
        error: data.output?.message ?? data.message ?? '百炼视频生成失败',
      };
    }
    return {
      state: status === 'RUNNING' ? 'running' : 'pending',
    };
  }

  private collectReferenceImages(input: VideoGenerationInput): string[] {
    const urls = [
      ...(input.referenceImageUrls ?? []),
      ...(input.imageUrl ? [input.imageUrl] : []),
    ]
      .map((value) => value.trim())
      .filter(Boolean);
    return [...new Set(urls)].slice(0, 9);
  }

  /** 百炼只能 GET 公网地址，本机/内网会创建任务后失败 */
  private isNonPublicMediaUrl(url: string): boolean {
    if (url.startsWith('data:')) return false;
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        return true;
      }
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) {
        return true;
      }
      return false;
    } catch {
      return true;
    }
  }

  /** 未写 [Image N] 时自动补前缀，对齐官方示例 */
  private ensureImageRefsInPrompt(prompt: string, imageCount: number): string {
    const text = prompt.trim();
    if (imageCount <= 0 || /\[Image\s*\d+\]/i.test(text)) return text;
    const refs = Array.from(
      { length: imageCount },
      (_, i) => `[Image ${i + 1}]`,
    ).join('');
    return `${refs}${text}`;
  }

  private parseDashScopeError(raw: string, status: number): string {
    try {
      const data = JSON.parse(raw) as { message?: string; code?: string };
      if (data.message) return `百炼 API 失败：${data.message}`;
    } catch {
      /* ignore */
    }
    return `百炼 API 调用失败 (${status})`;
  }

}
