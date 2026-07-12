import type { DismissalWindowStatus } from '@casillego/shared';

export interface DismissalWindowResponse {
  id: string;
  institutionId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  label: string;
  level: string | null;
  status: DismissalWindowStatus;
}

export interface ListDismissalWindowsResponse {
  dismissalWindows: DismissalWindowResponse[];
}
