import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Project } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import type {
  CreateFolderDto,
  CreateProjectDto,
  UpdateFolderDto,
  UpdateProjectDto,
  WorkspaceSearchQueryDto,
} from './dto/projects.dto';

function emptyCanvasData(id: string, name: string) {
  const now = new Date().toISOString();
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function toIso(date: Date) {
  return date.toISOString();
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamsService: TeamsService,
  ) {}

  async listFolders(userId: number, teamId: string | null) {
    await this.teamsService.resolveScope(userId, teamId);
    const rows = await this.prisma.workspaceFolder.findMany({
      where: this.teamsService.folderWhere(userId, teamId),
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((f) => ({
      id: f.id,
      name: f.name,
      parent_id: f.parentId,
      team_id: f.teamId,
      created_at: toIso(f.createdAt),
      updated_at: toIso(f.updatedAt),
    }));
  }

  async createFolder(userId: number, dto: CreateFolderDto) {
    const teamId = dto.teamId ?? null;
    await this.teamsService.resolveScope(userId, teamId);
    if (dto.parentId) {
      await this.assertFolderAccess(userId, dto.parentId);
    }
    const folder = await this.prisma.workspaceFolder.create({
      data: {
        userId,
        teamId,
        name: dto.name?.trim() || '未命名文件夹',
        parentId: dto.parentId ?? null,
      },
    });
    return {
      id: folder.id,
      name: folder.name,
      parent_id: folder.parentId,
      team_id: folder.teamId,
      created_at: toIso(folder.createdAt),
      updated_at: toIso(folder.updatedAt),
    };
  }

  async updateFolder(userId: number, id: string, dto: UpdateFolderDto) {
    await this.assertFolderAccess(userId, id);
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('文件夹不能移动到自身');
      }
      await this.assertFolderAccess(userId, dto.parentId);
    }
    const folder = await this.prisma.workspaceFolder.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      },
    });
    return {
      id: folder.id,
      name: folder.name,
      parent_id: folder.parentId,
      team_id: folder.teamId,
      created_at: toIso(folder.createdAt),
      updated_at: toIso(folder.updatedAt),
    };
  }

  async deleteFolder(userId: number, id: string) {
    const folder = await this.assertFolderAccess(userId, id);
    const parentId = folder.parentId;
    const scope = this.teamsService.folderWhere(userId, folder.teamId);

    await this.prisma.$transaction(async (tx) => {
      await tx.project.updateMany({
        where: { ...scope, folderId: id },
        data: { folderId: parentId },
      });
      await tx.workspaceFolder.updateMany({
        where: { ...scope, parentId: id },
        data: { parentId },
      });
      await tx.workspaceFolder.delete({ where: { id } });
    });

    return { ok: true };
  }

  async searchWorkspace(userId: number, query: WorkspaceSearchQueryDto) {
    const teamId = query.teamId ?? null;
    await this.teamsService.resolveScope(userId, teamId);

    const parentId = query.parentId ?? null;
    const keyword = query.q?.trim();
    const type = query.type ?? 'all';
    const sortBy = query.sortBy === 'createdAt' ? 'createdAt' : 'updatedAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy = { [sortBy]: sortOrder } as const;

    const folderScope = this.teamsService.folderWhere(userId, teamId);
    const projectScope = this.teamsService.projectWhere(userId, teamId);

    const folders =
      type === 'projects'
        ? []
        : await this.prisma.workspaceFolder.findMany({
            where: {
              ...folderScope,
              parentId,
              ...(keyword ? { name: { contains: keyword } } : {}),
            },
            orderBy,
          });

    const projects =
      type === 'folders'
        ? []
        : await this.prisma.project.findMany({
            where: {
              ...projectScope,
              folderId: parentId,
              ...(keyword ? { name: { contains: keyword } } : {}),
            },
            orderBy,
            select: {
              id: true,
              name: true,
              folderId: true,
              teamId: true,
              thumbnail: true,
              createdAt: true,
              updatedAt: true,
            },
          });

    const folderIds = folders.map((f) => f.id);
    const projectCounts =
      folderIds.length === 0
        ? []
        : await this.prisma.project.groupBy({
            by: ['folderId'],
            where: {
              ...projectScope,
              folderId: { in: folderIds },
            },
            _count: { _all: true },
          });
    const countMap = new Map(
      projectCounts.map((row) => [row.folderId, row._count._all]),
    );

    let current_folder: {
      id: string;
      name: string;
      parent_id: string | null;
      team_id: string | null;
      created_at: string;
      updated_at: string;
    } | null = null;
    if (parentId) {
      const current = await this.prisma.workspaceFolder.findFirst({
        where: { id: parentId, ...folderScope },
      });
      if (current) {
        current_folder = {
          id: current.id,
          name: current.name,
          parent_id: current.parentId,
          team_id: current.teamId,
          created_at: toIso(current.createdAt),
          updated_at: toIso(current.updatedAt),
        };
      }
    }

    return {
      current_folder,
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        parent_id: f.parentId,
        team_id: f.teamId,
        project_count: countMap.get(f.id) ?? 0,
        created_at: toIso(f.createdAt),
        updated_at: toIso(f.updatedAt),
      })),
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        folder_id: p.folderId,
        team_id: p.teamId,
        thumbnail: p.thumbnail ?? undefined,
        created_at: toIso(p.createdAt),
        updated_at: toIso(p.updatedAt),
      })),
    };
  }

  async listProjects(userId: number, teamId: string | null) {
    await this.teamsService.resolveScope(userId, teamId);
    const rows = await this.prisma.project.findMany({
      where: this.teamsService.projectWhere(userId, teamId),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        folderId: true,
        teamId: true,
        thumbnail: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      folder_id: p.folderId,
      team_id: p.teamId,
      thumbnail: p.thumbnail ?? undefined,
      created_at: toIso(p.createdAt),
      updated_at: toIso(p.updatedAt),
    }));
  }

  async getProject(userId: number, id: string) {
    const row = await this.assertProjectAccess(userId, id);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      data = emptyCanvasData(row.id, row.name);
    }
    return {
      id: row.id,
      name: row.name,
      folder_id: row.folderId,
      team_id: row.teamId,
      thumbnail: row.thumbnail ?? undefined,
      data,
      created_at: toIso(row.createdAt),
      updated_at: toIso(row.updatedAt),
    };
  }

  async createProject(userId: number, dto: CreateProjectDto) {
    const teamId = dto.teamId ?? null;
    await this.teamsService.resolveScope(userId, teamId);
    if (dto.folderId) {
      await this.assertFolderAccess(userId, dto.folderId);
    }

    const name = dto.name?.trim() || 'Untitled';

    if (dto.id) {
      const existing = await this.prisma.project.findFirst({
        where: { id: dto.id },
      });
      if (existing) {
        await this.assertProjectAccess(userId, dto.id);
        return this.updateProject(userId, dto.id, {
          name,
          data: dto.data,
        });
      }
    }

    const id = dto.id ?? crypto.randomUUID();
    const data = dto.data ?? emptyCanvasData(id, name);
    const payload = JSON.stringify({ ...data, id, name });

    const row = await this.prisma.project.create({
      data: {
        id,
        userId,
        teamId,
        folderId: dto.folderId ?? null,
        name,
        data: payload,
      },
    });

    return {
      id: row.id,
      name: row.name,
      folder_id: row.folderId,
      team_id: row.teamId,
      created_at: toIso(row.createdAt),
      updated_at: toIso(row.updatedAt),
    };
  }

  async updateProject(userId: number, id: string, dto: UpdateProjectDto) {
    const row = await this.assertProjectAccess(userId, id);

    const nextTeamId =
      dto.teamId !== undefined ? dto.teamId : row.teamId;
    if (dto.teamId !== undefined && dto.teamId !== null) {
      await this.teamsService.assertMember(userId, dto.teamId);
    }
    if (dto.teamId !== undefined && dto.teamId === null) {
      if (row.teamId && row.userId !== userId) {
        throw new BadRequestException('仅项目创建者可移回个人空间');
      }
    }

    let nextFolderId =
      dto.folderId !== undefined ? dto.folderId : row.folderId;
    if (dto.teamId !== undefined && dto.folderId === undefined) {
      nextFolderId = null;
    }
    if (nextFolderId) {
      const folder = await this.assertFolderAccess(userId, nextFolderId);
      this.assertFolderMatchesProjectScope(folder, nextTeamId);
    }

    let nextData = row.data;
    if (dto.data !== undefined) {
      nextData = JSON.stringify(dto.data);
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.data !== undefined ? { data: nextData } : {}),
        ...(dto.thumbnail !== undefined ? { thumbnail: dto.thumbnail } : {}),
        ...(dto.teamId !== undefined ? { teamId: dto.teamId } : {}),
        ...(dto.folderId !== undefined || dto.teamId !== undefined
          ? { folderId: nextFolderId }
          : {}),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      folder_id: updated.folderId,
      team_id: updated.teamId,
      thumbnail: updated.thumbnail ?? undefined,
      created_at: toIso(updated.createdAt),
      updated_at: toIso(updated.updatedAt),
    };
  }

  async deleteProject(userId: number, id: string) {
    await this.assertProjectAccess(userId, id);

    await this.prisma.$transaction(async (tx) => {
      const conversations = await tx.agentConversation.findMany({
        where: { projectId: id },
        select: { id: true },
      });
      const convIds = conversations.map((c) => c.id);
      if (convIds.length) {
        await tx.agentMessage.deleteMany({
          where: { conversationId: { in: convIds } },
        });
        await tx.agentConversation.deleteMany({
          where: { id: { in: convIds } },
        });
      }
      await tx.project.delete({ where: { id } });
    });

    return { ok: true };
  }

  async listProjectConversations(userId: number, projectId: string) {
    await this.assertProjectAccess(userId, projectId);
    const rows = await this.prisma.agentConversation.findMany({
      where: { userId, projectId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      created_at: toIso(c.createdAt),
      updated_at: toIso(c.updatedAt),
    }));
  }

  private async assertFolderAccess(userId: number, folderId: string) {
    const folder = await this.prisma.workspaceFolder.findFirst({
      where: { id: folderId },
    });
    if (!folder) {
      throw new NotFoundException('文件夹不存在');
    }
    if (folder.teamId) {
      await this.teamsService.assertMember(userId, folder.teamId);
    } else if (folder.userId !== userId) {
      throw new NotFoundException('文件夹不存在');
    }
    return folder;
  }

  private assertFolderMatchesProjectScope(
    folder: { teamId: string | null },
    projectTeamId: string | null,
  ) {
    if (projectTeamId === null && folder.teamId !== null) {
      throw new BadRequestException('文件夹与项目不在同一空间');
    }
    if (projectTeamId !== null && folder.teamId !== projectTeamId) {
      throw new BadRequestException('文件夹与项目不在同一空间');
    }
  }

  private async assertProjectAccess(
    userId: number,
    projectId: string,
  ): Promise<Project> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('项目不存在');
    }
    if (project.teamId) {
      await this.teamsService.assertMember(userId, project.teamId);
    } else if (project.userId !== userId) {
      throw new NotFoundException('项目不存在');
    }
    return project;
  }
}
