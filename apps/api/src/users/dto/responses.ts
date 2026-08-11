export interface UserProfileResponse {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  notifyEnrollmentApproved: boolean;
  notifyDismissalReminder: boolean;
  notifyDeliveryConfirmed: boolean;
  notifyProductNews: boolean;
}

export interface ChangePasswordResponse {
  success: true;
}
