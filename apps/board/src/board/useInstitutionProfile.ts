import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

/**
 * The one field Carril's progress bar needs (§5 of the ADR-071 prompt),
 * projected out of `GET /institutions/:id` rather than declaring the whole
 * `GetInstitutionResponse` shape locally — same trimmed-projection criterion
 * as `DeliveryPointResponse` in `useDeliveryPoints.ts`.
 */
interface InstitutionProfileResponse {
  advanceNoticeMinutes: number;
}

export type InstitutionProfileStatus = 'loading' | 'ready' | 'error';

export interface InstitutionProfileValue {
  status: InstitutionProfileStatus;
  advanceNoticeMinutes: number;
}

/**
 * Fallback used while loading or after a failed load, so `progressPercent`
 * (`board-display.ts`) always has a number to divide by instead of the
 * screen having to special-case "no profile yet". Matches the `institutions`
 * column default (`specs/entities/institution.md`) — a reasonable stand-in,
 * not a guess.
 */
const FALLBACK_ADVANCE_NOTICE_MINUTES = 15;

/**
 * Institution profile, loaded once at mount — same "single load, no realtime
 * channel" pattern as `useDeliveryPoints`/`useDismissalWindow` (ADR-069
 * point 8, ADR-071 point 4). A failed load never blocks the board: it falls
 * back to `FALLBACK_ADVANCE_NOTICE_MINUTES` so Carril's progress bar still
 * renders something reasonable.
 */
export function useInstitutionProfile(institutionId: string | null): InstitutionProfileValue {
  const [status, setStatus] = useState<InstitutionProfileStatus>('loading');
  const [advanceNoticeMinutes, setAdvanceNoticeMinutes] = useState(FALLBACK_ADVANCE_NOTICE_MINUTES);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;

    apiClient
      .get<InstitutionProfileResponse>(`/institutions/${encodeURIComponent(institutionId)}`)
      .then((response) => {
        if (cancelled) return;
        setAdvanceNoticeMinutes(response.advanceNoticeMinutes);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setAdvanceNoticeMinutes(FALLBACK_ADVANCE_NOTICE_MINUTES);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [institutionId]);

  return { status, advanceNoticeMinutes };
}
