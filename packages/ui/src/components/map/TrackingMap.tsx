import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { GeoJSONSource, Map as MapboxMap, Marker } from 'mapbox-gl';
import type { LatLng } from './circle-geometry';

export type { LatLng } from './circle-geometry';

export interface TrackingMapProps {
  /**
   * Mapbox public access token. Comes from the app's environment
   * (`VITE_MAPBOX_TOKEN`), never from this package — same rule as
   * `GeofenceMap` (ADR-048 point 3). When it is missing the component says
   * so instead of rendering a blank map.
   */
  accessToken: string | undefined;
  /** Fixed for the life of the pickup_request — never re-centers the camera on its own. */
  institutionPosition: LatLng;
  /** `null` until the tutor's device has produced a first reading. */
  tutorPosition: LatLng | null;
  height?: number;
}

const ROUTE_SOURCE = 'tracking-route';
const ROUTE_LAYER = 'tracking-route-line';

const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';

/**
 * The tutor's marker reuses the shared 5-state palette (`en_route`, blue) —
 * this screen only ever shows this map while the trip is active — instead of
 * introducing a new colour. The institution is a fixed destination, not a
 * pickup state, so it gets a neutral ink tone rather than competing with it
 * or with `--brand` (reserved to one dominant element per screen,
 * `.claude/rules/design-system.md`).
 */
const TUTOR_TOKEN = '--status-en-route';
const INSTITUTION_TOKEN = '--ink-700';
const ROUTE_TOKEN = '--ink-200';

const TUTOR_COLOR_FALLBACK = '#3b82f6';
const INSTITUTION_COLOR_FALLBACK = '#243b52';
const ROUTE_COLOR_FALLBACK = '#8195a6';

/** Breathing room around the two markers when the camera (re)frames them. */
const BOUNDS_PADDING_PX = 56;

function tokenColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function combinedBounds(a: LatLng, b: LatLng): [[number, number], [number, number]] {
  const west = Math.min(a.lng, b.lng);
  const east = Math.max(a.lng, b.lng);
  const south = Math.min(a.lat, b.lat);
  const north = Math.max(a.lat, b.lat);
  return [
    [west, south],
    [east, north],
  ];
}

const PANEL_STYLE = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  textAlign: 'center',
  padding: '24px',
  background: 'var(--surface-sunken)',
  fontFamily: 'var(--font-sans)',
} as const;

function Panel({ title, description, code }: { title: string; description: string; code: string }) {
  return (
    <div style={PANEL_STYLE} role="status">
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>{title}</span>
      <span style={{ fontSize: 13, color: 'var(--ink-400)', maxWidth: 380, lineHeight: 1.5 }}>
        {description}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-2xs)',
          color: 'var(--ink-200)',
        }}
      >
        {code}
      </span>
    </div>
  );
}

/**
 * Read-only map for the tutor's tracking screen (ADR-064): the tutor's live
 * position, the institution's fixed position, and a straight line between
 * them. Deliberately not `GeofenceMap` (which drags a pin and resizes two
 * radii) — nothing here is editable, and the two components would gain
 * nothing by sharing a body beyond the map lifecycle boilerplate they
 * already duplicate from each other.
 *
 * The line is the great-circle distance, not a driving route: no endpoint in
 * this project ever returns route geometry to a browser (`MapsProvider`,
 * ADR-061, is a backend-only port consumed by the `worker` for ETA math) —
 * it exists to orient the tutor, not to turn-by-turn navigate.
 */
export function TrackingMap({
  accessToken,
  institutionPosition,
  tutorPosition,
  height = 320,
}: TrackingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const institutionMarkerRef = useRef<Marker | null>(null);
  const tutorMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const initialInstitutionRef = useRef(institutionPosition);
  const initialTutorRef = useRef(tutorPosition);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !accessToken) return;

    const institutionColor = tokenColor(INSTITUTION_TOKEN, INSTITUTION_COLOR_FALLBACK);
    const tutorColor = tokenColor(TUTOR_TOKEN, TUTOR_COLOR_FALLBACK);
    const routeColor = tokenColor(ROUTE_TOKEN, ROUTE_COLOR_FALLBACK);
    const institutionStart = initialInstitutionRef.current;
    const tutorStart = initialTutorRef.current;

    const map = new mapboxgl.Map({
      accessToken,
      container,
      style: MAP_STYLE,
      center: [institutionStart.lng, institutionStart.lat],
      bounds: tutorStart ? combinedBounds(institutionStart, tutorStart) : undefined,
      ...(tutorStart ? { fitBoundsOptions: { padding: BOUNDS_PADDING_PX } } : {}),
      zoom: tutorStart ? undefined : 14,
      attributionControl: true,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    institutionMarkerRef.current = new mapboxgl.Marker({ color: institutionColor })
      .setLngLat([institutionStart.lng, institutionStart.lat])
      .addTo(map);

    if (tutorStart) {
      tutorMarkerRef.current = new mapboxgl.Marker({ color: tutorColor })
        .setLngLat([tutorStart.lng, tutorStart.lat])
        .addTo(map);
    }

    map.on('error', () => setFailed(true));

    map.on('load', () => {
      map.addSource(ROUTE_SOURCE, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: tutorStart
              ? [
                  [tutorStart.lng, tutorStart.lat],
                  [institutionStart.lng, institutionStart.lat],
                ]
              : [],
          },
        },
      });
      map.addLayer({
        id: ROUTE_LAYER,
        type: 'line',
        source: ROUTE_SOURCE,
        paint: { 'line-color': routeColor, 'line-width': 2.5, 'line-dasharray': [2, 2] },
      });
      setReady(true);
    });

    return () => {
      institutionMarkerRef.current?.remove();
      tutorMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      institutionMarkerRef.current = null;
      tutorMarkerRef.current = null;
      setReady(false);
    };
    // Institution never moves; tutor updates are applied by the sync effect
    // below, same split as `GeofenceMap` between mount-time setup and props sync.
  }, [accessToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !tutorPosition) return;

    if (!tutorMarkerRef.current) {
      const tutorColor = tokenColor(TUTOR_TOKEN, TUTOR_COLOR_FALLBACK);
      tutorMarkerRef.current = new mapboxgl.Marker({ color: tutorColor })
        .setLngLat([tutorPosition.lng, tutorPosition.lat])
        .addTo(map);
    } else {
      tutorMarkerRef.current.setLngLat([tutorPosition.lng, tutorPosition.lat]);
    }

    const source = map.getSource<GeoJSONSource>(ROUTE_SOURCE);
    source?.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: [
          [tutorPosition.lng, tutorPosition.lat],
          [institutionPosition.lng, institutionPosition.lat],
        ],
      },
    });

    map.fitBounds(combinedBounds(institutionPosition, tutorPosition), {
      padding: BOUNDS_PADDING_PX,
      maxZoom: 16,
      animate: true,
      duration: 600,
    });
  }, [ready, tutorPosition, institutionPosition]);

  return (
    <div
      style={{
        position: 'relative',
        height,
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--surface-sunken)',
      }}
    >
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {!accessToken && (
        <Panel
          title="Mapa no disponible"
          description="Falta el token de acceso de Mapbox. Defínelo en la variable de entorno VITE_MAPBOX_TOKEN de esta app y recarga."
          code="MAPBOX_TOKEN_MISSING"
        />
      )}

      {accessToken && failed && (
        <Panel
          title="No pudimos cargar el mapa"
          description="Mapbox rechazó la petición. Revisa que el token sea válido y que este dominio esté permitido en el panel de Mapbox."
          code="MAPBOX_LOAD_FAILED"
        />
      )}
    </div>
  );
}
