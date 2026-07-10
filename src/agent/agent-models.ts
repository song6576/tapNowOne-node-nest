export const DEFAULT_AGENT_MODEL = 'qwen3.7-plus';

/** 内置白名单（数据库不可用时回退） */
export const AGENT_MODEL_IDS = [
  'qwen3.7-plus',
  'deepseek-v4-flash',
  'happyhorse-1.0-video-edit',
  'sambert-zhide-v1',
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
