import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectsModule } from '../projects/projects.module';
import { HomeController, TaptvController } from './taptv.controller';
import { TaptvService } from './taptv.service';

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [HomeController, TaptvController],
  providers: [TaptvService],
})
export class TaptvModule {}
