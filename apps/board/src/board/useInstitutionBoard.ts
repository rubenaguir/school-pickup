import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, asApiError, classifyRefreshFailure, readAccessToken } from '@casillego/shared';
import { apiBaseUrl, apiClient, tokenStorage } from '../api/client';
import {
  mergeBoardDelta,
  parseBoardAnnounce,
  parseBoardDelta,
  sortBoardRows,
  type BoardRow,
} from './board-rows';
import { buildBoardSocketUrl, fatalCloseReason, reconnectDelayMs } from './board-socket';

/**
 * Page size of the snapshot (ADR-069 point 1). Above both the API default of
 * 20 (ADR-024 point 9) and the gate console's 100 (ADR-052 point 2): the
 * board shows the whole institution, potentially several delivery points at
 * once during dismissal, not a single gate's queue. No paging UI, same
 * criterion as the console — a board is not browsed.
 */
const BOARD_PAGE_SIZE = 200;

/**
 * How long a `pickupRequestId` stays in `recentlyChangedIds` after a status
 * change, in milliseconds (ADR-069 point 10). Long enough to cover one pulse
 * of the row's `@keyframes` animation, short enough that ids never pile up.
 */
const RECENTLY_CHANGED_MS = 1_800;

export type BoardStatus = 'loading' | 'ready' | 'error';

/**
 * State of the live channel, independent from `BoardStatus`: the board on
 * screen stays perfectly readable while the socket is down, it just stops
 * moving.
 */
export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed';

export interface InstitutionBoardValue {
  status: BoardStatus;
  /** Active pickups of the institution, soonest ETA first. */
  rows: BoardRow[];
  /** Only set while `status === 'error'` — the whole snapshot failed to load. */
  error: ApiError | null;
  connection: ConnectionState;
  /**
   * `reason` of a close the client must not retry (4400/4401/4403/4404), or
   * null. Translated by the screen, like every other `code`.
   */
  connectionErrorReason: string | null;
  reload: () => void;
  /**
   * Ids whose `status` changed in the last ~1.8s (ADR-069 point 10) — the
   * screen uses this set, and only this set, to decide which row to animate.
   */
  recentlyChangedIds: Set<string>;
}

interface ListInstitutionBoardResponse {
  pickupRequests: BoardRow[];
}

export interface ManualAnnouncePayload {
  pickupRequestId: string;
  studentFullName: string;
}

/**
 * Live board of one institution: REST snapshot plus WebSocket deltas
 * (ADR-068). Same snapshot-then-deltas shape as `useDeliveryPointQueue`
 * (ADR-050 point 6, ADR-069 point 7): the socket opens first and the
 * snapshot is requested from its `open` handler, deltas in flight during the
 * fetch are buffered and folded on top of the response instead of lost.
 *
 * `onAnnounce`, when given, fires once per live delta whose merge lands the
 * pickup's `pickupRequestId` in `changedStatusIds` with a resulting `status`
 * of `approaching`/`arriving`/`arrived` (ADR-069 point 5, ADR-093) — never for
 * deltas folded from the post-reconnect buffer, which only need to produce a
 * consistent final state, not re-announce transitions the kiosk already voiced
 * before the drop. The screen decides what each status sounds like (a chime
 * for `approaching`, a spoken line for the other two); the hook makes no
 * `AudioContext`/`SpeechSynthesis` call itself, so the merge logic stays
 * testable without a browser audio engine.
 *
 * `onManualAnnounce`, when given, fires once per `kind: 'announce'` message
 * — the "Vocear" event an operator triggers from the gate console (ADR-073
 * point 4). Unlike `onAnnounce` it carries no `status` gate: the backend
 * already restricts the action to active pickups (ADR-073 point 2), so any
 * message that reaches this channel is voiced. The announced row is also
 * flagged in `recentlyChangedIds` for the pulse animation, same treatment
 * as a real status change, even though its `status` did not change.
 *
 * An `UNAUTHENTICATED` close gets one `apiClient.refreshToken()` attempt
 * before it is treated as fatal (ADR-091) — this hook backs the one screen
 * that ADR-091 exists for: a kiosk with no REST traffic of its own to ever
 * trigger the ordinary 401 interceptor. Implemented inline rather than
 * through `useRealtimeChannel` because this hook predates that extraction
 * and was deliberately left un-migrated (ADR-075 Fase 10, Paso 3 — it
 * multiplexes `kind: 'row'`/`kind: 'announce'` over one socket, a shape the
 * generic hook does not model).
 */
export function useInstitutionBoard(
  institutionId: string | null,
  onAnnounce?: (row: BoardRow) => void,
  onManualAnnounce?: (payload: ManualAnnouncePayload) => void,
): InstitutionBoardValue {
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [connectionErrorReason, setConnectionErrorReason] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [recentlyChangedIds, setRecentlyChangedIds] = useState<Set<string>>(new Set());

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ institutionId: string; error: ApiError } | null>(null);

  // Read on every call rather than closed over once: an effect keyed on
  // `institutionId` must not re-run just because the screen passed a new
  // function identity for `onAnnounce` on every render. Assigned in an
  // effect, not during render, so a fresh `onAnnounce` reaches an already
  // open socket without React flagging a render-time ref mutation.
  const onAnnounceRef = useRef(onAnnounce);
  useEffect(() => {
    onAnnounceRef.current = onAnnounce;
  }, [onAnnounce]);

  const onManualAnnounceRef = useRef(onManualAnnounce);
  useEffect(() => {
    onManualAnnounceRef.current = onManualAnnounce;
  }, [onManualAnnounce]);

  const status: BoardStatus =
    institutionId === null
      ? 'loading'
      : failure?.institutionId === institutionId
        ? 'error'
        : loadedId === institutionId
          ? 'ready'
          : 'loading';

  const error = status === 'error' ? (failure?.error ?? null) : null;

  const reload = useCallback(() => {
    setLoadedId(null);
    setFailure(null);
    setConnectionErrorReason(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!institutionId) return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    /** Non-null only while a snapshot request is in flight. */
    let buffered: BoardRow[] | null = null;
    /**
     * One `refreshToken()` attempt per connection cycle before giving up on an
     * `UNAUTHENTICATED` close (ADR-091) — reset on every successful `onopen`.
     * This is the screen ADR-091 was written for: a kiosk meant to sit open
     * for hours with no REST traffic of its own to trigger the ordinary 401
     * interceptor, so nothing else in the app would ever renew its token.
     */
    let refreshAttempted = false;
    // Mirrors the `rows` state so merges can be computed synchronously here
    // instead of inside a `setRows` updater — an updater can run twice under
    // React StrictMode in development, and `onAnnounceRef.current?.(delta)`
    // below must fire exactly once per real transition, not twice.
    let localRows: BoardRow[] = [];

    function flagChanged(ids: Set<string>) {
      if (ids.size === 0) return;
      setRecentlyChangedIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.add(id));
        return next;
      });
      setTimeout(() => {
        setRecentlyChangedIds((current) => {
          const next = new Set(current);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }, RECENTLY_CHANGED_MS);
    }

    function applyLiveDelta(delta: BoardRow) {
      if (buffered) {
        buffered.push(delta);
        return;
      }
      const merged = mergeBoardDelta(localRows, delta);
      localRows = sortBoardRows(merged.rows);
      setRows(localRows);
      flagChanged(merged.changedStatusIds);
      if (
        merged.changedStatusIds.has(delta.pickupRequestId) &&
        (delta.status === 'approaching' ||
          delta.status === 'arriving' ||
          delta.status === 'arrived')
      ) {
        onAnnounceRef.current?.(delta);
      }
    }

    function loadSnapshot(id: string) {
      buffered = [];
      apiClient
        .get<ListInstitutionBoardResponse>(
          `/pickup-requests?institutionId=${encodeURIComponent(id)}&limit=${BOARD_PAGE_SIZE}`,
        )
        .then((response) => {
          if (cancelled) return;
          const pending = buffered ?? [];
          buffered = null;
          // The snapshot is the authority after a reconnection — messages
          // published while the socket was down were never stored and are
          // not replayed (specs/api-contracts/board-ws.md). Folded silently:
          // no announcement for a buffer that only reconciles state.
          const merged = pending.reduce(
            (acc, delta) => mergeBoardDelta(acc, delta).rows,
            response.pickupRequests,
          );
          localRows = sortBoardRows(merged);
          setRows(localRows);
          setFailure(null);
          setLoadedId(id);
        })
        .catch((caught: unknown) => {
          buffered = null;
          if (cancelled) return;
          setFailure({ institutionId: id, error: asApiError(caught) });
          setLoadedId(null);
          setConnection('closed');
          socket?.close();
        });
    }

    function connect(id: string) {
      setConnection(retries === 0 ? 'connecting' : 'reconnecting');
      setConnectionErrorReason(null);

      // Read on every attempt, never captured once — same reasoning as
      // `useDeliveryPointQueue`: a reconnection after the REST client renewed
      // the access token must hand the gateway the renewed one.
      const accessToken = readAccessToken(tokenStorage) ?? '';
      const opened = new WebSocket(
        buildBoardSocketUrl(apiBaseUrl, { accessToken, institutionId: id }),
      );
      socket = opened;

      opened.onopen = () => {
        if (cancelled) return;
        retries = 0;
        refreshAttempted = false;
        setConnection('live');
        loadSnapshot(id);
      };

      opened.onmessage = (event: MessageEvent) => {
        if (cancelled) return;
        if (typeof event.data !== 'string') return;

        let raw: unknown;
        try {
          raw = JSON.parse(event.data);
        } catch {
          return;
        }

        const record = raw as { kind?: unknown } | null;
        if (record && record.kind === 'announce') {
          const announce = parseBoardAnnounce(raw);
          if (announce) {
            flagChanged(new Set([announce.pickupRequestId]));
            onManualAnnounceRef.current?.(announce);
          }
          return;
        }

        const delta = parseBoardDelta(raw);
        // A message that is not a recognized board payload is discarded,
        // never applied: one malformed publication cannot corrupt the board
        // on screen.
        if (delta) applyLiveDelta(delta);
      };

      opened.onclose = (event: CloseEvent) => {
        if (cancelled) return;
        buffered = null;

        const fatal = fatalCloseReason(event.code, event.reason);
        if (fatal) {
          if (fatal === 'UNAUTHENTICATED' && !refreshAttempted) {
            refreshAttempted = true;
            setConnection('reconnecting');
            apiClient
              .refreshToken()
              .then(() => {
                if (cancelled) return;
                // Success: reconnect right away — `readAccessToken` above is
                // re-read fresh on every attempt, never captured once.
                connect(id);
              })
              .catch((caught: unknown) => {
                if (cancelled) return;
                if (classifyRefreshFailure(caught) === 'network') {
                  // The refresh itself never got a verdict — same as any
                  // other transport drop, not a reason to give up.
                  retryTimer = setTimeout(() => connect(id), reconnectDelayMs(retries));
                  retries += 1;
                  return;
                }
                // The refresh token was explicitly rejected — the session
                // really is over, same outcome as today.
                setConnection('closed');
                setConnectionErrorReason(fatal);
              });
            return;
          }

          setConnection('closed');
          setConnectionErrorReason(fatal);
          return;
        }

        // A transport drop: the board on screen is frozen until the socket is
        // back, and the reconnection re-reads the snapshot from `onopen`
        // (ADR-069 point 7).
        setConnection('reconnecting');
        retryTimer = setTimeout(() => connect(id), reconnectDelayMs(retries));
        retries += 1;
      };
    }

    connect(institutionId);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      // Nulled first: the handlers above would otherwise schedule a
      // reconnection for a channel nobody is listening to any more.
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [institutionId, attempt]);

  return {
    status,
    rows,
    error,
    connection,
    connectionErrorReason,
    reload,
    recentlyChangedIds,
  };
}
