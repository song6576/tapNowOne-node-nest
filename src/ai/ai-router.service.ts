import { BadRequestException, Injectable } from '@nestjs/common';
import { DashScopeService } from '../agent/dashscope.service';
import { type AiModelCategory, ModelsService } from '../models/models.service';
import { ArkService } from './ark.service';
import type {
  AiChatMessage,
  ImageGenerationInput,
  RemoteVideoTask,
  ResolvedAiModel,
  VideoGenerationInput,
} from './ai.types';

const DEFAULT_MODELS: Record<AiModelCategory, string> = {
  text: 'qwen3.7-plus',
  image: 'qwen-image-2.0-pro-2026-04-22',
  video: 'happyhorse-1.1-r2v',
  audio: 'sambert-zhide-v1',
};

@Injectable()
export class AiRouterService {
  constructor(
    private readonly models: ModelsService,
    private readonly dashscope: DashScopeService,
    private readonly ark: ArkService,
  ) {}

  get providersConfigured() {
    return {
      dashscope: this.dashscope.isConfigured,
      ark: this.ark.isConfigured,
    };
  }

  async chat(
    messages: AiChatMessage[],
    model?: string,
    auto = true,
  ): Promise<string> {
    const resolved = await this.resolve('text', model, auto);
    if (resolved.provider === 'dashscope') {
      return this.dashscope.chatCompletion(messages, resolved.providerModelId);
    }
    if (resolved.provider === 'ark') {
      return this.ark.chatCompletion(messages, resolved.providerModelId);
    }
    throw new BadRequestException(`不支持的 AI provider：${resolved.provider}`);
  }

  async generateImage(
    model: string | undefined,
    auto: boolean,
    input: ImageGenerationInput,
  ): Promise<{ provider: string; url: string }> {
    const resolved = await this.resolve('image', model, auto);
    const url =
      resolved.provider === 'dashscope'
        ? await this.dashscope.generateImage({
            model: resolved.providerModelId,
            ...input,
          })
        : resolved.provider === 'ark'
          ? await this.ark.generateImage(resolved.providerModelId, input)
          : null;
    if (!url) {
      throw new BadRequestException(`模型 ${resolved.slug} 不支持图片生成`);
    }
    return { provider: resolved.provider, url };
  }

  async createVideo(
    model: string | undefined,
    auto: boolean,
    input: VideoGenerationInput,
  ): Promise<{ provider: string; taskId: string }> {
    const resolved = await this.resolve('video', model, auto);
    if (resolved.provider === 'dashscope') {
      const taskId = await this.dashscope.createVideoTask(
        resolved.providerModelId,
        input,
      );
      return { provider: resolved.provider, taskId };
    }
    if (resolved.provider === 'ark') {
      const taskId = await this.ark.createVideoTask(
        resolved.providerModelId,
        input,
      );
      return { provider: resolved.provider, taskId };
    }
    throw new BadRequestException(`模型 ${resolved.slug} 暂未接入视频生成`);
  }

  async getVideoTask(
    provider: string,
    providerTaskId: string,
  ): Promise<RemoteVideoTask> {
    if (provider === 'dashscope') {
      return this.dashscope.getVideoTask(providerTaskId);
    }
    if (provider === 'ark') return this.ark.getVideoTask(providerTaskId);
    throw new BadRequestException(`不支持的视频 provider：${provider}`);
  }

  async resolve(
    category: AiModelCategory,
    model?: string,
    auto = true,
  ): Promise<ResolvedAiModel> {
    const slug =
      auto || !model || model === 'auto' ? DEFAULT_MODELS[category] : model;
    const row = await this.models.resolveModel(slug, category);
    if (!row) {
      throw new BadRequestException(
        `模型 ${slug} 不存在、未启用或不支持 ${category} 节点`,
      );
    }
    return {
      slug: row.slug,
      category: row.category,
      provider: row.provider,
      providerModelId: row.providerModelId,
    };
  }
}
