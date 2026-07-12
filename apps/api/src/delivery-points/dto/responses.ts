import type { DeliveryPointStatus } from '@casillego/shared';

export interface DeliveryPointResponse {
  id: string;
  institutionId: string;
  name: string;
  description: string | null;
  operatorUserId: string | null;
  assignedGroups: string[] | null;
  status: DeliveryPointStatus;
}

export interface ListDeliveryPointsResponse {
  deliveryPoints: DeliveryPointResponse[];
}
