import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { GenerateController } from './generate.controller';
import { GenerateService } from './generate.service';
import { TaskStore } from './task-store';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [GenerateController],
  providers: [TaskStore, GenerateService],
  exports: [TaskStore, GenerateService],
})
export class GenerateModule {}
