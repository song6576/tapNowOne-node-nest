import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const CYCLES = ['monthly', 'yearly', 'enterprise'] as const;
const PLAN_SLUGS = ['basic', 'pro', 'ultimate', 'max', 'enterprise'] as const;

/** POST /api/billing/subscribe — 订阅套餐（当前为模拟支付，直接生效） */
export class SubscribeDto {
  @IsIn(PLAN_SLUGS)
  plan_slug!: (typeof PLAN_SLUGS)[number];

  @IsIn(CYCLES)
  cycle!: (typeof CYCLES)[number];

  /** PRO 档位每月 Tapies（3500/6000/9500/11500/20000） */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  pro_tapies?: number;

  /** 团队订阅时传入 team UUID；个人订阅不传 */
  @IsOptional()
  @IsUUID()
  team_id?: string;
}

/** POST /api/billing/recharge — 充值 Tapies */
export class RechargeDto {
  @Type(() => Number)
  @IsInt()
  @Min(500)
  @Max(5000000)
  tapies_amount!: number;

  @IsOptional()
  @IsUUID()
  team_id?: string;
}

/** POST /api/billing/rewards/redeem — 兑换码 */
export class RedeemCodeDto {
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  code!: string;

  @IsOptional()
  @IsUUID()
  team_id?: string;
}

/**
 * POST /api/billing/rewards/generate — 临时生成兑换码（验证用，后续会移除或迁至管理端）
 * 需登录；生产环境建议设置环境变量 BILLING_ALLOW_GENERATE=false 关闭
 */
export class GenerateCodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  activity_name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  tapies_amount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  max_uses?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  expires_days?: number;
}

export class ListTransactionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsUUID()
  team_id?: string;
}
