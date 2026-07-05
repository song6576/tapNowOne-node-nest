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
  CreateFolderDto,
  CreateProjectDto,
  UpdateFolderDto,
  UpdateProjectDto,
} from './dto/projects.dto';
import { ProjectsService } from './projects.service';

@Controller('api/folders')
@UseGuards(JwtAuthGuard)
export class FoldersController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list(@Req() req: { user: User }) {
    return this.projectsService.listFolders(req.user.id);
  }

  @Post()
  create(@Body() dto: CreateFolderDto, @Req() req: { user: User }) {
    return this.projectsService.createFolder(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
    @Req() req: { user: User },
  ) {
    return this.projectsService.updateFolder(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: { user: User }) {
    return this.projectsService.deleteFolder(req.user.id, id);
  }
}
