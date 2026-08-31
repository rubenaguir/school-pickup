import { useCallback, useEffect, useState } from 'react';
import { ApiError, asApiError } from '@casillego/shared';
import { apiClient } from '../api/client';

/** Body of GET /users/me (specs/api-contracts/users.md). `email` is read-only (ADR-059 point 4). */
export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  notifyEnrollmentApproved: boolean;
  notifyDismissalReminder: boolean;
  notifyDeliveryConfirmed: boolean;
  notifyProductNews: boolean;
}

/** Body of PATCH /users/me. Partial edit — the screen sends only what changed. */
export type ProfileChanges = Partial<
  Pick<
    Profile,
    | 'fullName'
    | 'phone'
    | 'notifyEnrollmentApproved'
    | 'notifyDismissalReminder'
    | 'notifyDeliveryConfirmed'
    | 'notifyProductNews'
  >
>;

export interface ChangePasswordDraft {
  currentPassword: string;
  newPassword: string;
}

export type ProfileStatus = 'loading' | 'ready' | 'error';

/**
 * `POST /users/me/change-password` answers 401 INVALID_CURRENT_PASSWORD for a
 * wrong current password — not an expired session (ADR-059/specs/api-contracts/users.md).
 * Same treatment as `PATCH /pickup-requests/:id/deliver` in the gate console:
 * that code must not trigger the transparent refresh, or a typo would be
 * retried as if the token had expired.
 */
const SKIP_REFRESH_CODES = ['INVALID_CURRENT_PASSWORD'] as const;

export interface ProfileValue {
  status: ProfileStatus;
  profile: Profile | null;
  /** Only set while `status === 'error'` — the profile failed to load. */
  error: ApiError | null;
  reload: () => void;

  save: (changes: ProfileChanges) => void;
  saving: boolean;
  /** Last save failure; cleared when a new save starts. */
  saveError: ApiError | null;
  /** Bumped on every successful save, so the screen can confirm it. */
  savedCount: number;

  changePassword: (draft: ChangePasswordDraft, onSuccess: () => void) => void;
  changingPassword: boolean;
  changePasswordError: ApiError | null;
  clearChangePasswordError: () => void;
}

/**
 * The rest of "Perfil" for a tutor (feature 026): personal data, notification
 * preferences, and password change. "Mis vehículos" is loaded separately by
 * `useVehicles` — feature 014, already shipped.
 */
export function useProfile(): ProfileValue {
  const [status, setStatus] = useState<ProfileStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
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
      .get<Profile>('/users/me')
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

  const save = useCallback((changes: ProfileChanges) => {
    setSaving(true);
    setSaveError(null);

    void apiClient
      .patch<Profile>('/users/me', changes)
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
