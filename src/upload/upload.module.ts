import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ObjectStorageService } from './object-storage.service';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [AuthModule],
  controllers: [UploadController],
  providers: [ObjectStorageService, UploadService],
  exports: [UploadService, ObjectStorageService],
})
export class UploadModule {}
