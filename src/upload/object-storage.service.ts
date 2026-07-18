/**
 * 天翼云对象存储（S3 兼容）
 * - 桶保持私有；上传用预签名 PUT
 * - 生成物/素材对象设 public-read，对外用稳定 HTTPS（默认域名或 CDN）
 */
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HeadObjectCommand,
  PutObjectAclCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import type { UploadCategory } from './upload.constants';

export type PresignUploadResult = {
  key: string;
  upload_url: string;
  public_url: string;
  headers: Record<string, string>;
  expires_in: number;
};

@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    const accessKeyId = config.get<string>('CTYUN_AK')?.trim() ?? '';
    const secretAccessKey = config.get<string>('CTYUN_SK')?.trim() ?? '';
    const endpoint =
      config.get<string>('CTYUN_ENDPOINT')?.trim() ||
      'https://huadong-1.ctyunzos.cn';
    this.bucket =
      config.get<string>('CTYUN_BUCKET')?.trim() || 'bucket-220430';
    this.publicBase = (
      config.get<string>('CTYUN_PUBLIC_BASE')?.trim() ||
      `https://${this.bucket}.huadong-1.ctyunzos.cn`
    ).replace(/\/$/, '');
    const region =
      config.get<string>('CTYUN_REGION')?.trim() || 'huadong-1';
    const forcePathStyle =
      config.get<string>('CTYUN_FORCE_PATH_STYLE') === 'true';

    this.enabled = Boolean(accessKeyId && secretAccessKey);
    if (!this.enabled) {
      this.client = null;
      this.logger.warn('CTYUN_AK/SK 未配置，对象存储未启用，回退本地 uploads');
      return;
    }

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.logger.log(
      `对象存储已启用 bucket=${this.bucket} endpoint=${endpoint}`,
    );
  }

  isEnabled(): boolean {
    return this.enabled && this.client != null;
  }

  publicUrlForKey(key: string): string {
    return `${this.publicBase}/${key.replace(/^\//, '')}`;
  }

  buildObjectKey(params: {
    userId: number;
    category: UploadCategory | 'generated' | 'outputs';
    filename: string;
    projectId?: string;
    mimeType?: string;
  }): string {
    const ext =
      extname(params.filename).toLowerCase() ||
      this.extFromMime(params.mimeType ?? '');
    const name = `${randomUUID()}${ext}`;
    if (params.category === 'generated') {
      return `users/${params.userId}/generated/${name}`;
    }
    if (params.category === 'outputs') {
      return `users/${params.userId}/outputs/${name}`;
    }
    if (params.category === 'project' && params.projectId) {
      return `users/${params.userId}/projects/${params.projectId}/${name}`;
    }
    return `users/${params.userId}/${params.category}/${name}`;
  }

  async createPresignedPut(params: {
    key: string;
    contentType: string;
    expiresIn?: number;
  }): Promise<PresignUploadResult> {
    const client = this.requireClient();
    const expiresIn = params.expiresIn ?? 600;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
    });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn });
    return {
      key: params.key,
      upload_url: uploadUrl,
      public_url: this.publicUrlForKey(params.key),
      headers: { 'Content-Type': params.contentType },
      expires_in: expiresIn,
    };
  }

  /** 服务端直传（生成结果落桶等），并设对象公共读 */
  async putObjectPublic(params: {
    key: string;
    body: Buffer;
    contentType: string;
  }): Promise<string> {
    const client = this.requireClient();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType,
          ACL: 'public-read',
        }),
      );
    } catch (err) {
      // 部分兼容存储对 PutObject+ACL 支持不一致：先上传再单独设 ACL
      this.logger.warn(
        `PutObject ACL 失败，尝试无 ACL 上传后 PutObjectAcl: ${String(err)}`,
      );
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: params.key,
          Body: params.body,
          ContentType: params.contentType,
        }),
      );
      await this.makeObjectPublic(params.key);
    }
    return this.publicUrlForKey(params.key);
  }

  async makeObjectPublic(key: string): Promise<void> {
    const client = this.requireClient();
    await client.send(
      new PutObjectAclCommand({
        Bucket: this.bucket,
        Key: key,
        ACL: 'public-read',
      }),
    );
  }

  async assertObjectExists(key: string): Promise<void> {
    const client = this.requireClient();
    await client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException('对象存储未配置');
    }
    return this.client;
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
