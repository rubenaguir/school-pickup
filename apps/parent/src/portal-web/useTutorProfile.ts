import { useCallback, useEffect, useState } from 'react';
import { ApiError, asApiError } from '@casillego/shared';
import { apiClient } from '../api/client';

/**
 * Body of GET /users/me (specs/api-contracts/users.md, ADR-059). `email` is
 * read-only. `notifyProductNews` exists on the same resource but stays out of
 * this type on purpose — that toggle is portal-only (ADR-078 punto 2), and
 * this screen has no use for it.
 */
export interface TutorProfile {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  notifyEnrollmentApproved: boolean;
  notifyDismissalReminder: boolean;
  notifyDeliveryConfirmed: boolean;
}

/** Body of PATCH /users/me. Partial edit — the screen sends only what changed. */
export type TutorProfileChanges = Partial<
  Pick<
    TutorProfile,
    | 'fullName'
    | 'phone'
    | 'notifyEnrollmentApproved'
    | 'notifyDismissalReminder'
    | 'notifyDeliveryConfirmed'
  >
>;

export interface ChangePasswordDraft {
  currentPassword: string;
  newPassword: string;
}

export type TutorProfileStatus = 'loading' | 'ready' | 'error';

/**
 * Same 401 carve-out as `apps/portal/src/profile/useProfile.ts`: a wrong
 * current password is not an expired session and must not trigger the
 * transparent refresh.
 */
const SKIP_REFRESH_CODES = ['INVALID_CURRENT_PASSWORD'] as const;

export interface TutorProfileValue {
  status: TutorProfileStatus;
  profile: TutorProfile | null;
  error: ApiError | null;
  reload: () => void;

  save: (changes: TutorProfileChanges) => void;
  saving: boolean;
  saveError: ApiError | null;
  savedCount: number;

  changePassword: (draft: ChangePasswordDraft, onSuccess: () => void) => void;
  changingPassword: boolean;
  changePasswordError: ApiError | null;
  clearChangePasswordError: () => void;
}

/**
 * The account/password/notifications part of "Perfil" for a tutor (ADR-078
 * punto 3): same shape as `apps/portal`'s `useProfile`, scoped to the 3
 * notification toggles this surface actually shows. "Mis vehículos" is
 * loaded separately by `useMyVehicles`.
 */
export function useTutorProfile(): TutorProfileValue {
  const [status, setStatus] = useState<TutorProfileStatus>('loading');
  const [profile, setProfile] = useState<TutorProfile | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    setSaveError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<TutorProfile>('/users/me')
      .then((response) => {
        if (cancelled) return;
        setProfile(response);
        setStatus('ready');
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(asApiError(caught));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const save = useCallback((changes: TutorProfileChanges) => {
    setSaving(true);
    setSaveError(null);

    void apiClient
      .patch<TutorProfile>('/users/me', changes)
      .then((response) => {
        setProfile(response);
        setSavedCount((n) => n + 1);
      })
      .catch((caught: unknown) => {
        setSaveError(asApiError(caught));
      })
      .finally(() => {
        setSaving(false);
      });
  }, []);

  const [changingPassword, setChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<ApiError | null>(null);

  const clearChangePasswordError = useCallback(() => setChangePasswordError(null), []);

  const changePassword = useCallback((draft: ChangePasswordDraft, onSuccess: () => void) => {
    setChangingPassword(true);
    setChangePasswordError(null);

    void apiClient
      .post<{ success: true }>('/users/me/change-password', draft, {
        skipRefreshForCodes: SKIP_REFRESH_CODES,
      })
      .then(() => {
        onSuccess();
      })
      .catch((caught: unknown) => {
        setChangePasswordError(asApiError(caught));
      })
      .finally(() => {
        setChangingPassword(false);
      });
  }, []);

  return {
    status,
    profile,
    error,
    reload,
    save,
    saving,
    saveError,
    savedCount,
    changePassword,
    changingPassword,
    changePasswordError,
    clearChangePasswordError,
  };
}
