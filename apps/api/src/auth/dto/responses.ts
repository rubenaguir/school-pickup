export interface RegisterInstitutionResponse {
  institution: { id: string; name: string; status: 'pending'; joinCode: string };
  user: { id: string; email: string; status: 'invited' | 'active' };
}

export interface RegisterGuardianResponse {
  user: { id: string; email: string; status: 'invited' };
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface VerifyEmailResponse {
  status: 'active';
}

export interface ResendVerificationResponse {
  message: string;
}
