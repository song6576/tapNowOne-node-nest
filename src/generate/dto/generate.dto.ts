import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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
  @IsInt()
  @Min(1)
  @Max(30)
  duration?: number;
}
