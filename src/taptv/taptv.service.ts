import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { TapTVWork, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import type { ListTapTVDto, PublishTapTVDto } from './dto/taptv.dto';
import {
  buildTapTVWorkflow,
  parseWorkflowData,
  type WorkflowProject,
} from './taptv-workflow.util';

function toIso(date: Date) {
  return date.toISOString();
}

@Injectable()
export class TaptvService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
  ) {}

  async listFeatured() {
    const rows = await this.prisma.featuredBanner.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle ?? undefined,
      cover: row.cover,
      video_url: row.videoUrl ?? undefined,
      link: row.link ?? undefined,
    }));
  }

  /** 首页聚合：精选轮播 + TapTV 预览（减少前端往返） */
  async getHomeDashboard(viewer: User | null, taptvLimit = 8) {
    const [featured, taptv] = await Promise.all([
      this.listFeatured(),
      this.listWorks({ sort: 'featured', limit: taptvLimit }, viewer),
    ]);
    return { featured, taptv };
  }

  async listWorks(dto: ListTapTVDto, viewer: User | null) {
    const sort = dto.sort ?? 'featured';
    if (sort === 'following' && !viewer) {
      throw new UnauthorizedException('登录后查看关注内容');
    }

    const where: Record<string, unknown> = {};
    if (dto.category && dto.category !== 'all') {
      where.category = dto.category;
    }
    if (dto.search?.trim()) {
      const q = dto.search.trim();
      where.OR = [{ title: { contains: q } }, { authorName: { contains: q } }];
    }
    if (sort === 'following' && viewer) {
      const follows = await this.prisma.userFollow.findMany({
        where: { followerId: viewer.id },
        select: { followingId: true },
      });
      const authorIds = follows.map((f) => f.followingId);
      if (authorIds.length === 0) return [];
      where.userId = { in: authorIds };
    }

    let orderBy: Record<string, 'asc' | 'desc'> = { publishedAt: 'desc' };
    if (sort === 'featured') orderBy = { featured: 'desc' };
    if (sort === 'hot') orderBy = { likes: 'desc' };

    const limit = dto.limit ?? 50;
    const page = dto.page ?? 1;
    const rows = await this.prisma.tapTVWork.findMany({
      where,
      orderBy:
        sort === 'featured'
          ? [{ featured: 'desc' }, { publishedAt: 'desc' }]
          : orderBy,
      take: limit,
      skip: (page - 1) * limit,
    });

    return this.mapWorks(rows, viewer?.id ?? null);
  }

  async getWork(id: string, viewer: User | null) {
    const row = await this.prisma.tapTVWork.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('作品不存在');
    const [mapped] = await this.mapWorks([row], viewer?.id ?? null);
    return mapped;
  }

  async getWorkflow(id: string): Promise<WorkflowProject> {
    const row = await this.prisma.tapTVWork.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('作品不存在');
    const parsed = parseWorkflowData(row.workflowData);
    if (parsed) return parsed;
    const workflow = buildTapTVWorkflow(row.id, row.title, row.nodeCount);
    await this.prisma.tapTVWork.update({
      where: { id },
      data: { workflowData: JSON.stringify(workflow) },
    });
    return workflow;
  }

  /**
   * 切换点赞：taptv_like 与 taptv_work.likes 在同一事务中增删。
   * @returns liked 当前是否已赞；likes 更新后的总数
   */
  async toggleLike(workId: string, user: User) {
    const work = await this.assertWork(workId);
    const existing = await this.prisma.tapTVLike.findUnique({
      where: { userId_workId: { userId: user.id, workId } },
    });
    if (existing) {
      await this.prisma.$transaction([
        this.prisma.tapTVLike.delete({ where: { id: existing.id } }),
        this.prisma.tapTVWork.update({
          where: { id: workId },
          data: { likes: { decrement: 1 } },
        }),
      ]);
      const updated = await this.prisma.tapTVWork.findUnique({
        where: { id: workId },
      });
      return { liked: false, likes: updated?.likes ?? work.likes - 1 };
    }
    await this.prisma.$transaction([
      this.prisma.tapTVLike.create({ data: { userId: user.id, workId } }),
      this.prisma.tapTVWork.update({
        where: { id: workId },
        data: { likes: { increment: 1 } },
      }),
    ]);
    const updated = await this.prisma.tapTVWork.findUnique({
      where: { id: workId },
    });
    return { liked: true, likes: updated?.likes ?? work.likes + 1 };
  }

  /**
   * 切换收藏：taptv_favorite 与 taptv_work.favorites 在同一事务中增删。
   * @returns favorited 当前是否已藏；favorites 更新后的总数
   */
  async toggleFavorite(workId: string, user: User) {
    const work = await this.assertWork(workId);
    const existing = await this.prisma.tapTVFavorite.findUnique({
      where: { userId_workId: { userId: user.id, workId } },
    });
    if (existing) {
      await this.prisma.$transaction([
        this.prisma.tapTVFavorite.delete({ where: { id: existing.id } }),
        this.prisma.tapTVWork.update({
          where: { id: workId },
          data: { favorites: { decrement: 1 } },
        }),
      ]);
      const updated = await this.prisma.tapTVWork.findUnique({
        where: { id: workId },
      });
      return {
        favorited: false,
        favorites: updated?.favorites ?? work.favorites - 1,
      };
    }
    await this.prisma.$transaction([
      this.prisma.tapTVFavorite.create({ data: { userId: user.id, workId } }),
      this.prisma.tapTVWork.update({
        where: { id: workId },
        data: { favorites: { increment: 1 } },
      }),
    ]);
    const updated = await this.prisma.tapTVWork.findUnique({
      where: { id: workId },
    });
    return {
      favorited: true,
      favorites: updated?.favorites ?? work.favorites + 1,
    };
  }

  /**
   * 我的收藏：按 taptv_favorite.created_at 倒序返回作品列表。
   * 用于个人主页「我的收藏」Tab。
   */
  async listFavorites(user: User) {
    const rows = await this.prisma.tapTVFavorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { work: true },
    });
    const works = rows.map((row) => row.work);
    const mapped = await this.mapWorks(works, user.id);
    return mapped.map((item) => ({ ...item, favorited_by_me: true }));
  }

  async recordShare(workId: string) {
    await this.assertWork(workId);
    const updated = await this.prisma.tapTVWork.update({
      where: { id: workId },
      data: { shares: { increment: 1 } },
    });
    return { shares: updated.shares };
  }

  async toggleFollow(targetUserId: number, user: User) {
    if (targetUserId === user.id) {
      throw new BadRequestException('不能关注自己');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!target) throw new NotFoundException('用户不存在');

    const existing = await this.prisma.userFollow.findUnique({
      where: {
        followerId_followingId: {
          followerId: user.id,
          followingId: targetUserId,
        },
      },
    });
    if (existing) {
      await this.prisma.userFollow.delete({ where: { id: existing.id } });
      return { following: false };
    }
    await this.prisma.userFollow.create({
      data: { followerId: user.id, followingId: targetUserId },
    });
    return { following: true };
  }

  async cloneWork(workId: string, user: User) {
    const workflow = await this.getWorkflow(workId);
    const work = await this.assertWork(workId);
    const project = await this.projectsService.createProject(user.id, {
      name: work.title,
      data: workflow as unknown as Record<string, unknown>,
    });
    await this.prisma.tapTVWork.update({
      where: { id: workId },
      data: { forks: { increment: 1 } },
    });
    return project;
  }

  async publishWork(user: User, dto: PublishTapTVDto) {
    const project = await this.projectsService.getProject(
      user.id,
      dto.projectId,
    );
    const workflow = project.data as WorkflowProject;
    const nodeCount = Array.isArray(workflow?.nodes)
      ? workflow.nodes.length
      : 0;
    const authorName =
      user.name?.trim() || user.email?.split('@')[0] || 'Creator';
    const authorAvatar = authorName.trim()[0]?.toUpperCase() ?? 'C';
    const cover =
      dto.coverUrl?.trim() ||
      project.thumbnail ||
      'linear-gradient(160deg,#1a1a1e 0%,#2d2d35 50%,#1a1a1e 100%)';

    const work = await this.prisma.tapTVWork.create({
      data: {
        userId: user.id,
        title: dto.title.trim(),
        authorName,
        authorAvatar,
        cover,
        videoUrl: dto.videoUrl.trim(),
        description: dto.description?.trim() || null,
        tags: JSON.stringify([]),
        nodeCount: nodeCount || 1,
        category: dto.category ?? 'creative',
        featured: false,
        workflowData: JSON.stringify(workflow),
        publishedAt: new Date(),
      },
    });

    return {
      id: work.id,
      title: work.title,
      message: '作品已提交审核',
    };
  }

  private async assertWork(id: string) {
    const work = await this.prisma.tapTVWork.findUnique({ where: { id } });
    if (!work) throw new NotFoundException('作品不存在');
    return work;
  }

  /**
   * 将 taptv_work 行映射为 API 响应，并批量附加当前用户的点赞/收藏/关注状态。
   * cover → 列表封面；video_url → 悬浮播放。
   */
  private async mapWorks(rows: TapTVWork[], viewerId: number | null) {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const authorIds = rows
      .map((r) => r.userId)
      .filter((id): id is number => id != null);

    let likedSet = new Set<string>();
    let favSet = new Set<string>();
    let followSet = new Set<number>();

    if (viewerId) {
      const [likes, favs, follows] = await Promise.all([
        this.prisma.tapTVLike.findMany({
          where: { userId: viewerId, workId: { in: ids } },
          select: { workId: true },
        }),
        this.prisma.tapTVFavorite.findMany({
          where: { userId: viewerId, workId: { in: ids } },
          select: { workId: true },
        }),
        authorIds.length
          ? this.prisma.userFollow.findMany({
              where: { followerId: viewerId, followingId: { in: authorIds } },
              select: { followingId: true },
            })
          : Promise.resolve([]),
      ]);
      likedSet = new Set(likes.map((l) => l.workId));
      favSet = new Set(favs.map((f) => f.workId));
      followSet = new Set(follows.map((f) => f.followingId));
    }

    return rows.map((row) => {
      let tags: string[] = [];
      try {
        tags = JSON.parse(row.tags) as string[];
      } catch {
        tags = [];
      }
      return {
        id: row.id,
        title: row.title,
        author: row.authorName,
        author_avatar: row.authorAvatar,
        author_user_id: row.userId,
        cover: row.cover,
        video_url: row.videoUrl,
        description: row.description ?? undefined,
        producer: row.producer ?? undefined,
        forks: row.forks,
        likes: row.likes,
        favorites: row.favorites,
        shares: row.shares,
        tags,
        node_count: row.nodeCount,
        category: row.category,
        published_at: toIso(row.publishedAt),
        featured: row.featured,
        liked_by_me: likedSet.has(row.id),
        favorited_by_me: favSet.has(row.id),
        following_author:
          row.userId != null ? followSet.has(row.userId) : false,
      };
    });
  }
}
