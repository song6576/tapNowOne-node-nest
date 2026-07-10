/**
 * 订阅套餐静态目录（月付/年付/企业版）
 * 价格与 Tapies 额度对齐 TapNow 参考 UI；套餐不落库，仅 user_subscription 记录用户选择。
 */

export type BillingCycle = 'monthly' | 'yearly' | 'enterprise';

export type ProTier = {
  tapies: number;
  label: string;
  price_cny: number;
  original_cny: number;
};

export type PlanCard = {
  slug: string;
  name: string;
  tagline: string;
  price_cny: number;
  original_cny: number;
  billing_note: string;
  monthly_tapies: number;
  recharge_rate: string;
  recharge_bonus_pct: number;
  badge?: string;
  highlight?: boolean;
  pro_tiers?: ProTier[];
};

const PRO_MONTHLY: ProTier[] = [
  { tapies: 3500, label: '3.5k', price_cny: 210, original_cny: 280 },
  { tapies: 6000, label: '6k', price_cny: 357, original_cny: 420 },
  { tapies: 9500, label: '9.5k', price_cny: 520, original_cny: 630 },
  { tapies: 11500, label: '11.5k', price_cny: 630, original_cny: 756 },
  { tapies: 20000, label: '20k', price_cny: 1050, original_cny: 1260 },
];

const PRO_YEARLY: ProTier[] = [
  { tapies: 3500, label: '3.5k', price_cny: 189, original_cny: 280 },
  { tapies: 6000, label: '6k', price_cny: 315, original_cny: 420 },
  { tapies: 9500, label: '9.5k', price_cny: 472, original_cny: 630 },
  { tapies: 11500, label: '11.5k', price_cny: 567, original_cny: 756 },
  { tapies: 20000, label: '20k', price_cny: 945, original_cny: 1260 },
];

export const MONTHLY_PLANS: PlanCard[] = [
  {
    slug: 'basic',
    name: 'BASIC',
    tagline: '适合初次探索 AI 创作',
    price_cny: 63,
    original_cny: 105,
    billing_note: '按月支付，次月起 约 ¥105/月',
    monthly_tapies: 1500,
    recharge_rate: '¥7 = 100 Tapies',
    recharge_bonus_pct: 0,
  },
  {
    slug: 'pro',
    name: 'PRO',
    tagline: '适合高频创作与持续产出',
    price_cny: 357,
    original_cny: 420,
    billing_note: '按月支付，次月起 约 ¥420/月',
    monthly_tapies: 6000,
    recharge_rate: '额外充值 赠10%  ¥7 = 110 Tapies',
    recharge_bonus_pct: 10,
    badge: '🔥 最受欢迎',
    highlight: true,
    pro_tiers: PRO_MONTHLY,
  },
  {
    slug: 'ultimate',
    name: 'ULTIMATE',
    tagline: '适合大批量稳定产出与交付',
    price_cny: 2142,
    original_cny: 2520,
    billing_note: '按月支付，次月起 约 ¥2520/月',
    monthly_tapies: 36000,
    recharge_rate: '额外充值 赠20%  ¥7 = 120 Tapies',
    recharge_bonus_pct: 20,
  },
  {
    slug: 'max',
    name: 'MAX',
    tagline: '为极限产出而生',
    price_cny: 4284,
    original_cny: 5040,
    billing_note: '按月支付，次月起 约 ¥5040/月',
    monthly_tapies: 72000,
    recharge_rate: '额外充值 赠30%  ¥7 = 130 Tapies',
    recharge_bonus_pct: 30,
    badge: '最佳性价比',
  },
];

export const YEARLY_PLANS: PlanCard[] = [
  {
    slug: 'basic',
    name: 'BASIC',
    tagline: '适合初次探索 AI 创作',
    price_cny: 89,
    original_cny: 105,
    billing_note: '按年支付，年付总价约 ¥1071',
    monthly_tapies: 1500,
    recharge_rate: '¥7 = 100 Tapies',
    recharge_bonus_pct: 0,
  },
  {
    slug: 'pro',
    name: 'PRO',
    tagline: '适合高频创作与持续产出',
    price_cny: 315,
    original_cny: 420,
    billing_note: '按年支付，年付总价约 ¥3780',
    monthly_tapies: 6000,
    recharge_rate: '额外充值 赠10%  ¥7 = 110 Tapies',
    recharge_bonus_pct: 10,
    badge: '🔥 最受欢迎',
    highlight: true,
    pro_tiers: PRO_YEARLY,
  },
  {
    slug: 'ultimate',
    name: 'ULTIMATE',
    tagline: '适合大批量稳定产出与交付',
    price_cny: 1512,
    original_cny: 2520,
    billing_note: '按年支付，年付总价约 ¥18144',
    monthly_tapies: 36000,
    recharge_rate: '额外充值 赠20%  ¥7 = 120 Tapies',
    recharge_bonus_pct: 20,
  },
  {
    slug: 'max',
    name: 'MAX',
    tagline: '为极限产出而生',
    price_cny: 3024,
    original_cny: 5040,
    billing_note: '按年支付，年付总价约 ¥36288',
    monthly_tapies: 72000,
    recharge_rate: '额外充值 赠30%  ¥7 = 130 Tapies',
    recharge_bonus_pct: 30,
    badge: '最佳性价比',
  },
];

/** 企业版 Custom：功能列表 + 合作伙伴 Logo（前端跑马灯） */
export const ENTERPRISE_PLAN = {
  slug: 'enterprise',
  name: 'Custom',
  headline: '我们帮助领先的创意团队在生成时代蓬勃发展。',
  subtitle: '企业级协作的明智之选',
  features: [
    '涵盖全部套餐权益',
    '可按需定制图像、视频、语音与音乐额度',
    '尊享最高优先级队列',
    '支持企业级模板定制',
    '多重数据安全保障',
    '支持成员用量精细化管控（天 / 周 / 月）',
    '支持账单明细查询与发票下载',
    '提供专属服务与响应',
  ],
  partner_logos: [
    { name: 'Kling', label: 'Kling' },
    { name: 'Luma', label: 'Luma' },
    { name: 'Sora', label: 'Sora' },
    { name: 'Midjourney', label: 'Midjourney' },
    { name: 'GPT Image', label: 'GPT Image' },
    { name: 'Seedance', label: 'Seedance' },
    { name: 'Runway', label: 'Runway' },
    { name: 'Pika', label: 'Pika' },
  ],
  contact_cta: '联系销售',
};

export function getPlansForCycle(cycle: BillingCycle) {
  if (cycle === 'enterprise') {
    return { cycle, enterprise: ENTERPRISE_PLAN, plans: [] as PlanCard[] };
  }
  const plans = cycle === 'yearly' ? YEARLY_PLANS : MONTHLY_PLANS;
  return { cycle, plans, enterprise: null };
}

export function resolvePlanTapies(
  cycle: BillingCycle,
  planSlug: string,
  proTapies?: number,
): number {
  if (planSlug === 'enterprise' || planSlug === 'free') return 0;
  const catalog =
    cycle === 'yearly' ? YEARLY_PLANS : MONTHLY_PLANS;
  const plan = catalog.find((p) => p.slug === planSlug);
  if (!plan) return 0;
  if (planSlug === 'pro' && proTapies && plan.pro_tiers) {
    const tier = plan.pro_tiers.find((t) => t.tapies === proTapies);
    return tier?.tapies ?? plan.monthly_tapies;
  }
  return plan.monthly_tapies;
}

/** 充值汇率：$1 = 100 Tapies；套餐赠送比例在 service 中叠加 */
export const RECHARGE_TAPIES_PER_USD = 100;
export const RECHARGE_CNY_PER_USD = 7;
