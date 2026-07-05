import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateProjectDto,
  UpdateProjectDto,
} from './dto/projects.dto';
import { ProjectsService } from './projects.service';

@Controller('api/projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@Req() req: { user: User }) {
    return this.projectsService.listProjects(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @Req() req: { user: User }) {
    return this.projectsService.createProject(req.user.id, dto);
  }

  @Get(':id/conversations')
  listConversations(@Param('id') id: string, @Req() req: { user: User }) {
    return this.projectsService.listProjectConversations(req.user.id, id);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: { user: User }) {
    return this.projectsService.getProject(req.user.id, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: { user: User },
  ) {
    return this.projectsService.updateProject(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: User }) {
    return this.projectsService.deleteProject(req.user.id, id);
  }
}
