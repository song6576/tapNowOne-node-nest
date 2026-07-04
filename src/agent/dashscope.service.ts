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

  private mockChat(messages: ChatMessage[]): string {
    const last = messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
    return `（Mock 模式）收到：${last.slice(0, 100)}。请在 backend-nest/.env 中配置 DASHSCOPE_API_KEY 后使用真实百炼对话。`;
  }
}
