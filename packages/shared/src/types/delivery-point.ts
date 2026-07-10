export type DeliveryPointStatus = 'active' | 'inactive';

export interface DeliveryPoint {
  id: string;
  institutionId: string;
  name: string;
  description?: string;
  operatorUserId?: string;
  assignedGroups?: string[];
  status: DeliveryPointStatus;
  createdAt: string;
  updatedAt: string;
}
