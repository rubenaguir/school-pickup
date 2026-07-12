export type UserStatus = 'active' | 'invited' | 'suspended';

export interface User {
  id: string;
  email: string;
  passwordHash?: string;
  fullName?: string;
  phone?: string;
  status: UserStatus;
  isSuperAdmin: boolean;
  notifyEnrollmentApproved: boolean;
  notifyDismissalReminder: boolean;
  notifyDeliveryConfirmed: boolean;
  notifyProductNews: boolean;
  createdAt: string;
  updatedAt: string;
}
