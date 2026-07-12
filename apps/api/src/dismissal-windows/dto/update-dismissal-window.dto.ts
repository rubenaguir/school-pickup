import {
  IsIn,
  IsInt,
  IsMilitaryTime,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { DismissalWindowStatus } from '@casillego/shared';

const DISMISSAL_WINDOW_STATUS_VALUES: readonly DismissalWindowStatus[] = ['active', 'paused'];

export class UpdateDismissalWindowDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  @IsOptional()
  @IsMilitaryTime()
  startTime?: string;

  @IsOptional()
  @IsMilitaryTime()
  endTime?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @IsOptional()
  @IsString()
  level?: string | null;

  @IsOptional()
  @IsIn(DISMISSAL_WINDOW_STATUS_VALUES)
  status?: DismissalWindowStatus;
}
