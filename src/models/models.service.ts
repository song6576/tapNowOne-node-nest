import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AiModelCategory = 'text' | 'image' | 'video' | 'audio';

export type AiModelDto = {
  id: string;
  slug: string;
  label: string;
  category: AiModelCategory;
  description: string;
  usage_hint: string | null;
  icon: string;
  tier: string | null;
  is_premium: boolean;
  is_coming_soon: boolean;
  node_types: string[];
  sort_order: number;
};

@Injectable()
export class ModelsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(row: {
    id: string;
    slug: string;
    label: string;
    category: string;
    description: string;
    usageHint: string | null;
    icon: string;
    tier: string | null;
    isPremium: boolean;
    isComingSoon: boolean;
    nodeTypes: string;
    sortOrder: number;
  }): AiModelDto {
    return {
      id: row.id,
      slug: row.slug,
      label: row.label,
      category: row.category as AiModelCategory,
      description: row.description,
      usage_hint: row.usageHint,
      icon: row.icon,
      tier: row.tier,
      is_premium: row.isPremium,
      is_coming_soon: row.isComingSoon,
      node_types: row.nodeTypes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      sort_order: row.sortOrder,
    };
  }

  /** GET /api/models — 可选 category、node_type 过滤 */
  async list(params: { category?: string; nodeType?: string }) {
    const rows = await this.prisma.aiModel.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    });

    let models = rows.map((r) => this.toDto(r));

    if (params.category) {
      models = models.filter((m) => m.category === params.category);
    }

    if (params.nodeType) {
      models = models.filter((m) => m.node_types.includes(params.nodeType!));
    }

    const available = models.filter((m) => !m.is_coming_soon);
    const coming_soon = models.filter((m) => m.is_coming_soon);

    const by_category = {
      text: available.filter((m) => m.category === 'text'),
      image: available.filter((m) => m.category === 'image'),
      video: available.filter((m) => m.category === 'video'),
      audio: available.filter((m) => m.category === 'audio'),
    };

    return {
      models: available,
      coming_soon,
      by_category,
      default_slug: 'qwen3.7-plus',
      default_image_slug: 'qwen-image-2.0-pro-2026-04-22',
    };
  }

  /** 校验 Agent 请求中的 model slug */
  async isAllowedSlug(slug: string): Promise<boolean> {
    const row = await this.prisma.aiModel.findFirst({
      where: { slug, active: true, isComingSoon: false },
    });
    return !!row;
  }
}
