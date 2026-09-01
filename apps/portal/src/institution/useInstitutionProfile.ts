import { useCallback, useEffect, useState } from 'react';
import { ApiError, asApiError } from '@casillego/shared';
import type { InstitutionStatus, InstitutionType } from '@casillego/shared';
import type { LatLng } from '@casillego/ui';
import { apiClient } from '../api/client';

/**
 * Body of GET /institutions/:id (specs/api-contracts/institutions.md).
 * Declared here rather than reusing the `Institution` entity of
 * `@casillego/shared`: this is the API projection — `location` is `{lat,lng}`,
 * not a PostGIS point, and the timestamps are not part of it. Same criterion
 * as `Membership` in InstitutionContext.
 */
export interface InstitutionProfile {
  id: string;
  name: string;
  type: InstitutionType;
  category: string | null;
  address: string;
  location: LatLng;
  geofenceRadiusMeters: number;
  activationRadiusMeters: number;
  timezone: string;
  cctCode: string | null;
  levels: string[];
  arrivalToleranceMinutes: number;
  advanceNoticeMinutes: number;
  arrivingLeadMinutes: number;
  attentionWaitMinutes: number;
  joinCode: string;
  status: InstitutionStatus;
}

/**
 * Body of PATCH /institutions/:id. Every field is optional: the screen sends
 * only what changed (partial edit, feature 008). `type`, `joinCode` and
 * `status` are not editable through this endpoint and are absent on purpose.
 */
export type InstitutionProfileChanges = Partial<
  Pick<
    InstitutionProfile,
    | 'name'
    | 'category'
    | 'address'
    | 'location'
    | 'geofenceRadiusMeters'
    | 'activationRadiusMeters'
    | 'timezone'
    | 'cctCode'
    | 'levels'
    | 'arrivalToleranceMinutes'
    | 'advanceNoticeMinutes'
    | 'arrivingLeadMinutes'
    | 'attentionWaitMinutes'
  >
>;

/** PATCH answers the profile without `type` and `joinCode` (see the contract). */
type UpdateInstitutionResponse = Omit<InstitutionProfile, 'type' | 'joinCode'>;

export type InstitutionProfileStatus = 'loading' | 'ready' | 'error';

export interface InstitutionProfileValue {
  status: InstitutionProfileStatus;
  profile: InstitutionProfile | null;
  /** Only set while `status === 'error'` — the profile failed to load. */
  error: ApiError | null;
  reload: () => void;
  save: (changes: InstitutionProfileChanges) => void;
  saving: boolean;
  /** Last save failure; cleared when a new save starts. */
  saveError: ApiError | null;
  /** Bumped on every successful save, so the screen can confirm it. */
  savedCount: number;
}

/**
 * Loads and edits the profile of one institution (feature 008).
 *
 * `institutionId` comes from `useInstitution()`; it is null only while the
 * membership lookup is in flight, which `<InstitutionGate>` already gates on.
 */
export function useInstitutionProfile(institutionId: string | null): InstitutionProfileValue {
  const [status, setStatus] = useState<InstitutionProfileStatus>('loading');
  const [profile, setProfile] = useState<InstitutionProfile | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // Same shape as usePendingEnrollments: 'loading' is the initial state and
  // `reload` restores it from an event handler, so the effect never sets state
  // synchronously.
  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    setSaveError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;

    apiClient
      .get<InstitutionProfile>(`/institutions/${encodeURIComponent(institutionId)}`)
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
  }, [institutionId, attempt]);

  const save = useCallback(
    (changes: InstitutionProfileChanges) => {
      if (!institutionId) return;
      setSaving(true);
      setSaveError(null);

      void apiClient
        .patch<UpdateInstitutionResponse>(
          `/institutions/${encodeURIComponent(institutionId)}`,
          changes,
        )
        .then((response) => {
          // The response carries every field back, so the screen keeps showing
          // what the server actually stored. `type` and `joinCode` are not part
          // of it and stay as they were loaded.
          setProfile((current) => (current ? { ...current, ...response } : current));
          setSavedCount((n) => n + 1);
        })
        .catch((caught: unknown) => {
          setSaveError(asApiError(caught));
        })
        .finally(() => {
          setSaving(false);
        });
    },
    [institutionId],
  );

  return { status, profile, error, reload, save, saving, saveError, savedCount };
}
