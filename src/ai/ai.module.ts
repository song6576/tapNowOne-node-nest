import { Module } from '@nestjs/common';
import { DashScopeService } from '../agent/dashscope.service';
import { ModelsModule } from '../models/models.module';
import { AiRouterService } from './ai-router.service';
import { ArkService } from './ark.service';

@Module({
  imports: [ModelsModule],
  providers: [DashScopeService, ArkService, AiRouterService],
  exports: [DashScopeService, ArkService, AiRouterService],
})
export class AiModule {}
