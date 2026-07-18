import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const MEDIA_TYPES = ['video', 'image'] as const;

/** POST /api/media-favorites/toggle */
export class ToggleMediaFavoriteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  mediaUrl!: string;

  @IsIn(MEDIA_TYPES)
  mediaType!: (typeof MEDIA_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  coverUrl?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nodeId?: string;
}
