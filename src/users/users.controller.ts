import {
  Body,
  Controller,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { UploadService } from '../upload/upload.service';
import type { UploadedFilePayload } from '../upload/upload.constants';
import { UpdateUserProfileDto } from './dto/update-user.dto';

@Controller('api/users/me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly authService: AuthService,
  ) {}

  @Patch()
  updateProfile(
    @Body() dto: UpdateUserProfileDto,
    @Req() req: { user: User },
  ) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @UploadedFile() file: UploadedFilePayload,
    @Req() req: { user: User },
  ) {
    const saved = await this.uploadService.saveFile(
      req.user.id,
      'avatar',
      this.uploadService.assertValidFile(file, 'avatar'),
    );
    const user = await this.authService.updateAvatar(req.user.id, saved.url);
    return { url: saved.url, user };
  }

  @Post('banner')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBanner(
    @UploadedFile() file: UploadedFilePayload,
    @Req() req: { user: User },
  ) {
    const saved = await this.uploadService.saveFile(
      req.user.id,
      'banner',
      this.uploadService.assertValidFile(file, 'banner'),
    );
    const user = await this.authService.updateBanner(req.user.id, saved.url);
    return { url: saved.url, banner_url: saved.url, user };
  }
}
