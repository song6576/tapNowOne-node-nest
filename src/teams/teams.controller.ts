import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateTeamDto,
  SwitchActiveTeamDto,
  UpdateInviteLinkDto,
} from './dto/teams.dto';
import { TeamsService } from './teams.service';

@Controller('api/teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get('invites/:token')
  previewInvite(@Param('token') token: string) {
    return this.teamsService.previewInvite(token);
  }

  @Post('invites/:token/accept')
  @UseGuards(JwtAuthGuard)
  acceptInvite(@Param('token') token: string, @Req() req: { user: User }) {
    return this.teamsService.acceptInvite(req.user.id, token);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Req() req: { user: User }) {
    return this.teamsService.listTeams(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateTeamDto, @Req() req: { user: User }) {
    return this.teamsService.createTeam(req.user.id, dto.name);
  }

  @Patch('active')
  @UseGuards(JwtAuthGuard)
  switchActive(@Body() dto: SwitchActiveTeamDto, @Req() req: { user: User }) {
    return this.teamsService.switchActiveTeam(
      req.user.id,
      dto.teamId ?? null,
    );
  }

  @Get(':teamId/members')
  @UseGuards(JwtAuthGuard)
  listMembers(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Req() req: { user: User },
  ) {
    return this.teamsService.listMembers(req.user.id, teamId);
  }

  @Delete(':teamId/members/:userId')
  @UseGuards(JwtAuthGuard)
  removeMember(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: { user: User },
  ) {
    return this.teamsService.removeMember(req.user.id, teamId, userId);
  }

  @Get(':teamId/invite-link')
  @UseGuards(JwtAuthGuard)
  getInviteLink(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Req() req: { user: User },
  ) {
    return this.teamsService.getOrCreateInviteLink(req.user.id, teamId);
  }

  @Post(':teamId/invite-link/regenerate')
  @UseGuards(JwtAuthGuard)
  regenerateInviteLink(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Req() req: { user: User },
  ) {
    return this.teamsService.regenerateInviteLink(req.user.id, teamId);
  }

  @Patch(':teamId/invite-link')
  @UseGuards(JwtAuthGuard)
  updateInviteLink(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: UpdateInviteLinkDto,
    @Req() req: { user: User },
  ) {
    return this.teamsService.updateInviteLink(req.user.id, teamId, dto);
  }
}
