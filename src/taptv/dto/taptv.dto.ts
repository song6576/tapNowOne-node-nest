import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
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
