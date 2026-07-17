import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ComposeClipDto {
  @IsString()
  @MaxLength(128)
  node_id!: string;

  @IsString()
  @MaxLength(2048)
  url!: string;

  @IsIn(['image', 'video'])
  type!: 'image' | 'video';

  @IsNumber()
  @Min(0.5)
  @Max(60)
  duration!: number;
}

export class ComposeCaptionDto {
  @IsString()
  @MaxLength(4000)
  text!: string;

  @IsNumber()
  @Min(0)
  start!: number;

  @IsNumber()
  @Min(0)
  end!: number;
}

export class ComposeAudioTrackDto {
  @IsString()
  @MaxLength(2048)
  url!: string;

  @IsNumber()
  @Min(0)
  start!: number;

  @IsNumber()
  @Min(0)
  @Max(2)
  volume!: number;
}

export class ComposeDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ComposeClipDto)
  clips!: ComposeClipDto[];

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ComposeCaptionDto)
  captions!: ComposeCaptionDto[];

  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => ComposeAudioTrackDto)
  audio_tracks!: ComposeAudioTrackDto[];

  @IsInt()
  @Min(320)
  @Max(3840)
  width!: number;

  @IsInt()
  @Min(240)
  @Max(2160)
  height!: number;

  @IsInt()
  @Min(15)
  @Max(60)
  fps!: number;
}
