import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  get mockMode(): boolean {
    const forced = this.config.get<string>('MOCK_MODE', '').toLowerCase();
    if (forced === '1' || forced === 'true' || forced === 'yes') return true;
    return !this.isConfigured;
  }

  /** 多模态生图 API 根路径，可配成 Workspace 专属域名 */
  private get apiBase(): string {
    return (
      this.config.get<string>('DASHSCOPE_BASE_URL') ||
      'https://dashscope.aliyuncs.com/api/v1'
    ).replace(/\/$/, '');
  }

  async chatCompletion(
    messages: ChatMessage[],
    model?: string,
  ): Promise<string> {
    if (this.mockMode) {
      return this.mockChat(messages);
    }

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

  private parseDashScopeError(raw: string, status: number): string {
    try {
      const data = JSON.parse(raw) as { message?: string; code?: string };
      if (data.message) return `百炼 API 失败：${data.message}`;
    } catch {
      /* ignore */
    }
    return `百炼 API 调用失败 (${status})`;
  }

  private mockChat(messages: ChatMessage[]): string {
    const last = messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    return `（Mock 模式）收到：${last.slice(0, 100)}。请在 backend-nest/.env 中配置 DASHSCOPE_API_KEY 后使用真实百炼对话。`;
  }
}
