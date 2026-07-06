import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { TeamScopeQueryDto } from '../../teams/dto/teams.dto';

export class CreateFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  parentId?: string | null;
}

export class CreateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  thumbnail?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  folderId?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  teamId?: string | null;
}

export class WorkspaceSearchQueryDto extends TeamScopeQueryDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsIn(['all', 'folders', 'projects'])
  type?: 'all' | 'folders' | 'projects';

  @IsOptional()
  @IsIn(['updatedAt', 'createdAt'])
  sortBy?: 'updatedAt' | 'createdAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  /** 为 true 时返回空间内全部项目（不限文件夹层级），用于画布选择器等 */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  flat?: boolean;
}
