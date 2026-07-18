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
import { ObjectStorageService } from './object-storage.service';

@Injectable()
export class UploadService {
  private readonly uploadRoot: string;

  constructor(
    config: ConfigService,
    private readonly objectStorage: ObjectStorageService,
  ) {
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

  assertPresignMeta(params: {
    category: UploadCategory;
    contentType: string;
    size?: number;
  }) {
    const allowed = UPLOAD_MIME[params.category];
    if (!allowed.includes(params.contentType)) {
      throw new BadRequestException(
        `不支持的文件类型：${params.contentType}（${params.category}）`,
      );
    }
    if (params.size != null) {
      const max = UPLOAD_MAX_BYTES[params.category];
      if (params.size > max) {
        throw new BadRequestException(
          `文件过大，${params.category} 最大 ${Math.round(max / 1024 / 1024)}MB`,
        );
      }
    }
  }

  /**
   * 预签名直传：前端拿 upload_url PUT 到天翼云，再调 complete 开公共读。
   */
  async createPresignedUpload(params: {
    userId: number;
    category: UploadCategory;
    filename: string;
    contentType: string;
    size?: number;
    projectId?: string;
  }) {
    if (!this.objectStorage.isEnabled()) {
      throw new BadRequestException('对象存储未启用，请使用 multipart 上传');
    }
    this.assertPresignMeta({
      category: params.category,
      contentType: params.contentType,
      size: params.size,
    });
    const key = this.objectStorage.buildObjectKey({
      userId: params.userId,
      category: params.category,
      filename: params.filename,
      projectId: params.projectId,
      mimeType: params.contentType,
    });
    return this.objectStorage.createPresignedPut({
      key,
      contentType: params.contentType,
    });
  }

  /**
   * 直传完成后：确认对象存在并设公共读，返回稳定 HTTPS。
   */
  async completePresignedUpload(params: {
    userId: number;
    key: string;
    filename?: string;
    mimeType?: string;
    size?: number;
    category?: UploadCategory;
  }): Promise<SavedUpload> {
    if (!this.objectStorage.isEnabled()) {
      throw new BadRequestException('对象存储未启用');
    }
    const prefix = `users/${params.userId}/`;
    if (!params.key.startsWith(prefix) || params.key.includes('..')) {
      throw new BadRequestException('无效的对象 key');
    }
    await this.objectStorage.assertObjectExists(params.key);
    try {
      await this.objectStorage.makeObjectPublic(params.key);
    } catch {
      // 若桶策略已允许读，ACL 失败仍返回 URL
    }
    const category = params.category ?? 'project';
    return {
      url: this.objectStorage.publicUrlForKey(params.key),
      key: params.key,
      filename: params.filename ?? params.key.split('/').pop() ?? 'file',
      mime_type: params.mimeType ?? 'application/octet-stream',
      size: params.size ?? 0,
      category,
    };
  }

  async saveFile(
    userId: number,
    category: UploadCategory,
    file: UploadedFilePayload,
    projectId?: string,
  ): Promise<SavedUpload> {
    this.assertValidFile(file, category);

    if (this.objectStorage.isEnabled()) {
      const key = this.objectStorage.buildObjectKey({
        userId,
        category,
        filename: file.originalname,
        projectId,
        mimeType: file.mimetype,
      });
      const url = await this.objectStorage.putObjectPublic({
        key,
        body: file.buffer,
        contentType: file.mimetype,
      });
      return {
        url,
        key,
        filename: file.originalname,
        mime_type: file.mimetype,
        size: file.size,
        category,
      };
    }

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

  /** 生成结果等服务端 buffer 落桶（或本地） */
  async persistGeneratedBuffer(params: {
    userId: number;
    buffer: Buffer;
    contentType: string;
    kind: 'image' | 'video';
  }): Promise<string> {
    const ext = this.extFromMime(params.contentType) || (params.kind === 'video' ? '.mp4' : '.png');
    const filename = `${randomUUID()}${ext}`;

    if (this.objectStorage.isEnabled()) {
      const key = this.objectStorage.buildObjectKey({
        userId: params.userId,
        category: 'generated',
        filename,
        mimeType: params.contentType,
      });
      return this.objectStorage.putObjectPublic({
        key,
        body: params.buffer,
        contentType: params.contentType || (params.kind === 'video' ? 'video/mp4' : 'image/png'),
      });
    }

    const dir = join(this.uploadRoot, 'generated');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), params.buffer);
    return `/uploads/generated/${filename}`;
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
