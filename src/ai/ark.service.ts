import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AiChatMessage,
  ImageGenerationInput,
  RemoteVideoTask,
  VideoGenerationInput,
} from './ai.types';

@Injectable()
export class ArkService {
  private readonly logger = new Logger(ArkService.name);

  constructor(private readonly config: ConfigService) {}

  get apiKey(): string {
    return this.config.get<string>('ARK_API_KEY', '').trim();
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private get baseUrl(): string {
    return (
      this.config.get<string>(
        'ARK_BASE_URL',
        'https://ark.cn-beijing.volces.com/api/v3',
      ) ?? 'https://ark.cn-beijing.volces.com/api/v3'
    ).replace(/\/$/, '');
  }

  private get timeoutMs(): number {
    return this.config.get<number>('ARK_REQUEST_TIMEOUT_MS', 120_000);
  }

  async chatCompletion(
    messages: AiChatMessage[],
    model: string,
  ): Promise<string> {
    const data = await this.request<{
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    }>('/chat/completions', {
      model,
      messages,
      temperature: 0.7,
    });
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(data.error?.message ?? '方舟文本模型未返回有效内容');
    }
    return content;
  }

  async generateImage(
    model: string,
    input: ImageGenerationInput,
  ): Promise<string> {
    const size = this.normalizeImageSize(input.size);
    const data = await this.request<{
      data?: Array<{ url?: string; b64_json?: string }>;
      error?: { message?: string };
    }>('/images/generations', {
      model,
      prompt: input.prompt,
      ...(input.imageUrl ? { image: input.imageUrl } : {}),
      size,
      response_format: 'url',
      watermark: false,
    });
    const first = data.data?.[0];
    if (first?.url) return first.url;
    if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
    throw new Error(data.error?.message ?? '方舟图片模型未返回图片');
  }

  async createVideoTask(
    model: string,
    input: VideoGenerationInput,
  ): Promise<string> {
    const content: Array<Record<string, unknown>> = [
      { type: 'text', text: input.prompt },
    ];
    if (input.imageUrl) {
      content.push({
        type: 'image_url',
        image_url: { url: input.imageUrl },
        role: 'first_frame',
      });
    }

    const data = await this.request<{
      id?: string;
      error?: { message?: string };
    }>('/contents/generations/tasks', {
      model,
      content,
      duration: input.duration ?? 5,
      ratio: input.ratio ?? '16:9',
      resolution: (input.resolution ?? '720P').toLowerCase(),
      watermark: input.watermark ?? false,
    });
    if (!data.id) {
      throw new Error(data.error?.message ?? '方舟视频任务创建失败');
    }
    return data.id;
  }

  async getVideoTask(taskId: string): Promise<RemoteVideoTask> {
    const data = await this.get<{
      status?: string;
      progress?: number;
      content?: { video_url?: string };
      error?: { message?: string; code?: string };
    }>(`/contents/generations/tasks/${encodeURIComponent(taskId)}`);

    if (data.status === 'succeeded') {
      const resultUrl = data.content?.video_url;
      return resultUrl
        ? { state: 'completed', progress: 100, resultUrl }
        : { state: 'failed', error: '方舟视频任务成功但未返回视频地址' };
    }
    if (['failed', 'expired', 'cancelled'].includes(data.status ?? '')) {
      return {
        state: 'failed',
        error:
          data.error?.message ??
          `方舟视频任务${data.status === 'expired' ? '已过期' : '失败'}`,
      };
    }
    return {
      state: data.status === 'running' ? 'running' : 'pending',
      progress: data.progress,
    };
  }

  private normalizeImageSize(size?: string): string {
    if (!size) return '2048x2048';
    return size.replace('*', 'x').toLowerCase();
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    if (!this.isConfigured) throw new Error('ARK_API_KEY 未配置');
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return this.parseResponse<T>(response, path);
  }

  private async get<T>(path: string): Promise<T> {
    if (!this.isConfigured) throw new Error('ARK_API_KEY 未配置');
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    return this.parseResponse<T>(response, path);
  }

  private async parseResponse<T>(response: Response, path: string): Promise<T> {
    const raw = await response.text();
    if (!response.ok) {
      this.logger.error(
        `Ark request ${path} failed (${response.status}): ${raw.slice(0, 2000)}`,
      );
      let message = '';
      try {
        const parsed = JSON.parse(raw) as {
          error?: { message?: string };
          message?: string;
        };
        message = parsed.error?.message ?? parsed.message ?? '';
      } catch {
        // 非 JSON 错误由状态码兜底
      }
      throw new Error(
        message
          ? `方舟 API 失败：${message}`
          : `方舟 API 调用失败 (${response.status})`,
      );
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error('方舟 API 返回无法解析');
    }
  }
}
