import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { access, mkdir, mkdtemp, realpath, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { basename, extname, join, resolve, sep } from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import type { ComposeDto } from './dto/compose.dto';

type CaptionOverlay = {
  path: string;
  start: number;
  end: number;
};

@Injectable()
export class FfmpegRunner {
  private readonly logger = new Logger(FfmpegRunner.name);
  private readonly uploadRoot: string;
  private readonly publicBase: string;
  private readonly ffmpegPath: string;

  constructor(private readonly config: ConfigService) {
    this.uploadRoot = resolve(
      config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads')),
    );
    this.publicBase = (
      config.get<string>('PUBLIC_BASE_URL') ||
      `http://127.0.0.1:${config.get<number>('PORT', 3000)}`
    ).replace(/\/$/, '');
    this.ffmpegPath = config.get<string>('FFMPEG_PATH', 'ffmpeg');
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.run(['-version']);
      return true;
    } catch {
      return false;
    }
  }

  async compose(
    timeline: ComposeDto,
    userId: number,
    onProgress?: (progress: number) => Promise<void>,
  ): Promise<string> {
    const totalDuration = timeline.clips.reduce(
      (sum, clip) => sum + clip.duration,
      0,
    );
    if (totalDuration > 30 * 60) {
      throw new BadRequestException('合成总时长不能超过 30 分钟');
    }

    const tempDir = await mkdtemp(join(tmpdir(), 'tapnow-compose-'));
    try {
      const normalized: string[] = [];
      for (let index = 0; index < timeline.clips.length; index += 1) {
        const clip = timeline.clips[index];
        const input = await this.resolveMedia(
          clip.url,
          tempDir,
          `clip-input-${index}`,
        );
        const output = join(
          tempDir,
          `clip-${String(index).padStart(4, '0')}.mp4`,
        );
        await this.normalizeClip(input, output, clip, timeline);
        normalized.push(output);
        await onProgress?.(
          10 + Math.round(((index + 1) / timeline.clips.length) * 45),
        );
      }

      const concatList = normalized
        .map((path) => `file '${path.replace(/'/g, "'\\''")}'`)
        .join('\n');
      const concatFile = join(tempDir, 'concat.txt');
      const baseVideo = join(tempDir, 'base.mp4');
      await writeFile(concatFile, concatList, 'utf8');
      await this.run([
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatFile,
        '-c',
        'copy',
        baseVideo,
      ]);
      await onProgress?.(65);

      const audioInputs: string[] = [];
      for (let index = 0; index < timeline.audio_tracks.length; index += 1) {
        audioInputs.push(
          await this.resolveMedia(
            timeline.audio_tracks[index].url,
            tempDir,
            `audio-${index}`,
          ),
        );
      }

      const captionOverlays = await this.renderCaptionImages(
        timeline,
        totalDuration,
        tempDir,
      );

      const outputDir = join(this.uploadRoot, 'outputs', String(userId));
      await mkdir(outputDir, { recursive: true });
      const outputName = `${randomUUID()}.mp4`;
      const outputPath = join(outputDir, outputName);

      await this.renderFinal(
        baseVideo,
        audioInputs,
        captionOverlays,
        outputPath,
        timeline,
        totalDuration,
        tempDir,
      );
      await onProgress?.(100);
      return `/uploads/outputs/${userId}/${outputName}`;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async normalizeClip(
    input: string,
    output: string,
    clip: ComposeDto['clips'][number],
    timeline: ComposeDto,
  ) {
    const commonFilter = [
      `scale=${timeline.width}:${timeline.height}:force_original_aspect_ratio=decrease`,
      `pad=${timeline.width}:${timeline.height}:(ow-iw)/2:(oh-ih)/2:color=black`,
      `fps=${timeline.fps}`,
      `format=yuv420p`,
    ];
    const args = ['-y'];
    if (clip.type === 'image') {
      args.push('-loop', '1', '-framerate', String(timeline.fps));
    }
    args.push('-i', input);
    if (clip.type === 'video') {
      commonFilter.push(
        `tpad=stop_mode=clone:stop_duration=${clip.duration.toFixed(3)}`,
      );
    }
    args.push(
      '-t',
      clip.duration.toFixed(3),
      '-vf',
      commonFilter.join(','),
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-movflags',
      '+faststart',
      output,
    );
    await this.run(args);
  }

  private async renderFinal(
    baseVideo: string,
    audioInputs: string[],
    captionOverlays: CaptionOverlay[],
    outputPath: string,
    timeline: ComposeDto,
    totalDuration: number,
    cwd: string,
  ) {
    const args = ['-y', '-i', baseVideo];
    for (const input of audioInputs) args.push('-i', input);
    for (const caption of captionOverlays) {
      args.push('-loop', '1', '-i', caption.path);
    }

    const filters: string[] = [];
    let videoSource = '[0:v]';
    captionOverlays.forEach((caption, index) => {
      const inputIndex = 1 + audioInputs.length + index;
      const outputLabel = `vcap${index}`;
      filters.push(
        `${videoSource}[${inputIndex}:v]overlay=0:0:enable='between(t,${caption.start.toFixed(3)},${caption.end.toFixed(3)})'[${outputLabel}]`,
      );
      videoSource = `[${outputLabel}]`;
    });
    let videoMap = '0:v';
    if (captionOverlays.length) {
      videoMap = videoSource;
    }

    let audioMap: string | undefined;
    const audioLabels: string[] = [];
    timeline.audio_tracks.forEach((track, index) => {
      const delay = Math.max(0, Math.round(track.start * 1000));
      const label = `a${index}`;
      filters.push(
        `[${index + 1}:a]adelay=${delay}|${delay},volume=${track.volume},apad,atrim=0:${totalDuration.toFixed(3)}[${label}]`,
      );
      audioLabels.push(`[${label}]`);
    });
    if (audioLabels.length) {
      filters.push(
        `${audioLabels.join('')}amix=inputs=${audioLabels.length}:normalize=0:dropout_transition=2[aout]`,
      );
      audioMap = '[aout]';
    }

    if (filters.length) args.push('-filter_complex', filters.join(';'));
    args.push('-map', videoMap);
    if (audioMap) args.push('-map', audioMap);
    args.push(
      '-t',
      totalDuration.toFixed(3),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-pix_fmt',
      'yuv420p',
    );
    if (audioMap) args.push('-c:a', 'aac', '-b:a', '192k');
    args.push('-movflags', '+faststart', outputPath);
    await this.run(args, cwd);
  }

  /** 使用 Sharp 把字幕渲染成透明 PNG，再由 FFmpeg overlay；不依赖 libass。 */
  private async renderCaptionImages(
    timeline: ComposeDto,
    totalDuration: number,
    tempDir: string,
  ): Promise<CaptionOverlay[]> {
    const fontSize = Math.max(20, Math.round(timeline.height * 0.042));
    const valid = timeline.captions.filter(
      (caption) =>
        caption.text.trim() &&
        caption.end > caption.start &&
        caption.start < totalDuration,
    );
    const overlays: CaptionOverlay[] = [];
    for (let index = 0; index < valid.length; index += 1) {
      const caption = valid[index];
      const lines = this.wrapCaption(
        caption.text,
        Math.max(12, Math.floor(timeline.width / fontSize) - 4),
      );
      const lineHeight = Math.round(fontSize * 1.35);
      const boxHeight = lines.length * lineHeight + 28;
      const boxWidth = Math.round(timeline.width * 0.84);
      const boxX = Math.round((timeline.width - boxWidth) / 2);
      const boxY = timeline.height - boxHeight - 36;
      const spans = lines
        .map(
          (line, lineIndex) =>
            `<tspan x="${timeline.width / 2}" y="${boxY + 20 + fontSize + lineIndex * lineHeight}">${this.escapeXml(line)}</tspan>`,
        )
        .join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${timeline.width}" height="${timeline.height}">
<rect width="100%" height="100%" fill="none"/>
<rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="12" fill="rgba(0,0,0,0.58)"/>
<text text-anchor="middle" font-family="Arial, PingFang SC, Noto Sans CJK SC, sans-serif" font-size="${fontSize}" fill="white">${spans}</text>
</svg>`;
      const path = join(tempDir, `caption-${index}.png`);
      await sharp(Buffer.from(svg)).png().toFile(path);
      overlays.push({
        path,
        start: caption.start,
        end: Math.min(caption.end, totalDuration),
      });
    }
    return overlays;
  }

  private wrapCaption(text: string, maxChars: number): string[] {
    const source = text.replace(/\s+/g, ' ').trim();
    const lines: string[] = [];
    for (
      let offset = 0;
      offset < source.length && lines.length < 3;
      offset += maxChars
    ) {
      lines.push(source.slice(offset, offset + maxChars));
    }
    if (source.length > maxChars * 3 && lines.length) {
      lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
    }
    return lines;
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private async resolveMedia(
    url: string,
    tempDir: string,
    name: string,
  ): Promise<string> {
    const publicUrl = new URL(this.publicBase);
    let parsed: URL | undefined;
    try {
      parsed = new URL(url, this.publicBase);
    } catch {
      throw new BadRequestException('媒体地址无效');
    }

    if (
      url.startsWith('/uploads/') ||
      (parsed.origin === publicUrl.origin &&
        parsed.pathname.startsWith('/uploads/'))
    ) {
      const relative = decodeURIComponent(
        parsed.pathname.slice('/uploads/'.length),
      );
      const candidate = resolve(this.uploadRoot, relative);
      const root = await realpath(this.uploadRoot);
      const actual = await realpath(candidate);
      if (actual !== root && !actual.startsWith(`${root}${sep}`)) {
        throw new BadRequestException('媒体路径越界');
      }
      await access(actual);
      return actual;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException(
        '仅支持项目 uploads 或允许域名的 HTTPS 媒体',
      );
    }
    const allowedHosts = new Set(
      (this.config.get<string>('COMPOSE_REMOTE_HOSTS', '') ?? '')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
    );
    if (!allowedHosts.has(parsed.hostname.toLowerCase())) {
      throw new BadRequestException(
        `不允许读取远程媒体域名：${parsed.hostname}`,
      );
    }

    const response = await fetch(parsed, {
      signal: AbortSignal.timeout(
        this.config.get<number>('MEDIA_DOWNLOAD_TIMEOUT_MS', 180_000),
      ),
    });
    if (!response.ok) {
      throw new BadRequestException(`远程媒体下载失败 (${response.status})`);
    }
    const maxBytes = this.config.get<number>(
      'MEDIA_DOWNLOAD_MAX_BYTES',
      250 * 1024 * 1024,
    );
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new BadRequestException('远程媒体超过大小限制');
    }
    const suffix = extname(parsed.pathname) || extname(basename(url)) || '.bin';
    const target = join(tempDir, `${name}${suffix}`);
    await writeFile(target, buffer);
    return target;
  }

  private run(args: string[], cwd?: string): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      const child = spawn(this.ffmpegPath, args, {
        cwd,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = `${stderr}${chunk.toString()}`.slice(-12_000);
      });
      child.once('error', (error) => {
        reject(
          new Error(
            error.message.includes('ENOENT')
              ? '服务器未安装 FFmpeg 或 FFMPEG_PATH 配置错误'
              : `FFmpeg 启动失败：${error.message}`,
          ),
        );
      });
      child.once('close', (code) => {
        if (code === 0) resolvePromise();
        else {
          this.logger.error(`FFmpeg failed (${code}): ${stderr}`);
          reject(new Error(`FFmpeg 合成失败 (${code})`));
        }
      });
    });
  }
}
