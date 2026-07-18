import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ToggleMediaFavoriteDto } from './dto/media-favorite.dto';

function hashMediaUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex');
}

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 切换画布素材收藏；同一 mediaUrl 再次调用则取消 */
  async toggleMedia(user: User, dto: ToggleMediaFavoriteDto) {
    const mediaUrl = dto.mediaUrl.trim();
    const mediaUrlHash = hashMediaUrl(mediaUrl);
    const existing = await this.prisma.userMediaFavorite.findUnique({
      where: { userId_mediaUrlHash: { userId: user.id, mediaUrlHash } },
    });

    if (existing) {
      await this.prisma.userMediaFavorite.delete({ where: { id: existing.id } });
      return { favorited: false, id: existing.id };
    }

    const created = await this.prisma.userMediaFavorite.create({
      data: {
        userId: user.id,
        mediaUrl,
        mediaUrlHash,
        mediaType: dto.mediaType,
        title: dto.title?.trim() || null,
        coverUrl: dto.coverUrl?.trim() || null,
        projectId: dto.projectId || null,
        nodeId: dto.nodeId?.trim() || null,
      },
    });

    return { favorited: true, id: created.id };
  }

  /** 当前用户画布素材收藏列表（按收藏时间倒序） */
  async listMedia(user: User) {
    const rows = await this.prisma.userMediaFavorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      media_url: row.mediaUrl,
      media_type: row.mediaType,
      title: row.title,
      cover_url: row.coverUrl,
      project_id: row.projectId,
      node_id: row.nodeId,
      created_at: row.createdAt.toISOString(),
      favorited: true,
    }));
  }

  /** 查询某 URL 是否已收藏 */
  async mediaStatus(user: User, mediaUrl: string) {
    const url = mediaUrl.trim();
    if (!url) return { favorited: false as const };
    const row = await this.prisma.userMediaFavorite.findUnique({
      where: {
        userId_mediaUrlHash: { userId: user.id, mediaUrlHash: hashMediaUrl(url) },
      },
      select: { id: true },
    });
    return row
      ? { favorited: true as const, id: row.id }
      : { favorited: false as const };
  }
}
