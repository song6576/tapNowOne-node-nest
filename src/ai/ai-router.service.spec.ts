import type { DashScopeService } from '../agent/dashscope.service';
import type { ModelsService } from '../models/models.service';
import { AiRouterService } from './ai-router.service';
import type { ArkService } from './ark.service';

describe('AiRouterService', () => {
  const models = {
    resolveModel: jest.fn(),
  };
  const dashscope = {
    isConfigured: true,
    chatCompletion: jest.fn(),
    generateImage: jest.fn(),
    createVideoTask: jest.fn(),
    getVideoTask: jest.fn(),
  };
  const ark = {
    isConfigured: true,
    chatCompletion: jest.fn(),
    generateImage: jest.fn(),
    createVideoTask: jest.fn(),
    getVideoTask: jest.fn(),
  };

  const service = new AiRouterService(
    models as unknown as ModelsService,
    dashscope as unknown as DashScopeService,
    ark as unknown as ArkService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('routes text models to Ark from database provider metadata', async () => {
    models.resolveModel.mockResolvedValue({
      slug: 'deepseek-v4-flash-260425',
      category: 'text',
      provider: 'ark',
      providerModelId: 'deepseek-v4-flash-260425',
    });
    ark.chatCompletion.mockResolvedValue('ark reply');

    await expect(
      service.chat(
        [{ role: 'user', content: 'hello' }],
        'deepseek-v4-flash-260425',
        false,
      ),
    ).resolves.toBe('ark reply');
    expect(dashscope.chatCompletion).not.toHaveBeenCalled();
  });

  it('keeps existing DashScope image models working', async () => {
    models.resolveModel.mockResolvedValue({
      slug: 'qwen-image',
      category: 'image',
      provider: 'dashscope',
      providerModelId: 'qwen-image',
    });
    dashscope.generateImage.mockResolvedValue('https://cdn/qwen.png');

    await expect(
      service.generateImage('qwen-image', false, { prompt: 'cat' }),
    ).resolves.toEqual({
      provider: 'dashscope',
      url: 'https://cdn/qwen.png',
    });
  });

  it('routes DashScope video models to HappyHorse API', async () => {
    models.resolveModel.mockResolvedValue({
      slug: 'happyhorse-1.1-r2v',
      category: 'video',
      provider: 'dashscope',
      providerModelId: 'happyhorse-1.1-r2v',
    });
    dashscope.createVideoTask.mockResolvedValue('task-hh-1');

    await expect(
      service.createVideo('happyhorse-1.1-r2v', false, {
        prompt: 'test',
        resolution: '1080P',
        ratio: '9:16',
        duration: 8,
        watermark: true,
      }),
    ).resolves.toEqual({ provider: 'dashscope', taskId: 'task-hh-1' });
    expect(dashscope.createVideoTask).toHaveBeenCalledWith(
      'happyhorse-1.1-r2v',
      expect.objectContaining({
        resolution: '1080P',
        ratio: '9:16',
        duration: 8,
        watermark: true,
      }),
    );
  });
});
