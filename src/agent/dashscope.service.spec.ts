import { ConfigService } from '@nestjs/config';
import { DashScopeService } from './dashscope.service';

describe('DashScopeService video', () => {
  let service: DashScopeService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new DashScopeService(
      new ConfigService({
        DASHSCOPE_API_KEY: 'sk-test',
        DASHSCOPE_VIDEO_BASE_URL:
          'https://llm-q7cqck0h4x1ffqdz.cn-beijing.maas.aliyuncs.com/api/v1',
      }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('creates HappyHorse async video task with parameters', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ output: { task_id: 'task-hh-1', task_status: 'PENDING' } }),
        { status: 200 },
      ),
    );

    await expect(
      service.createVideoTask('happyhorse-1.1-r2v', {
        prompt: '[Image 1] dancing',
        referenceImageUrls: ['https://cdn/a.jpg', 'https://cdn/b.jpg'],
        resolution: '720P',
        ratio: '16:9',
        duration: 5,
        watermark: false,
      }),
    ).resolves.toBe('task-hh-1');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://llm-q7cqck0h4x1ffqdz.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-DashScope-Async': 'enable',
        }),
        body: JSON.stringify({
          model: 'happyhorse-1.1-r2v',
          input: {
            prompt: '[Image 1] dancing',
            media: [
              { type: 'reference_image', url: 'https://cdn/a.jpg' },
              { type: 'reference_image', url: 'https://cdn/b.jpg' },
            ],
          },
          parameters: {
            resolution: '720P',
            ratio: '16:9',
            duration: 5,
            watermark: false,
          },
        }),
      }),
    );
  });

  it('maps DashScope task success and failure states', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: {
              task_status: 'SUCCEEDED',
              video_url: 'https://cdn/video.mp4',
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: { task_status: 'FAILED', message: 'blocked' },
          }),
          { status: 200 },
        ),
      );

    await expect(service.getVideoTask('task-1')).resolves.toEqual({
      state: 'completed',
      progress: 100,
      resultUrl: 'https://cdn/video.mp4',
    });
    await expect(service.getVideoTask('task-2')).resolves.toEqual({
      state: 'failed',
      error: 'blocked',
    });
  });
});
