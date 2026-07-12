export const DEFAULT_AGENT_MODEL = 'qwen3.7-plus';
export const DEFAULT_IMAGE_MODEL = 'qwen-image-2.0-pro-2026-04-22';

/** 内置白名单（数据库不可用时回退） */
export const AGENT_MODEL_IDS = [
  'qwen3.7-plus',
  'deepseek-v4-flash',
  'happyhorse-1.0-video-edit',
  'sambert-zhide-v1',
  'qwen-image-2.0-pro-2026-04-22',
] as const;

const ALLOWED = new Set<string>([...AGENT_MODEL_IDS, DEFAULT_AGENT_MODEL]);

export function resolveAgentModel(
  model?: string,
  auto = true,
): string {
  if (auto || !model || model === 'auto') {
    return DEFAULT_AGENT_MODEL;
  }
  if (!ALLOWED.has(model)) {
    return DEFAULT_AGENT_MODEL;
  }
  return model;
}
