import {
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadService } from './upload.service';
import type { UploadedFilePayload } from './upload.constants';

class UploadBodyDto {
  @IsOptional()
  @IsIn(['project', 'avatar', 'banner'])
  category?: 'project' | 'avatar' | 'banner';

  @IsOptional()
  @IsUUID()
  projectId?: string;
}

class PresignBodyDto {
  @IsString()
  @MaxLength(255)
  filename!: string;

  @IsString()
  @MaxLength(128)
  content_type!: string;

  @IsOptional()
  @IsIn(['project', 'avatar', 'banner'])
  category?: 'project' | 'avatar' | 'banner';

  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  size?: number;
}

class CompleteBodyDto {
  @IsString()
  @MaxLength(512)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  mime_type?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;

  @IsOptional()
  @IsIn(['project', 'avatar', 'banner'])
  category?: 'project' | 'avatar' | 'banner';
}

@Controller('api/uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 通用资源上传（画布项目素材：图片 / 视频 / 音频）
   * multipart: file + 可选 category=project + 可选 projectId
   * 若已配置天翼云，则落到对象存储并返回稳定 HTTPS。
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: UploadedFilePayload,
    @Body() body: UploadBodyDto,
    @Req() req: { user: User },
  ) {
    const category = body.category ?? 'project';
    return this.uploadService.saveFile(
      req.user.id,
      category,
      this.uploadService.assertValidFile(file, category),
      body.projectId,
    );
  }

  /**
   * 预签名上传凭证（前端直传对象存储）
   * POST /api/uploads/presign
   */
  @Post('presign')
  async presign(@Body() body: PresignBodyDto, @Req() req: { user: User }) {
    return this.uploadService.createPresignedUpload({
      userId: req.user.id,
      category: body.category ?? 'project',
      filename: body.filename,
      contentType: body.content_type,
      size: body.size,
      projectId: body.project_id,
    });
  }

  /**
   * 直传完成：校验对象并设公共读，返回稳定 HTTPS
   * POST /api/uploads/complete
   */
  @Post('complete')
  async complete(@Body() body: CompleteBodyDto, @Req() req: { user: User }) {
    return this.uploadService.completePresignedUpload({
      userId: req.user.id,
      key: body.key,
      filename: body.filename,
      mimeType: body.mime_type,
      size: body.size,
      category: body.category,
    });
  }
}
