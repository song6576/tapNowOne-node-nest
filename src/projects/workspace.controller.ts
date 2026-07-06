import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceSearchQueryDto } from './dto/projects.dto';
import { ProjectsService } from './projects.service';

@Controller('api/workspace')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  search(@Query() query: WorkspaceSearchQueryDto, @Req() req: { user: User }) {
    return this.projectsService.searchWorkspace(req.user.id, query);
  }
}
