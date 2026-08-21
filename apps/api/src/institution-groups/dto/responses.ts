export interface InstitutionGroupResponse {
  id: string;
  institutionId: string;
  name: string;
  enrollmentsCount: number;
  deliveryPointsCount: number;
}

export interface ListInstitutionGroupsResponse {
  groups: InstitutionGroupResponse[];
}
