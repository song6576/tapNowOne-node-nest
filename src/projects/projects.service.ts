import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateFolderDto,
  CreateProjectDto,
  UpdateFolderDto,
  UpdateProjectDto,
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
  constructor(private readonly prisma: PrismaService) {}

  async listFolders(userId: number) {
    const rows = await this.prisma.workspaceFolder.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((f) => ({
      id: f.id,
      name: f.name,
      parent_id: f.parentId,
      created_at: toIso(f.createdAt),
      updated_at: toIso(f.updatedAt),
    }));
  }

  async createFolder(userId: number, dto: CreateFolderDto) {
    if (dto.parentId) {
      await this.assertFolderOwned(userId, dto.parentId);
    }
    const folder = await this.prisma.workspaceFolder.create({
      data: {
        userId,
        name: dto.name?.trim() || '未命名文件夹',
        parentId: dto.parentId ?? null,
      },
    });
    return {
      id: folder.id,
      name: folder.name,
      parent_id: folder.parentId,
      created_at: toIso(folder.createdAt),
      updated_at: toIso(folder.updatedAt),
    };
  }

  async updateFolder(userId: number, id: string, dto: UpdateFolderDto) {
    await this.assertFolderOwned(userId, id);
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('文件夹不能移动到自身');
      }
      await this.assertFolderOwned(userId, dto.parentId);
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
      created_at: toIso(folder.createdAt),
      updated_at: toIso(folder.updatedAt),
    };
  }

  async deleteFolder(userId: number, id: string) {
    await this.assertFolderOwned(userId, id);
    const childFolders = await this.prisma.workspaceFolder.count({
      where: { userId, parentId: id },
    });
    const childProjects = await this.prisma.project.count({
      where: { userId, folderId: id },
    });
    if (childFolders > 0 || childProjects > 0) {
      throw new BadRequestException('文件夹非空，无法删除');
    }
    await this.prisma.workspaceFolder.delete({ where: { id } });
    return { ok: true };
  }

  async listProjects(userId: number) {
    const rows = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        folderId: true,
        thumbnail: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      folder_id: p.folderId,
      thumbnail: p.thumbnail ?? undefined,
      created_at: toIso(p.createdAt),
      updated_at: toIso(p.updatedAt),
    }));
  }

  async getProject(userId: number, id: string) {
    const row = await this.prisma.project.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('项目不存在');
    }
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
      thumbnail: row.thumbnail ?? undefined,
      data,
      created_at: toIso(row.createdAt),
      updated_at: toIso(row.updatedAt),
    };
  }

  async createProject(userId: number, dto: CreateProjectDto) {
    if (dto.folderId) {
      await this.assertFolderOwned(userId, dto.folderId);
    }

    const name = dto.name?.trim() || 'Untitled';

    if (dto.id) {
      const existing = await this.prisma.project.findFirst({
        where: { id: dto.id, userId },
      });
      if (existing) {
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
        folderId: dto.folderId ?? null,
        name,
        data: payload,
      },
    });

    return {
      id: row.id,
      name: row.name,
      folder_id: row.folderId,
      created_at: toIso(row.createdAt),
      updated_at: toIso(row.updatedAt),
    };
  }

  async updateProject(userId: number, id: string, dto: UpdateProjectDto) {
    const row = await this.prisma.project.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('项目不存在');
    }

    if (dto.folderId) {
      await this.assertFolderOwned(userId, dto.folderId);
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
        ...(dto.folderId !== undefined ? { folderId: dto.folderId } : {}),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      folder_id: updated.folderId,
      thumbnail: updated.thumbnail ?? undefined,
      created_at: toIso(updated.createdAt),
      updated_at: toIso(updated.updatedAt),
    };
  }

  async deleteProject(userId: number, id: string) {
    const row = await this.prisma.project.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('项目不存在');
    }

    await this.prisma.$transaction(async (tx) => {
      const conversations = await tx.agentConversation.findMany({
        where: { projectId: id, userId },
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
    await this.assertProjectOwned(userId, projectId);
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

  private async assertFolderOwned(userId: number, folderId: string) {
    const folder = await this.prisma.workspaceFolder.findFirst({
      where: { id: folderId, userId },
    });
    if (!folder) {
      throw new NotFoundException('文件夹不存在');
    }
    return folder;
  }

  private async assertProjectOwned(userId: number, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });
    if (!project) {
      throw new NotFoundException('项目不存在');
    }
    return project;
  }
}
