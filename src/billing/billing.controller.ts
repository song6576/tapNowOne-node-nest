/**
 * 计费 HTTP 路由
 * 完整说明见 docs/API.md「计费 /api/billing」
 *
 * 当前订阅/充值/礼包购买为模拟支付（即时到账），后续可接入 Stripe/支付宝 webhook。
 */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';
import type { BillingCycle } from './billing-plans.data';
import {
  GenerateCodeDto,
  ListTransactionsDto,
  RechargeDto,
  RedeemCodeDto,
  SubscribeDto,
} from './dto/billing.dto';

@Controller('api/billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * GET /api/billing/plans?cycle=monthly|yearly|enterprise
   * 订阅套餐目录；enterprise 返回 Custom 企业版 + partner_logos（前端跑马灯）
   */
  @Get('plans')
  listPlans(@Query('cycle') cycle?: string) {
    const c = (cycle ?? 'yearly') as BillingCycle;
    if (!['monthly', 'yearly', 'enterprise'].includes(c)) {
      return this.billingService.listPlans('yearly');
    }
    return this.billingService.listPlans(c);
  }

  /** GET /api/billing/gift-packs — 礼包超市商品列表 */
  @Get('gift-packs')
  listGiftPacks() {
    return this.billingService.listGiftPacks();
  }

  /** GET /api/billing/team-benefits?team_id= — 团队权益（public_id、订阅、配额） */
  @Get('team-benefits')
  teamBenefits(
    @Req() req: { user: User },
    @Query('team_id') teamId?: string,
  ) {
    return this.billingService.getTeamBenefits(req.user, teamId);
  }

  /** GET /api/billing/transactions — Tapies 交易流水 */
  @Get('transactions')
  transactions(
    @Req() req: { user: User },
    @Query() query: ListTransactionsDto,
  ) {
    return this.billingService.listTransactions(req.user, query);
  }

  /** GET /api/billing/rewards/history — 兑换记录 */
  @Get('rewards/history')
  redemptionHistory(@Req() req: { user: User }) {
    return this.billingService.listRedemptionHistory(req.user);
  }

  /** POST /api/billing/subscribe — 订阅套餐（模拟支付） */
  @Post('subscribe')
  subscribe(@Req() req: { user: User }, @Body() dto: SubscribeDto) {
    return this.billingService.subscribe(req.user, dto);
  }

  /** POST /api/billing/recharge — 充值 Tapies（模拟支付） */
  @Post('recharge')
  recharge(@Req() req: { user: User }, @Body() dto: RechargeDto) {
    return this.billingService.recharge(req.user, dto);
  }

  /** POST /api/billing/gift-packs/:id/purchase — 购买礼包（模拟支付） */
  @Post('gift-packs/:id/purchase')
  purchaseGiftPack(
    @Req() req: { user: User },
    @Param('id') id: string,
    @Body() body: { team_id?: string },
  ) {
    return this.billingService.purchaseGiftPack(req.user, id, body.team_id);
  }

  /** POST /api/billing/rewards/redeem — 兑换码兑换 */
  @Post('rewards/redeem')
  redeem(@Req() req: { user: User }, @Body() dto: RedeemCodeDto) {
    return this.billingService.redeemCode(req.user, dto);
  }

  /**
   * POST /api/billing/rewards/generate — 临时生成兑换码（验证用，后续移除）
   * 生产设置 BILLING_ALLOW_GENERATE=false 关闭
   */
  @Post('rewards/generate')
  generateCode(@Req() req: { user: User }, @Body() dto: GenerateCodeDto) {
    return this.billingService.generateRedemptionCode(req.user, dto);
  }
}
