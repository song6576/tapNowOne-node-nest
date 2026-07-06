import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TeamInviteLink } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

function toIso(date: Date) {
  return date.toISOString();
}

function generatePublicId() {
  return `C${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function teamInitial(name: string) {
  return name.trim()[0]?.toUpperCase() ?? 'T';
}

const INVITE_TOKEN_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async listTeams(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        activeTeamId: true,
        tapiesBalance: true,
        name: true,
      },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const memberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: {
        team: {
          select: {
            id: true,
            publicId: true,
            name: true,
            tapiesBalance: true,
            ownerId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const teams = memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      public_id: m.team.publicId,
      initial: teamInitial(m.team.name),
      tapies_balance: m.team.tapiesBalance,
      role: m.role,
      is_owner: m.team.ownerId === userId,
    }));

    return {
      active_team_id: user.activeTeamId,
      personal_tapies_balance: user.tapiesBalance,
      personal_name: user.name,
      teams,
    };
  }

  async createTeam(userId: number, rawName: string) {
    const trimmed = rawName.trim();
    const name = trimmed.endsWith('的团队') ? trimmed : `${trimmed}的团队`;

    const team = await this.prisma.$transaction(async (tx) => {
      const created = await tx.team.create({
        data: {
          name,
          publicId: generatePublicId(),
          ownerId: userId,
          tapiesBalance: 0,
        },
      });
      await tx.teamMember.create({
        data: {
          teamId: created.id,
          userId,
          role: 'owner',
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { activeTeamId: created.id },
      });
      return created;
    });

    return {
      id: team.id,
      name: team.name,
      public_id: team.publicId,
      initial: teamInitial(team.name),
      tapies_balance: team.tapiesBalance,
      role: 'owner',
      is_owner: true,
      active_team_id: team.id,
    };
  }

  async switchActiveTeam(userId: number, teamId: string | null) {
    if (teamId) {
      await this.assertMember(userId, teamId);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { activeTeamId: teamId },
    });
    return { active_team_id: teamId };
  }

  async removeMember(userId: number, teamId: string, targetUserId: number) {
    await this.assertOwner(userId, teamId);
    if (userId === targetUserId) {
      throw new ForbiddenException('不能移除自己');
    }
    const target = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('成员不存在');
    if (target.role === 'owner') {
      throw new ForbiddenException('不能移除团队所有者');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.teamMember.delete({
        where: { teamId_userId: { teamId, userId: targetUserId } },
      });
      await tx.user.updateMany({
        where: { id: targetUserId, activeTeamId: teamId },
        data: { activeTeamId: null },
      });
    });
    return { removed_user_id: targetUserId };
  }

  async listMembers(userId: number, teamId: string) {
    await this.assertMember(userId, teamId);
    const rows = await this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    rows.sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (b.role === 'owner' && a.role !== 'owner') return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    return {
      members: rows.map((m) => ({
        user_id: m.user.id,
        name: m.user.name?.trim() || m.user.email,
        email: m.user.email,
        avatar_url: m.user.avatarUrl,
        role: m.role,
        quota_used: m.quotaUsed,
        quota_limit: m.quotaLimit,
        is_self: m.userId === userId,
      })),
    };
  }

  async getOrCreateInviteLink(userId: number, teamId: string) {
    await this.assertOwner(userId, teamId);
    const now = new Date();
    let link = await this.findActiveInviteLink(teamId, now);
    if (!link) {
      link = await this.createInviteLink(userId, teamId);
    }
    return this.formatInviteLink(link);
  }

  async regenerateInviteLink(userId: number, teamId: string) {
    await this.assertOwner(userId, teamId);
    const now = new Date();
    await this.prisma.teamInviteLink.updateMany({
      where: { teamId, revokedAt: null },
      data: { revokedAt: now },
    });
    const link = await this.createInviteLink(userId, teamId);
    return this.formatInviteLink(link);
  }

  async updateInviteLink(
    userId: number,
    teamId: string,
    opts: { expiresInDays?: number; unlimitedQuota?: boolean },
  ) {
    await this.assertOwner(userId, teamId);
    const link = await this.findActiveInviteLink(teamId, new Date());
    if (!link) throw new NotFoundException('当前没有有效的邀请链接');

    const data: {
      expiresAt?: Date;
      unlimitedQuota?: boolean;
    } = {};
    if (opts.expiresInDays !== undefined) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + opts.expiresInDays);
      data.expiresAt = expiresAt;
    }
    if (opts.unlimitedQuota !== undefined) {
      data.unlimitedQuota = opts.unlimitedQuota;
    }

    const updated = await this.prisma.teamInviteLink.update({
      where: { id: link.id },
      data,
    });
    return this.formatInviteLink(updated);
  }

  async previewInvite(token: string) {
    const link = await this.prisma.teamInviteLink.findUnique({
      where: { token },
      include: {
        team: {
          select: {
            name: true,
            _count: { select: { members: true } },
          },
        },
      },
    });
    if (!link) {
      return {
        valid: false,
        reason: 'not_found' as const,
        team_name: null,
        member_count: 0,
        expires_at: null,
        unlimited_quota: false,
      };
    }

    const validity = this.checkLinkValid(link);
    return {
      team_name: link.team.name,
      member_count: link.team._count.members,
      expires_at: toIso(link.expiresAt),
      unlimited_quota: link.unlimitedQuota,
      valid: validity.valid,
      reason: validity.reason ?? null,
    };
  }

  async acceptInvite(userId: number, token: string) {
    const link = await this.prisma.teamInviteLink.findUnique({
      where: { token },
      include: { team: true },
    });
    if (!link) throw new NotFoundException('邀请链接无效');

    const validity = this.checkLinkValid(link);
    if (!validity.valid) {
      throw new GoneException('邀请链接已失效');
    }

    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: link.teamId, userId } },
    });
    if (existing) throw new ConflictException('您已是该团队成员');

    await this.prisma.$transaction(async (tx) => {
      await tx.teamMember.create({
        data: {
          teamId: link.teamId,
          userId,
          role: 'member',
          inviteLinkId: link.id,
          quotaLimit: link.unlimitedQuota ? null : 0,
        },
      });
      await tx.teamInviteLink.update({
        where: { id: link.id },
        data: { useCount: { increment: 1 } },
      });
      await tx.user.update({
        where: { id: userId },
        data: { activeTeamId: link.teamId },
      });
    });

    return {
      team_id: link.teamId,
      team_name: link.team.name,
      role: 'member',
      active_team_id: link.teamId,
    };
  }

  async assertMember(userId: number, teamId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('无权访问该团队');
    }
    return member;
  }

  async assertOwner(userId: number, teamId: string) {
    const member = await this.assertMember(userId, teamId);
    if (member.role !== 'owner') {
      throw new ForbiddenException('仅团队所有者可执行此操作');
    }
    return member;
  }

  async resolveScope(userId: number, teamId?: string | null) {
    if (!teamId) {
      return { teamId: null as string | null };
    }
    await this.assertMember(userId, teamId);
    return { teamId };
  }

  folderWhere(userId: number, teamId: string | null) {
    if (teamId) return { teamId };
    return { userId, teamId: null };
  }

  projectWhere(userId: number, teamId: string | null) {
    if (teamId) return { teamId };
    return { userId, teamId: null };
  }

  private generateInviteToken() {
    let out = '';
    for (let i = 0; i < 12; i++) {
      out +=
        INVITE_TOKEN_CHARS[
          Math.floor(Math.random() * INVITE_TOKEN_CHARS.length)
        ];
    }
    return out;
  }

  private inviteUrl(token: string) {
    const base = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:5173')
      .replace(/\/$/, '');
    return `${base}/team/join/${token}`;
  }

  private async findActiveInviteLink(teamId: string, now: Date) {
    return this.prisma.teamInviteLink.findFirst({
      where: {
        teamId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async createInviteLink(
    userId: number,
    teamId: string,
    opts?: { expiresInDays?: number; unlimitedQuota?: boolean },
  ) {
    const expiresInDays = opts?.expiresInDays ?? 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.teamInviteLink.create({
          data: {
            teamId,
            token: this.generateInviteToken(),
            createdBy: userId,
            expiresAt,
            unlimitedQuota: opts?.unlimitedQuota ?? true,
          },
        });
      } catch {
        if (attempt === 4) {
          throw new ConflictException('生成邀请链接失败，请重试');
        }
      }
    }
    throw new ConflictException('生成邀请链接失败，请重试');
  }

  private checkLinkValid(link: TeamInviteLink) {
    if (link.revokedAt) return { valid: false, reason: 'revoked' as const };
    if (link.expiresAt <= new Date()) {
      return { valid: false, reason: 'expired' as const };
    }
    if (link.maxUses !== null && link.useCount >= link.maxUses) {
      return { valid: false, reason: 'max_uses_reached' as const };
    }
    return { valid: true, reason: undefined };
  }

  private formatInviteLink(link: TeamInviteLink) {
    const msLeft = link.expiresAt.getTime() - Date.now();
    const expiresInDays = Math.max(1, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
    return {
      token: link.token,
      url: this.inviteUrl(link.token),
      expires_at: toIso(link.expiresAt),
      expires_in_days: expiresInDays,
      unlimited_quota: link.unlimitedQuota,
      use_count: link.useCount,
      max_uses: link.maxUses,
    };
  }
}
