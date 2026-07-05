import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import {
  SavedUpload,
  UPLOAD_MAX_BYTES,
  UPLOAD_MIME,
  UploadCategory,
  UploadedFilePayload,
} from './upload.constants';

@Injectable()
export class UploadService {
  private readonly uploadRoot: string;

  constructor(config: ConfigService) {
    this.uploadRoot = config.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads'));
  }

  assertValidFile(
    file: UploadedFilePayload | undefined,
    category: UploadCategory,
  ): UploadedFilePayload {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请选择要上传的文件');
    }
    const allowed = UPLOAD_MIME[category];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `不支持的文件类型：${file.mimetype}（${category}）`,
      );
    }
    const max = UPLOAD_MAX_BYTES[category];
    if (file.size > max) {
      throw new BadRequestException(
        `文件过大，${category} 最大 ${Math.round(max / 1024 / 1024)}MB`,
      );
    }
    return file;
  }

  async saveFile(
    userId: number,
    category: UploadCategory,
    file: UploadedFilePayload,
    projectId?: string,
  ): Promise<SavedUpload> {
    this.assertValidFile(file, category);

    const ext = extname(file.originalname).toLowerCase() || this.extFromMime(file.mimetype);
    const storedName = `${randomUUID()}${ext}`;
    const subDir = projectId && category === 'project'
      ? join(String(userId), category, projectId)
      : join(String(userId), category);
    const dir = join(this.uploadRoot, subDir);
    await mkdir(dir, { recursive: true });

    const absPath = join(dir, storedName);
    await writeFile(absPath, file.buffer);

    const urlPath = projectId && category === 'project'
      ? `/uploads/${userId}/${category}/${projectId}/${storedName}`
      : `/uploads/${userId}/${category}/${storedName}`;

    return {
      url: urlPath,
      filename: file.originalname,
      mime_type: file.mimetype,
      size: file.size,
      category,
    };
  }

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/x-wav': '.wav',
      'audio/mp4': '.m4a',
      'audio/ogg': '.ogg',
    };
    return map[mime] ?? '';
  }
}
