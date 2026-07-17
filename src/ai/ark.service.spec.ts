import { ConfigService } from '@nestjs/config';
import { ArkService } from './ark.service';

describe('ArkService', () => {
  let service: ArkService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new ArkService(
      new ConfigService({
        ARK_API_KEY: 'ark-test-key',
        ARK_BASE_URL: 'https://ark.example/api/v3',
      }),
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('parses chat completion content', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: 'hello' } }],
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.chatCompletion([{ role: 'user', content: 'hi' }], 'deepseek'),
    ).resolves.toBe('hello');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://ark.example/api/v3/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('parses image URL', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ url: 'https://cdn/image.png' }] }),
        {
          status: 200,
        },
      ),
    );

    await expect(
      service.generateImage('seedream', { prompt: 'cat' }),
    ).resolves.toBe('https://cdn/image.png');
  });

  it('maps Seedance success and failure states', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'succeeded',
            content: { video_url: 'https://cdn/video.mp4' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'failed',
            error: { message: 'blocked' },
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
