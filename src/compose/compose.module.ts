import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GenerateModule } from '../generate/generate.module';
import { ComposeController } from './compose.controller';
import { ComposeService } from './compose.service';
import { FfmpegRunner } from './ffmpeg.runner';

@Module({
  imports: [AuthModule, GenerateModule],
  controllers: [ComposeController],
  providers: [ComposeService, FfmpegRunner],
  exports: [FfmpegRunner],
})
export class ComposeModule {}
