import type {
  InstitutionAdminPayload,
  InstitutionStatus,
  InstitutionType,
} from '@casillego/shared';
import type { AdminInstitutionListItem, StatusFilter } from './useInstitutionsQueue';

/**
 * One delta of this screen, aliased from `InstitutionAdminPayload` rather
 * than redeclared: the REST snapshot (`GET /admin/institutions`) and the
 * WebSocket deltas carry the very same fields, on purpose, so this screen
 * merges both without transforming either (same criterion as `QueueRow` in
 * `apps/portal/src/gate-console/queue-rows.ts`, ADR-051 pt.3).
 */
export type AdminInstitutionDelta = InstitutionAdminPayload;

function isInstitutionType(value: unknown): value is InstitutionType {
  return value === 'school' || value === 'extracurricular';
}

function isInstitutionStatus(value: unknown): value is InstitutionStatus {
  return value === 'pending' || value === 'approved' || value === 'suspended';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Validates the shape of an incoming WebSocket delta. Never throws — returns
 * `null` for anything that doesn't match, so one malformed message cannot
 * corrupt the queue on screen. Same contract as `parseQueueDelta`.
 */
export function parseAdminInstitutionDelta(raw: unknown): AdminInstitutionDelta | null {
  if (typeof raw !== 'object' || raw === null) return null;

  const payload = raw as Record<string, unknown>;

  if (typeof payload.id !== 'string') return null;
  if (typeof payload.name !== 'string') return null;
  if (!isInstitutionType(payload.type)) return null;
  if (!isNullableString(payload.category)) return null;
  if (!isInstitutionStatus(payload.status)) return null;
  if (typeof payload.joinCode !== 'string') return null;

  return {
    id: payload.id,
    name: payload.name,
    type: payload.type,
    category: payload.category,
    status: payload.status,
    joinCode: payload.joinCode,
  };
}

/**
 * Folds one delta into the queue, by `id`, respecting the `filter` currently
 * active on screen (the REST snapshot is itself filtered server-side by the
 * same `status`, ADR-087):
 *
 * - a delta whose status no longer belongs in `filter` **removes** the row —
 *   same "resolved elsewhere" pattern the pre-realtime version of this hook
 *   already applied to its own optimistic update;
 * - a delta whose status belongs replaces the row, or inserts it if it
 *   wasn't part of this filtered view yet (a transition can bring an
 *   institution into view that this screen never previously loaded);
 * - `filter === 'all'` never removes anything.
 *
 * Pure on purpose, same reasoning as `mergeQueueDelta`.
 */
export function mergeAdminInstitutionDelta(
  institutions: readonly AdminInstitutionListItem[],
  delta: AdminInstitutionDelta,
  filter: StatusFilter,
): AdminInstitutionListItem[] {
  const belongsToFilter = filter === 'all' || delta.status === filter;

  if (!belongsToFilter) {
    return institutions.filter((institution) => institution.id !== delta.id);
  }

  const exists = institutions.some((institution) => institution.id === delta.id);
  if (!exists) {
    return [...institutions, delta];
  }

  return institutions.map((institution) => (institution.id === delta.id ? delta : institution));
}
