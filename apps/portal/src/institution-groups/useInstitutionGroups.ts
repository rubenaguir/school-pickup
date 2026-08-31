import { useCallback, useEffect, useState } from 'react';
import { ApiError, asApiError } from '@casillego/shared';
import { apiClient } from '../api/client';

/**
 * One row of GET /institutions/:id/groups (specs/api-contracts/institution-groups.md,
 * ADR-084). The catalog that replaces the free-text `gradeOrGroup`/`assignedGroups`
 * that used to live directly on enrollments/delivery-points.
 */
export interface InstitutionGroup {
  id: string;
  institutionId: string;
  name: string;
  enrollmentsCount: number;
  deliveryPointsCount: number;
}

export type InstitutionGroupsStatus = 'loading' | 'ready' | 'error';

/**
 * A 409 GROUP_IN_USE on delete, resolved from the already-loaded `groups` list
 * rather than parsed off the error body: `ApiError` only carries `{ code,
 * message, details }` (ADR-028 point 1) and the list endpoint already reports
 * the same `enrollmentsCount`/`deliveryPointsCount` shown on screen, so there
 * is nothing the error body would tell us that the list hasn't already.
 */
export interface GroupInUseWarning {
  groupId: string;
  groupName: string;
  enrollmentsCount: number;
  deliveryPointsCount: number;
}

export interface InstitutionGroupsValue {
  status: InstitutionGroupsStatus;
  groups: InstitutionGroup[];
  error: ApiError | null;
  reload: () => void;
  createGroup: (name: string) => Promise<InstitutionGroup>;
  renameGroup: (id: string, name: string) => Promise<InstitutionGroup>;
  /**
   * First call with `confirm = false` (or omitted): if the group is in use,
   * rejects with a `GroupInUseError` the caller can catch to show the
   * warning, per the two-step delete flow (ADR-084 punto 6). Call again with
   * `confirm = true` to proceed regardless.
   */
  deleteGroup: (id: string, confirm?: boolean) => Promise<void>;
}

interface ListInstitutionGroupsResponse {
  groups: InstitutionGroup[];
}

/** Thrown by `deleteGroup` instead of the raw 409, carrying the usage counts. */
export class GroupInUseError extends Error {
  readonly warning: GroupInUseWarning;
  constructor(warning: GroupInUseWarning) {
    super('GROUP_IN_USE');
    this.name = 'GroupInUseError';
    this.warning = warning;
  }
}

/**
 * Loads and manages the group catalog of one institution (ADR-084). Read by
 * the "Grupos" screen (full CRUD) and by every autocompletar-o-crear input
 * that assigns a group elsewhere (`DeliveryPoints`, `PendingEnrollments`,
 * `Students`) — same shared-hook criterion as `useInstitutionMembers`.
 */
export function useInstitutionGroups(institutionId: string | null): InstitutionGroupsValue {
  const [status, setStatus] = useState<InstitutionGroupsStatus>('loading');
  const [groups, setGroups] = useState<InstitutionGroup[]>([]);
  const [error, setError] = useState<ApiError | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setStatus('loading');
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;

    apiClient
      .get<ListInstitutionGroupsResponse>(
        `/institutions/${encodeURIComponent(institutionId)}/groups`,
      )
      .then((response) => {
        if (cancelled) return;
        setGroups(response.groups);
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

  const createGroup = useCallback(
    (name: string): Promise<InstitutionGroup> => {
      if (!institutionId) return Promise.reject(asApiError(undefined));
      return apiClient
        .post<InstitutionGroup>(`/institutions/${encodeURIComponent(institutionId)}/groups`, {
          name,
        })
        .then((created) => {
          setGroups((current) => [...current, created]);
          return created;
        })
        .catch((caught: unknown) => {
          throw asApiError(caught);
        });
    },
    [institutionId],
  );

  const renameGroup = useCallback((id: string, name: string): Promise<InstitutionGroup> => {
    return apiClient
      .patch<InstitutionGroup>(`/groups/${encodeURIComponent(id)}`, { name })
      .then((updated) => {
        setGroups((current) => current.map((group) => (group.id === id ? updated : group)));
        return updated;
      })
      .catch((caught: unknown) => {
        throw asApiError(caught);
      });
  }, []);

  const deleteGroup = useCallback(
    (id: string, confirm = false): Promise<void> => {
      const query = confirm ? '?confirm=true' : '';
      return apiClient
        .del<void>(`/groups/${encodeURIComponent(id)}${query}`)
        .then(() => {
          setGroups((current) => current.filter((group) => group.id !== id));
        })
        .catch((caught: unknown) => {
          const apiError = asApiError(caught);
          if (!confirm && apiError.status === 409) {
            const group = groups.find((item) => item.id === id);
            throw new GroupInUseError({
              groupId: id,
              groupName: group?.name ?? '',
              enrollmentsCount: group?.enrollmentsCount ?? 0,
              deliveryPointsCount: group?.deliveryPointsCount ?? 0,
            });
          }
          throw apiError;
        });
    },
    [groups],
  );

  return { status, groups, error, reload, createGroup, renameGroup, deleteGroup };
}
