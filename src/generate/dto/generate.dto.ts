import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VIDEO_RATIOS, VIDEO_RESOLUTIONS } from '../../ai/video-params';

export class GenerateDto {
  @IsIn(['image', 'video', 'audio'])
  node_type!: 'image' | 'video' | 'audio';

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  model?: string;

  @IsOptional()
  @IsBoolean()
  auto?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  upstream_text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  upstream_image_url?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  upstream_image_urls?: string[];

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(15)
  duration?: number;

  @IsOptional()
  @IsIn([...VIDEO_RESOLUTIONS])
  resolution?: string;

  @IsOptional()
  @IsIn([...VIDEO_RATIOS])
  ratio?: string;

  @IsOptional()
  @IsBoolean()
  watermark?: boolean;
}
