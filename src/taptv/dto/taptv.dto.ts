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

const TAPTV_SORTS = ['featured', 'following', 'hot', 'latest'] as const;
const TAPTV_CATEGORIES = [
  'all',
  'animation',
  'canvas',
  'ad',
  'anime',
  'short',
  'mv',
  'creative',
  'tutorial',
  'other',
] as const;

const TAPTV_PUBLISH_CATEGORIES = TAPTV_CATEGORIES.filter((c) => c !== 'all');

export class PublishTapTVDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsUUID()
  projectId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  videoUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  coverUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  subtitleUrl?: string;

  @IsOptional()
  @IsIn(TAPTV_PUBLISH_CATEGORIES)
  category?: (typeof TAPTV_PUBLISH_CATEGORIES)[number];
}

export class ListTapTVDto {
  @IsOptional()
  @IsIn(TAPTV_SORTS)
  sort?: (typeof TAPTV_SORTS)[number];

  @IsOptional()
  @IsIn(TAPTV_CATEGORIES)
  category?: (typeof TAPTV_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
