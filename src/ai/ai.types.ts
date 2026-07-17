import type { AiModelCategory } from '../models/models.service';

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant'; // 角色：系统、用户、助手
  content: string;
};

export type ResolvedAiModel = {
  slug: string; // 模型ID
  category: AiModelCategory; // 模型分类
  provider: string; // 模型提供商
  providerModelId: string; // 模型提供商模型ID
};

export type ImageGenerationInput = {
  prompt: string; // 图片描述
  imageUrl?: string; // 参考图片URL
  size?: string; // 图片尺寸，如：1024x1024
};

export type VideoGenerationInput = {
  prompt: string; // 视频描述
  imageUrl?: string; // 参考图片URL
  referenceImageUrls?: string[]; // 参考图片URLs
  duration?: number; // 视频时长
  ratio?: string; // 视频比例，如：16:9
  resolution?: string; // 视频分辨率，如：1920x1080
  watermark?: boolean; // 是否添加水印，如：true
};

export type RemoteVideoTask = {
  state: 'pending' | 'running' | 'completed' | 'failed'; // 任务状态：pending、running、completed、failed
  progress?: number; // 任务进度
  resultUrl?: string; // 任务结果URL
  error?: string; // 任务错误信息
};
