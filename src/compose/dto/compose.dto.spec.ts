import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ComposeDto } from './compose.dto';

describe('ComposeDto', () => {
  it('accepts a valid dynamic timeline', async () => {
    const dto = plainToInstance(ComposeDto, {
      clips: [
        {
          node_id: 'video-1',
          url: '/uploads/generated/a.mp4',
          type: 'video',
          duration: 5,
        },
      ],
      captions: [{ text: '字幕', start: 0, end: 5 }],
      audio_tracks: [{ url: '/uploads/generated/a.mp3', start: 0, volume: 1 }],
      width: 1280,
      height: 720,
      fps: 30,
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects an empty timeline and unsafe dimensions', async () => {
    const dto = plainToInstance(ComposeDto, {
      clips: [],
      captions: [],
      audio_tracks: [],
      width: 100,
      height: 100,
      fps: 120,
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['clips', 'width', 'height', 'fps']),
    );
  });
});
