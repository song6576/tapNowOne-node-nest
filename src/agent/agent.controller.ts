import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgentChatDto, AgentStoryboardDto } from './dto/agent.dto';
import { AgentService } from './agent.service';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

@Controller('api/agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @UseGuards(OptionalJwtAuthGuard)
  async chat(
    @Body() dto: AgentChatDto,
    @Req() req: { user: User | null },
  ) {
    return this.agentService.chat(
      dto.message,
      dto.context,
      req.user ?? null,
      dto.conversationId,
      dto.projectId,
      dto.model,
      dto.auto ?? true,
    );
  }

  @Get('conversations/:id')
  @UseGuards(JwtAuthGuard)
  getConversation(@Param('id') id: string, @Req() req: { user: User }) {
    return this.agentService.getConversation(req.user.id, id);
  }

  @Post('storyboard')
  async storyboard(@Body() dto: AgentStoryboardDto) {
    const scenes = await this.agentService.storyboard(
      dto.script,
      dto.model,
      dto.auto ?? true,
    );
    return { scenes };
  }
}
