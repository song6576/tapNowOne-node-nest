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
import { IsIn, IsOptional, IsUUID } from 'class-validator';
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

@Controller('api/uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 通用资源上传（画布项目素材：图片 / 视频 / 音频）
   * multipart: file + 可选 category=project + 可选 projectId
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
}
