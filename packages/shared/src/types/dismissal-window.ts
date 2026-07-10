export type DismissalWindowStatus = 'active' | 'paused';

export interface DismissalWindow {
  id: string;
  institutionId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  label: string;
  level?: string;
  status: DismissalWindowStatus;
}
