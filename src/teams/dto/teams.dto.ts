import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;
}

export class SwitchActiveTeamDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  teamId?: string | null;
}

export class TeamScopeQueryDto {
  @IsOptional()
  @IsUUID()
  teamId?: string;
}

export class UpdateInviteLinkDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;

  @IsOptional()
  @IsBoolean()
  unlimitedQuota?: boolean;
}
