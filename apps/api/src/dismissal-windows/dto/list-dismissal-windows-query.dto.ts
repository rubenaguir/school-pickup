import { IsIn, IsOptional } from 'class-validator';
import type { DismissalWindowStatus } from '@casillego/shared';

const DISMISSAL_WINDOW_STATUS_VALUES: readonly DismissalWindowStatus[] = ['active', 'paused'];

export class ListDismissalWindowsQueryDto {
  @IsOptional()
  @IsIn(DISMISSAL_WINDOW_STATUS_VALUES)
  status?: DismissalWindowStatus;
}
