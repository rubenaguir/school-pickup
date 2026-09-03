import { useCallback, useEffect, useState } from 'react';
import { ApiError, asApiError, classifyRefreshFailure, reconnectDelayMs } from '@casillego/shared';

export type RealtimeChannelStatus = 'loading' | 'ready' | 'error';
export type RealtimeConnectionState = 'connecting' | 'live' | 'reconnecting' | 'closed';

export interface UseRealtimeChannelOptions<TState, TDelta> {
  /**
   * Identifies which channel to open — `deliveryPointId`, `institutionId`,
   * `pickupRequestId`, depending on the consumer. `null` means "do not
   * connect yet" (same convention `deliveryPointId === null` used before this
   * extraction). Changing the value closes the old channel and opens a new
   * one.
   */
  channelKey: string | null;
  /**
   * Builds the full socket URL, including a fresh access token — called
   * again on every connection attempt, never captured once (a reconnection
   * that happens after the REST client renewed the token must use the
   * renewed one).
   */
  getSocketUrl: () => string;
  fetchSnapshot: () => Promise<TState>;
  /** Folds one delta into the current state — the consumer decides whether
   * `TState` is an array or a single object, and whether it sorts internally. */
  mergeDelta: (current: TState, delta: TDelta) => TState;
  parseDelta: (raw: unknown) => TDelta | null;
  /** The consumer's own close-code map (ADR-075 point 1) — this hook does not
   * need to know it. */
  fatalCloseReason: (code: number, reason: string) => string | null;
  /**
   * Renews the access token once, before giving up on a close whose reason is
   * exactly `'UNAUTHENTICATED'` (ADR-091) — never for the channel's other
   * fatal reasons, which stay immediately fatal, not token problems. One
   * attempt per connection cycle, reset on every successful `onopen`, so a
   * token that gets refreshed and is still rejected for some other reason
   * does not loop. A network failure during the attempt is treated as an
   * ordinary transport drop (normal backoff, not fatal); an explicit
   * rejection is the real end of the session, same as today. Omit to keep
   * today's behavior (immediate fatal close) — e.g. an attended screen where
   * a human is already there to sign back in.
   */
  refreshToken?: () => Promise<string>;
}

export interface UseRealtimeChannelValue<TState> {
  status: RealtimeChannelStatus;
  state: TState | null;
  error: ApiError | null;
  connection: RealtimeConnectionState;
  connectionErrorReason: string | null;
  reload: () => void;
}

/**
 * Generic live channel: REST snapshot + WebSocket deltas (ADR-075). The
 * socket opens first and the snapshot is requested from its `onopen`
 * handler — the order is always snapshot-then-deltas even on a
 * reconnection: deltas that arrive while the snapshot is in flight are
 * buffered and folded in on top of it afterwards, instead of being lost to a
 * response that was already stale when it was built (ADR-050 point 6).
 *
 * Everything lives inside one effect keyed on `channelKey`, so switching
 * channels tears the old one down before opening the new one, and React's
 * development double-mount cannot leave a socket behind.
 */
export function useRealtimeChannel<TState, TDelta>(
  options: UseRealtimeChannelOptions<TState, TDelta>,
): UseRealtimeChannelValue<TState> {
  const {
    channelKey,
    getSocketUrl,
    fetchSnapshot,
    mergeDelta,
    parseDelta,
    fatalCloseReason,
    refreshToken,
  } = options;

  const [state, setState] = useState<TState | null>(null);
  const [connection, setConnection] = useState<RealtimeConnectionState>('connecting');
  const [connectionErrorReason, setConnectionErrorReason] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Tagged with the channel it belongs to, so `status` below is derived
  // rather than reset by the effect: switching channels is already 'loading'
  // because the new channel has not loaded yet, not because something told
  // it to be. A reconnection, which reuses the same channel, leaves `state`
  // exactly where it was instead of blanking it back into skeletons.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ key: string; error: ApiError } | null>(null);

  const status: RealtimeChannelStatus =
    channelKey === null
      ? 'loading'
      : failure?.key === channelKey
        ? 'error'
        : loadedKey === channelKey
          ? 'ready'
          : 'loading';

  const error = status === 'error' ? (failure?.error ?? null) : null;

  const reload = useCallback(() => {
    setLoadedKey(null);
    setFailure(null);
    setConnectionErrorReason(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!channelKey) return;

    let cancelled = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    /** Non-null only while a snapshot request is in flight. */
    let buffered: TDelta[] | null = null;
    /**
     * One refresh attempt per connection cycle (ADR-091) — reset to `false` on
     * every successful `onopen`, so a fresh connection that later dies of
     * `UNAUTHENTICATED` again gets its own attempt, but a token that was just
     * refreshed and immediately rejected again does not loop refreshing.
     */
    let refreshAttempted = false;

    function applyLiveDelta(delta: TDelta) {
      if (buffered) {
        buffered.push(delta);
        return;
      }
      setState((current) => (current === null ? current : mergeDelta(current, delta)));
    }

    function loadSnapshot(key: string) {
      buffered = [];
      fetchSnapshot()
        .then((snapshot) => {
          if (cancelled) return;
          const pending = buffered ?? [];
          buffered = null;
          const merged = pending.reduce(mergeDelta, snapshot);
          setState(merged);
          setFailure(null);
          setLoadedKey(key);
        })
        .catch((caught: unknown) => {
          buffered = null;
          if (cancelled) return;
          // Without a snapshot there is nothing to apply deltas to, so the
          // channel comes down with it and `reload()` restarts both.
          setFailure({ key, error: asApiError(caught) });
          setLoadedKey(null);
          setConnection('closed');
          socket?.close();
        });
    }

    function connect(key: string) {
      // El estado se marca de inmediato al arrancar la conexión — es la
      // señal correcta de "iniciando" en el momento en que el efecto
      // arranca (ej. institutionId cambió), no un efecto secundario
      // evitable. Ver ADR-110.
      // eslint-disable-next-line @eslint-react/set-state-in-effect
      setConnection(retries === 0 ? 'connecting' : 'reconnecting');
      // eslint-disable-next-line @eslint-react/set-state-in-effect
      setConnectionErrorReason(null);

      const opened = new WebSocket(getSocketUrl());
      socket = opened;

      opened.onopen = () => {
        if (cancelled) return;
        retries = 0;
        refreshAttempted = false;
        setConnection('live');
        loadSnapshot(key);
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
        const delta = parseDelta(raw);
        // A message that doesn't match the expected shape is discarded,
        // never applied: one malformed publication cannot corrupt the state.
        if (delta) applyLiveDelta(delta);
      };

      opened.onclose = (event: CloseEvent) => {
        if (cancelled) return;
        buffered = null;

        const fatal = fatalCloseReason(event.code, event.reason);
        if (fatal) {
          if (fatal === 'UNAUTHENTICATED' && refreshToken && !refreshAttempted) {
            refreshAttempted = true;
            setConnection('reconnecting');
            refreshToken()
              .then(() => {
                if (cancelled) return;
                // Success: reconnect right away with the renewed token —
                // `getSocketUrl()` re-reads storage, never captures once.
                connect(key);
              })
              .catch((caught: unknown) => {
                if (cancelled) return;
                if (classifyRefreshFailure(caught) === 'network') {
                  // The refresh itself never got a verdict — same as any
                  // other transport drop, not a reason to give up.
                  retryTimer = setTimeout(() => connect(key), reconnectDelayMs(retries));
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

        // A transport drop: the state on screen is frozen until the socket
        // is back, and the reconnection re-reads the snapshot from `onopen`
        // (ADR-050 point 7).
        setConnection('reconnecting');
        retryTimer = setTimeout(() => connect(key), reconnectDelayMs(retries));
        retries += 1;
      };
    }

    connect(channelKey);

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
    // `getSocketUrl`/`fetchSnapshot`/`mergeDelta`/`parseDelta`/`fatalCloseReason`/
    // `refreshToken` are stable by the consumer's own convention (useCallback,
    // or declared outside render) — same assumption the original per-screen
    // effects made before this extraction.
    // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  }, [channelKey, attempt]);

  return { status, state, error, connection, connectionErrorReason, reload };
}
