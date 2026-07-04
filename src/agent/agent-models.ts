export const DEFAULT_AGENT_MODEL = 'qwen-plus';

/** 与前端 agentModels.ts 保持一致 */
export const AGENT_MODEL_IDS = [
  'qwen3.7-plus',
  'deepseek-v4-flash',
  'qwen3.6-flash-2026-04-16',
  'qwen3.5-ocr',
  'qwen3.6-35b-a3b',
  'qwen3.7-max-2026-05-17',
  'qwen3.7-max-2026-06-08',
  'glm-5.1',
  'qwen3.7-max-preview',
  'qwen3.5-plus-2026-04-20',
  'qwen3.6-max-preview',
  'qwen3.7-max',
  'glm-5.2',
  'kimi-k2.7-code',
  'kimi-k2.6',
  'qwen3.7-max-2026-05-20',
  'qwen3.7-plus-2026-05-26',
  'qwen3.6-flash',
  'deepseek-v4-pro',
  'qwen3.6-27b',
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
