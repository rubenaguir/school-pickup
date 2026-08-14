import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';

/**
 * One row of GET /institutions/:id/delivery-points, trimmed to what the
 * filter pastillas need. Same projection criterion as `DeliveryPoint` in
 * `apps/portal/src/delivery-points/useDeliveryPoints.ts` — declared locally
 * rather than reusing an entity type.
 */
export interface DeliveryPointResponse {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export type DeliveryPointsStatus = 'loading' | 'ready' | 'error';

export interface DeliveryPointsValue {
  status: DeliveryPointsStatus;
  deliveryPoints: DeliveryPointResponse[];
}

interface ListDeliveryPointsResponse {
  deliveryPoints: DeliveryPointResponse[];
}

/**
 * Catalog of the institution's delivery points, loaded once at mount
 * (ADR-069 point 8) — doors don't change mid dismissal-window, so this has
 * no realtime channel of its own. Filtered to `active` on the client, same
 * criterion as the gate console's door selector
 * (`apps/portal/src/screens/GateConsole.tsx`): only an active point still
 * receives new pickups, so only an active point is worth a filter pastilla.
 *
 * No `reload`/error surface beyond `status === 'error'`: a failure here must
 * not take down the board's hero listing (ADR-069 point 8) — the screen
 * just renders without the filter row and moves on.
 */
export function useDeliveryPoints(institutionId: string | null): DeliveryPointsValue {
  const [status, setStatus] = useState<DeliveryPointsStatus>('loading');
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPointResponse[]>([]);

  useEffect(() => {
    if (!institutionId) return;
    let cancelled = false;

    apiClient
      .get<ListDeliveryPointsResponse>(
        `/institutions/${encodeURIComponent(institutionId)}/delivery-points`,
      )
      .then((response) => {
        if (cancelled) return;
        setDeliveryPoints(response.deliveryPoints.filter((point) => point.status === 'active'));
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [institutionId]);

  return { status, deliveryPoints };
}
