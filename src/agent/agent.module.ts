import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { DashScopeService } from './dashscope.service';

@Module({
  imports: [AuthModule],
  controllers: [AgentController],
  providers: [DashScopeService, AgentService],
  exports: [DashScopeService],
})
export class AgentModule {}
