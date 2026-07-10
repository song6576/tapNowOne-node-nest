import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  GenerateCodeDto,
  ListTransactionsDto,
  RechargeDto,
  RedeemCodeDto,
  SubscribeDto,
} from './dto/billing.dto';
import {
  type BillingCycle,
  ENTERPRISE_PLAN,
  getPlansForCycle,
  RECHARGE_CNY_PER_USD,
  RECHARGE_TAPIES_PER_USD,
  resolvePlanTapies,
} from './billing-plans.data';

function toIso(date: Date) {
  return date.toISOString();
}

function formatLedgerTime(date: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${p(date.getMonth() + 1)}/${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

function maskCode(code: string) {
  if (code.length <= 12) return code;
  return `${code.slice(0, 12)}...`;
}

function generateRedemptionCode() {
  const seg = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TAP-${seg()}-${seg()}-${seg()}`;
}

const SEED_GIFT_PACKS = [
  {
    modelName: 'Seedance 2.0',
    tier: '银卡',
    priceUsdCents: 100000,
    tapiesAmount: 140000,
    tapiesLabel: '140000 Seedance 2.0 Tapies',
    bgGradient: 'linear-gradient(135deg,#1a3a2a 0%,#2d5a4a 100%)',
    sortOrder: 0,
  },
  {
    modelName: 'Seedance 2.0',
    tier: '金卡',
    priceUsdCents: 300000,
    tapiesAmount: 450000,
    tapiesLabel: '450000 Seedance 2.0 Tapies',
    bgGradient: 'linear-gradient(135deg,#3a1a4a 0%,#5a2d6a 100%)',
    sortOrder: 1,
  },
  {
    modelName: 'Seedance 2.0',
    tier: '铂金卡',
    priceUsdCents: 600000,
    tapiesAmount: 1020000,
    tapiesLabel: '1020000 Seedance 2.0 Tapies',
    bgGradient: 'linear-gradient(135deg,#1a2a4a 0%,#2d4a6a 100%)',
    sortOrder: 2,
  },
  {
    modelName: 'Banana Pro',
    tier: '银卡',
    priceUsdCents: 80000,
    tapiesAmount: 120000,
    tapiesLabel: '120000 Banana Pro Tapies',
    bgGradient: 'linear-gradient(135deg,#3a2a1a 0%,#5a4a2d 100%)',
    sortOrder: 3,
  },
  {
    modelName: 'Banana Pro',
    tier: '金卡',
    priceUsdCents: 240000,
    tapiesAmount: 380000,
    tapiesLabel: '380000 Banana Pro Tapies',
    bgGradient: 'linear-gradient(135deg,#4a3a1a 0%,#6a5a2d 100%)',
    sortOrder: 4,
  },
  {
    modelName: 'Banana Pro',
    tier: '铂金卡',
    priceUsdCents: 480000,
    tapiesAmount: 860000,
    tapiesLabel: '860000 Banana Pro Tapies',
    bgGradient: 'linear-gradient(135deg,#2a1a0a 0%,#4a3a1a 100%)',
    sortOrder: 5,
  },
];

@Injectable()
export class BillingService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.prisma.giftPack.count();
      if (count === 0) await this.seedGiftPacks();
    } catch {
      /* DB may not be migrated yet */
    }
  }

  private async seedGiftPacks() {
    for (const pack of SEED_GIFT_PACKS) {
      await this.prisma.giftPack.create({
        data: {
          ...pack,
          stockTotal: 100,
          stockRemaining: 100,
          active: true,
        },
      });
    }
  }

  /** GET /api/billing/plans — 订阅套餐目录 */
  listPlans(cycle: BillingCycle) {
    return getPlansForCycle(cycle);
  }

  /** GET /api/billing/gift-packs — 礼包超市列表 */
  async listGiftPacks() {
    const rows = await this.prisma.giftPack.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      model_name: row.modelName,
      tier: row.tier,
      price_usd: row.priceUsdCents / 100,
      price_display: `$${(row.priceUsdCents / 100).toLocaleString('en-US')}`,
      tapies_amount: row.tapiesAmount,
      tapies_label: row.tapiesLabel,
      bg_gradient: row.bgGradient,
      stock_total: row.stockTotal,
      stock_remaining: row.stockRemaining,
    }));
  }

  /**
   * POST /api/billing/subscribe
   * 当前为模拟支付：写入订阅记录并发放首月 Tapies。
   */
  async subscribe(user: User, dto: SubscribeDto) {
    if (dto.cycle === 'enterprise' && dto.plan_slug !== 'enterprise') {
      throw new BadRequestException('企业版请使用 plan_slug=enterprise');
    }
    if (dto.plan_slug === 'enterprise') {
      return {
        plan_slug: 'enterprise',
        cycle: 'enterprise',
        message: '已提交企业版咨询，销售团队将联系您',
        contact: ENTERPRISE_PLAN.contact_cta,
      };
    }

    await this.assertTeamAccess(user.id, dto.team_id);

    const monthlyTapies = resolvePlanTapies(
      dto.cycle,
      dto.plan_slug,
      dto.pro_tapies,
    );
    if (dto.plan_slug === 'pro' && !dto.pro_tapies) {
      throw new BadRequestException('PRO 套餐需指定 pro_tapies 档位');
    }

    const now = new Date();
    const expires = new Date(now);
    if (dto.cycle === 'yearly') {
      expires.setFullYear(expires.getFullYear() + 1);
    } else {
      expires.setMonth(expires.getMonth() + 1);
    }

    const sub = await this.prisma.$transaction(async (tx) => {
      await tx.userSubscription.updateMany({
        where: {
          userId: user.id,
          teamId: dto.team_id ?? null,
          status: 'active',
        },
        data: { status: 'cancelled' },
      });

      const created = await tx.userSubscription.create({
        data: {
          userId: user.id,
          teamId: dto.team_id ?? null,
          planSlug: dto.plan_slug,
          cycle: dto.cycle,
          proTapies: dto.plan_slug === 'pro' ? dto.pro_tapies : null,
          status: 'active',
          startedAt: now,
          expiresAt: expires,
        },
      });

      if (monthlyTapies > 0) {
        await this.creditTapiesInTx(tx, {
          userId: user.id,
          teamId: dto.team_id ?? null,
          amount: monthlyTapies,
          type: 'subscription',
          description: `订阅 ${dto.plan_slug.toUpperCase()} 套餐 — 首月积分`,
          refType: 'subscription',
          refId: created.id,
          operatorEmail: user.email,
        });
      }

      return created;
    });

    const balance = await this.getBalance(user.id, dto.team_id ?? null);
    return {
      subscription_id: sub.id,
      plan_slug: sub.planSlug,
      cycle: sub.cycle,
      pro_tapies: sub.proTapies,
      monthly_tapies: monthlyTapies,
      expires_at: toIso(sub.expiresAt!),
      tapies_balance: balance,
      message: '订阅成功（模拟支付）',
    };
  }

  /**
   * POST /api/billing/recharge — 充值 Tapies（模拟支付即时到账）
   */
  async recharge(user: User, dto: RechargeDto) {
    await this.assertTeamAccess(user.id, dto.team_id);

    const sub = await this.findActiveSubscription(user.id, dto.team_id ?? null);
    const bonusPct = this.rechargeBonusFromPlan(sub?.planSlug);
    const bonus = Math.floor((dto.tapies_amount * bonusPct) / 100);
    const total = dto.tapies_amount + bonus;
    const payUsd = Math.round(dto.tapies_amount / RECHARGE_TAPIES_PER_USD);

    const balance = await this.prisma.$transaction(async (tx) => {
      return this.creditTapiesInTx(tx, {
        userId: user.id,
        teamId: dto.team_id ?? null,
        amount: total,
        type: 'recharge',
        description:
          bonus > 0
            ? `充值 ${dto.tapies_amount} Tapies（赠 ${bonus}）— 约 $${payUsd}`
            : `充值 ${dto.tapies_amount} Tapies — 约 $${payUsd}`,
        refType: 'order',
        refId: null,
        operatorEmail: user.email,
      });
    });

    return {
      tapies_credited: total,
      tapies_base: dto.tapies_amount,
      bonus_tapies: bonus,
      pay_usd: payUsd,
      pay_cny: payUsd * RECHARGE_CNY_PER_USD,
      tapies_balance: balance,
      message: '充值成功（模拟支付）',
    };
  }

  /** POST /api/billing/gift-packs/:id/purchase — 购买礼包 */
  async purchaseGiftPack(user: User, packId: string, teamId?: string) {
    await this.assertTeamAccess(user.id, teamId);

    let credited = 0;
    const balance = await this.prisma.$transaction(async (tx) => {
      const pack = await tx.giftPack.findUnique({ where: { id: packId } });
      if (!pack || !pack.active) throw new NotFoundException('礼包不存在');
      if (pack.stockRemaining <= 0) {
        throw new BadRequestException('礼包已售罄');
      }
      credited = pack.tapiesAmount;

      await tx.giftPack.update({
        where: { id: packId },
        data: { stockRemaining: { decrement: 1 } },
      });

      return this.creditTapiesInTx(tx, {
        userId: user.id,
        teamId: teamId ?? null,
        amount: pack.tapiesAmount,
        type: 'gift_pack',
        description: `礼包超市 — ${pack.modelName} ${pack.tier}`,
        refType: 'gift_pack',
        refId: pack.id,
        operatorEmail: user.email,
      });
    });

    return {
      tapies_credited: credited,
      tapies_balance: balance,
      message: '购买成功（模拟支付）',
    };
  }

  /** GET /api/billing/team-benefits — 团队权益（动态团队 ID + 订阅 + 配额） */
  async getTeamBenefits(user: User, teamId?: string) {
    if (!teamId) {
      const sub = await this.findActiveSubscription(user.id, null);
      const userRow = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { tapiesBalance: true },
      });
      return {
        scope: 'personal',
        team_id: null,
        public_id: null,
        name: user.name ?? user.email,
        tapies_balance: userRow?.tapiesBalance ?? 0,
        plan_slug: sub?.planSlug ?? 'free',
        plan_name: this.planDisplayName(sub?.planSlug ?? 'free'),
        cycle: sub?.cycle ?? null,
        pro_tapies: sub?.proTapies ?? null,
        quotas: [],
      };
    }

    await this.assertTeamAccess(user.id, teamId);
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!team) throw new NotFoundException('团队不存在');

    const sub = await this.findActiveSubscription(user.id, teamId);
    const quotas = team.members.map((m) => ({
      user_id: m.userId,
      name: m.user.name ?? m.user.email,
      email: m.user.email,
      role: m.role,
      quota_used: m.quotaUsed,
      quota_limit: m.quotaLimit,
      unlimited: m.quotaLimit === null,
    }));

    return {
      scope: 'team',
      team_id: team.id,
      public_id: team.publicId,
      name: team.name,
      tapies_balance: team.tapiesBalance,
      plan_slug: sub?.planSlug ?? 'free',
      plan_name: this.planDisplayName(sub?.planSlug ?? 'free'),
      cycle: sub?.cycle ?? null,
      pro_tapies: sub?.proTapies ?? null,
      quotas,
    };
  }

  /** GET /api/billing/rewards/history — 兑换记录 */
  async listRedemptionHistory(user: User) {
    const rows = await this.prisma.redemptionRecord.findMany({
      where: { userId: user.id },
      orderBy: { redeemedAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => ({
      code: row.codeDisplay,
      activity: row.activityName,
      time: row.redeemedAt.toISOString().slice(0, 16).replace('T', ' '),
      points: row.tapiesAmount,
    }));
  }

  /** POST /api/billing/rewards/redeem — 兑换码兑换 */
  async redeemCode(user: User, dto: RedeemCodeDto) {
    await this.assertTeamAccess(user.id, dto.team_id);

    const normalized = dto.code.trim().toUpperCase();
    const balance = await this.prisma.$transaction(async (tx) => {
      const codeRow = await tx.redemptionCode.findUnique({
        where: { code: normalized },
      });
      if (!codeRow) throw new BadRequestException('兑换码无效');
      if (codeRow.expiresAt && codeRow.expiresAt < new Date()) {
        throw new BadRequestException('兑换码已过期');
      }
      if (codeRow.usedCount >= codeRow.maxUses) {
        throw new BadRequestException('兑换码已达使用上限');
      }

      const dup = await tx.redemptionRecord.findFirst({
        where: { codeId: codeRow.id, userId: user.id },
      });
      if (dup) throw new BadRequestException('您已兑换过该兑换码');

      await tx.redemptionCode.update({
        where: { id: codeRow.id },
        data: { usedCount: { increment: 1 } },
      });

      await tx.redemptionRecord.create({
        data: {
          codeId: codeRow.id,
          userId: user.id,
          teamId: dto.team_id ?? null,
          codeDisplay: maskCode(codeRow.code),
          activityName: codeRow.activityName,
          tapiesAmount: codeRow.tapiesAmount,
        },
      });

      return this.creditTapiesInTx(tx, {
        userId: user.id,
        teamId: dto.team_id ?? null,
        amount: codeRow.tapiesAmount,
        type: 'redeem',
        description: `Promotion code reward ${codeRow.code}`,
        refType: 'code',
        refId: codeRow.id,
        operatorEmail: user.email,
      });
    });

    return {
      tapies_credited: (
        await this.prisma.redemptionCode.findFirst({
          where: { code: normalized },
        })
      )?.tapiesAmount,
      tapies_balance: balance,
      message: '兑换成功',
    };
  }

  /**
   * POST /api/billing/rewards/generate — 临时生成兑换码（验证功能用）
   * 环境变量 BILLING_ALLOW_GENERATE=false 时关闭
   */
  async generateRedemptionCode(user: User, dto: GenerateCodeDto) {
    const allowed = this.config.get<string>('BILLING_ALLOW_GENERATE', 'true');
    if (allowed === 'false') {
      throw new ForbiddenException('兑换码生成接口已关闭');
    }

    let code = generateRedemptionCode();
    for (let i = 0; i < 5; i++) {
      const exists = await this.prisma.redemptionCode.findUnique({
        where: { code },
      });
      if (!exists) break;
      code = generateRedemptionCode();
    }

    const expiresAt = dto.expires_days
      ? new Date(Date.now() + dto.expires_days * 86400000)
      : null;

    const row = await this.prisma.redemptionCode.create({
      data: {
        code,
        activityName: dto.activity_name.trim(),
        tapiesAmount: dto.tapies_amount,
        maxUses: dto.max_uses ?? 1,
        expiresAt,
        createdBy: user.id,
      },
    });

    return {
      code: row.code,
      activity_name: row.activityName,
      tapies_amount: row.tapiesAmount,
      max_uses: row.maxUses,
      expires_at: row.expiresAt ? toIso(row.expiresAt) : null,
      message: '兑换码已生成（临时接口，后续将移除）',
    };
  }

  /** GET /api/billing/transactions — 交易流水 */
  async listTransactions(user: User, dto: ListTransactionsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const where = {
      userId: user.id,
      ...(dto.team_id ? { teamId: dto.team_id } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.tapiesLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.tapiesLedger.count({ where }),
    ]);

    const typeLabel: Record<string, string> = {
      recharge: '充值-通用Tapies',
      subscription: '订阅-通用Tapies',
      gift_pack: '充值-礼包Tapies',
      redeem: '充值-通用Tapies',
      consume: '消费-通用Tapies',
    };

    return {
      total,
      page,
      items: rows.map((row) => ({
        id: row.id.replace(/-/g, '').slice(0, 19),
        time: formatLedgerTime(row.createdAt),
        type: typeLabel[row.type] ?? row.type,
        desc: row.description,
        operator: row.operatorEmail ?? user.email,
        amount: row.amount >= 0 ? `+${row.amount}` : String(row.amount),
        status: 'done',
      })),
    };
  }

  // ── 内部工具 ──

  private planDisplayName(slug: string) {
    const map: Record<string, string> = {
      free: '免费版',
      basic: 'BASIC',
      pro: 'PRO',
      ultimate: 'ULTIMATE',
      max: 'MAX',
      enterprise: '企业版',
    };
    return map[slug] ?? slug;
  }

  private rechargeBonusFromPlan(planSlug?: string | null) {
    const map: Record<string, number> = {
      pro: 10,
      ultimate: 20,
      max: 30,
    };
    return planSlug ? map[planSlug] ?? 0 : 0;
  }

  private async findActiveSubscription(userId: number, teamId: string | null) {
    return this.prisma.userSubscription.findFirst({
      where: {
        userId,
        teamId,
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertTeamAccess(userId: number, teamId?: string | null) {
    if (!teamId) return;
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!member) throw new ForbiddenException('无权操作该团队账户');
  }

  private async getBalance(userId: number, teamId: string | null) {
    if (teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        select: { tapiesBalance: true },
      });
      return team?.tapiesBalance ?? 0;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tapiesBalance: true },
    });
    return user?.tapiesBalance ?? 0;
  }

  /** 在事务内入账并写流水，返回变动后余额 */
  private async creditTapiesInTx(
    tx: Prisma.TransactionClient,
    opts: {
      userId: number;
      teamId: string | null;
      amount: number;
      type: string;
      description: string;
      refType: string | null;
      refId: string | null;
      operatorEmail: string;
    },
  ) {
    let balanceAfter: number;
    if (opts.teamId) {
      const updated = await tx.team.update({
        where: { id: opts.teamId },
        data: { tapiesBalance: { increment: opts.amount } },
      });
      balanceAfter = updated.tapiesBalance;
    } else {
      const updated = await tx.user.update({
        where: { id: opts.userId },
        data: { tapiesBalance: { increment: opts.amount } },
      });
      balanceAfter = updated.tapiesBalance;
    }

    await tx.tapiesLedger.create({
      data: {
        userId: opts.userId,
        teamId: opts.teamId,
        type: opts.type,
        amount: opts.amount,
        balanceAfter,
        description: opts.description,
        refType: opts.refType,
        refId: opts.refId,
        operatorEmail: opts.operatorEmail,
      },
    });

    return balanceAfter;
  }
}
