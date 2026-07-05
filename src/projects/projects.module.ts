import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FoldersController } from './folders.controller';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController, FoldersController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
