import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { AuthModule } from '../auth/auth.module';
import { GenerateController } from './generate.controller';
import { GenerateService } from './generate.service';
import { TaskStore } from './task-store';

@Module({
  imports: [AuthModule, AgentModule],
  controllers: [GenerateController],
  providers: [TaskStore, GenerateService],
})
export class GenerateModule {}
