import { useCallback } from 'react';
import { ApiError, readAccessToken } from '@casillego/shared';
import { useRealtimeChannel } from '@casillego/ui';
import { apiBaseUrl, apiClient, tokenStorage } from '../api/client';
import {
  mergeAndSortBoardMonitorRows,
  parseBoardMonitorDelta,
  type BoardMonitorRow,
} from './board-monitor-rows';
import { buildBoardMonitorSocketUrl, fatalCloseReason } from './board-monitor-socket';
import type { ConnectionState } from './useInstitutionBoard';

/** Page size of the snapshot — same whole-institution criterion as `useInstitutionBoard`. */
const BOARD_MONITOR_PAGE_SIZE = 200;

export type BoardMonitorStatus = 'loading' | 'ready' | 'error';

export interface InstitutionBoardMonitorValue {
  status: BoardMonitorStatus;
  rows: BoardMonitorRow[];
  error: ApiError | null;
  connection: ConnectionState;
  connectionErrorReason: string | null;
  reload: () => void;
}

interface ListInstitutionBoardMonitorResponse {
  pickupRequests: BoardMonitorRow[];
}

function fetchBoardMonitorSnapshot(institutionId: string): Promise<BoardMonitorRow[]> {
  return apiClient
    .get<ListInstitutionBoardMonitorResponse>(
      `/pickup-requests?institutionId=${encodeURIComponent(institutionId)}&view=monitor&limit=${BOARD_MONITOR_PAGE_SIZE}`,
    )
    .then((response) => response.pickupRequests);
}

/**
 * Carril's live channel: REST snapshot (`view=monitor`) plus its own
 * `/ws/board-monitor` deltas (ADR-071 pt.2), via the generic
 * `useRealtimeChannel` (ADR-075) — same snapshot-then-deltas skeleton as
 * `useInstitutionBoard`, minus `onAnnounce`/`recentlyChangedIds`: Carril
 * doesn't animate or voice transitions.
 *
 * Carril is read-only, unlike the gate console — there is no REST action of
 * its own to wrap around the channel, so this is a thinner envelope than
 * `useDeliveryPointQueue`.
 *
 * Callers must only mount this hook while Carril is the active mode (§6 of
 * the ADR-071 prompt) — unmounting closes the socket via the same cleanup
 * pattern as `useInstitutionBoard`, so the screen keeps Andén/Sereno free of
 * this connection by simply not rendering the component that calls it.
 */
export function useInstitutionBoardMonitor(
  institutionId: string | null,
): InstitutionBoardMonitorValue {
  const getSocketUrl = useCallback(() => {
    const accessToken = readAccessToken(tokenStorage) ?? '';
    return buildBoardMonitorSocketUrl(apiBaseUrl, {
      accessToken,
      institutionId: institutionId ?? '',
    });
  }, [institutionId]);

  const fetchSnapshot = useCallback(() => {
    return fetchBoardMonitorSnapshot(institutionId ?? '');
  }, [institutionId]);

  const { status, state, error, connection, connectionErrorReason, reload } = useRealtimeChannel<
    BoardMonitorRow[],
    BoardMonitorRow
  >({
    channelKey: institutionId,
    getSocketUrl,
    fetchSnapshot,
    mergeDelta: mergeAndSortBoardMonitorRows,
    parseDelta: parseBoardMonitorDelta,
    fatalCloseReason,
    refreshToken: () => apiClient.refreshToken(),
  });

  return { status, rows: state ?? [], error, connection, connectionErrorReason, reload };
}
