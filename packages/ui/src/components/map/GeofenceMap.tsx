import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent, Marker } from 'mapbox-gl';
import { circleBounds, circlePolygon, distanceInMeters, toRadiusValue } from './circle-geometry';
import type { LatLng } from './circle-geometry';

export type { LatLng } from './circle-geometry';

export interface GeofenceMapProps {
  /**
   * Mapbox public access token. Comes from the app's environment
   * (`VITE_MAPBOX_TOKEN`), never from this package — see ADR-048 point 3. When
   * it is missing the component says so instead of rendering a blank map.
   */
  accessToken: string | undefined;
  center: LatLng;
  /** Arrival ring, `institutions.geofence_radius_meters` (ADR-013). */
  geofenceRadiusMeters: number;
  /** "Ya voy" activation ring, `institutions.activation_radius_meters` (ADR-013). */
  activationRadiusMeters: number;
  onCenterChange?: (next: LatLng) => void;
  onGeofenceRadiusChange?: (meters: number) => void;
  onActivationRadiusChange?: (meters: number) => void;
  /** Read-only: both rings and the pin render, nothing can be dragged. */
  disabled?: boolean;
  /**
   * Independent of `disabled`: controls only whether the two rings can be
   * dragged, without affecting the pin — two drag mechanisms already
   * separated in the implementation (`marker.draggable` vs. the listeners on
   * the `*_HANDLE_LAYER` layers). Defaults to `disabled`, so no existing
   * consumer that doesn't pass it changes behaviour.
   */
  radiiDisabled?: boolean;
  height?: number;
  geofenceLabel?: string;
  activationLabel?: string;
}

const GEOFENCE_SOURCE = 'geofence-radius';
const ACTIVATION_SOURCE = 'activation-radius';
const GEOFENCE_HANDLE_LAYER = `${GEOFENCE_SOURCE}-handle`;
const ACTIVATION_HANDLE_LAYER = `${ACTIVATION_SOURCE}-handle`;

const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';

/**
 * The two rings never share a colour, a line style or an opacity: hue alone is
 * not enough to tell them apart when one sits inside the other.
 */
const GEOFENCE_TOKEN = '--accent-blue';
const ACTIVATION_TOKEN = '--accent-violet';

/** Fallbacks mirror `packages/ui/src/tokens/colors.css`. */
const GEOFENCE_COLOR_FALLBACK = '#2f6bff';
const ACTIVATION_COLOR_FALLBACK = '#7c3aed';
const BRAND_COLOR_FALLBACK = '#fb6a45';

/** Breathing room around the activation ring when the map first opens. */
const INITIAL_BOUNDS_SLACK = 1.4;

/**
 * Mapbox paint properties take literal colours, not `var(--token)`, so the
 * token is read once from the document instead of being duplicated as a hex
 * literal in two places.
 */
function tokenColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function setCircleData(map: MapboxMap, sourceId: string, center: LatLng, radiusMeters: number) {
  const source = map.getSource<GeoJSONSource>(sourceId);
  source?.setData(circlePolygon(center, radiusMeters));
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

function LegendEntry({ color, dashed, label }: { color: string; dashed: boolean; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span
        style={{
          width: 18,
          height: 0,
          borderTop: `3px ${dashed ? 'dashed' : 'solid'} ${color}`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-600)' }}>{label}</span>
    </span>
  );
}

/**
 * Interactive map to place an institution and size its two radii (ADR-048).
 *
 * Thin wrapper over mapbox-gl, no `react-map-gl`: the map instance lives in a
 * ref and React only feeds it props. The component is controlled — it never
 * holds the centre or the radii, it reports changes and re-renders from what
 * comes back, so the form above stays the single source of truth.
 *
 * The two rings are wired to one source, one layer and one callback each. No
 * path writes both: they are independent fields and must not collapse into one
 * (ADR-013, feature 008).
 */
export function GeofenceMap({
  accessToken,
  center,
  geofenceRadiusMeters,
  activationRadiusMeters,
  onCenterChange,
  onGeofenceRadiusChange,
  onActivationRadiusChange,
  disabled = false,
  radiiDisabled = disabled,
  height = 380,
  geofenceLabel = 'Radio de arribo',
  activationLabel = 'Radio de activación',
}: GeofenceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const draggingRef = useRef<'geofence' | 'activation' | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Read by the map's own event listeners, which are registered once and must
  // not close over a stale render. Refreshed after every commit — map events
  // only ever fire after one.
  const propsRef = useRef({
    center,
    disabled,
    radiiDisabled,
    onCenterChange,
    onGeofenceRadiusChange,
    onActivationRadiusChange,
  });
  useEffect(() => {
    propsRef.current = {
      center,
      disabled,
      radiiDisabled,
      onCenterChange,
      onGeofenceRadiusChange,
      onActivationRadiusChange,
    };
  });

  // Only the initial camera; afterwards the map is the user's to pan and zoom.
  const initialCenterRef = useRef(center);
  const initialActivationRadiusRef = useRef(activationRadiusMeters);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !accessToken) return;

    const geofenceColor = tokenColor(GEOFENCE_TOKEN, GEOFENCE_COLOR_FALLBACK);
    const activationColor = tokenColor(ACTIVATION_TOKEN, ACTIVATION_COLOR_FALLBACK);
    const initialCenter = initialCenterRef.current;

    const map = new mapboxgl.Map({
      accessToken,
      container,
      style: MAP_STYLE,
      center: [initialCenter.lng, initialCenter.lat],
      // Opens framing the whole activation ring — the larger of the two.
      bounds: circleBounds(
        initialCenter,
        Math.max(initialActivationRadiusRef.current, 100) * INITIAL_BOUNDS_SLACK,
      ),
      fitBoundsOptions: { padding: 32 },
      attributionControl: true,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    const marker = new mapboxgl.Marker({
      color: tokenColor('--brand', BRAND_COLOR_FALLBACK),
      draggable: !propsRef.current.disabled,
    })
      .setLngLat([initialCenter.lng, initialCenter.lat])
      .addTo(map);
    markerRef.current = marker;

    marker.on('drag', () => {
      const { lat, lng } = marker.getLngLat();
      propsRef.current.onCenterChange?.({ lat, lng });
    });

    // An invalid or domain-restricted token fails here, not at construction.
    map.on('error', () => setFailed(true));

    map.on('load', () => {
      for (const [sourceId, radius] of [
        [ACTIVATION_SOURCE, initialActivationRadiusRef.current],
        [GEOFENCE_SOURCE, geofenceRadiusMeters],
      ] as const) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: circlePolygon(initialCenter, radius),
        });
      }

      // Activation first: it is the larger ring, so it sits underneath.
      map.addLayer({
        id: `${ACTIVATION_SOURCE}-fill`,
        type: 'fill',
        source: ACTIVATION_SOURCE,
        paint: { 'fill-color': activationColor, 'fill-opacity': 0.07 },
      });
      map.addLayer({
        id: `${ACTIVATION_SOURCE}-line`,
        type: 'line',
        source: ACTIVATION_SOURCE,
        paint: { 'line-color': activationColor, 'line-width': 2, 'line-dasharray': [3, 2] },
      });
      map.addLayer({
        id: `${GEOFENCE_SOURCE}-fill`,
        type: 'fill',
        source: GEOFENCE_SOURCE,
        paint: { 'fill-color': geofenceColor, 'fill-opacity': 0.18 },
      });
      map.addLayer({
        id: `${GEOFENCE_SOURCE}-line`,
        type: 'line',
        source: GEOFENCE_SOURCE,
        paint: { 'line-color': geofenceColor, 'line-width': 2.5 },
      });

      // Invisible fat lines on top of each ring: a 2px stroke is far too thin
      // to grab with a mouse. They still answer hit-testing.
      for (const [layerId, sourceId] of [
        [ACTIVATION_HANDLE_LAYER, ACTIVATION_SOURCE],
        [GEOFENCE_HANDLE_LAYER, GEOFENCE_SOURCE],
      ] as const) {
        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          paint: { 'line-color': '#000000', 'line-width': 18, 'line-opacity': 0.001 },
        });
      }

      setReady(true);
    });

    const canvas = () => map.getCanvas();

    function beginDrag(target: 'geofence' | 'activation') {
      return (event: MapMouseEvent) => {
        if (propsRef.current.radiiDisabled) return;
        // Keeps the gesture from panning the map underneath the ring.
        event.preventDefault();
        draggingRef.current = target;
        map.dragPan.disable();
        canvas().style.cursor = 'grabbing';
      };
    }

    function endDrag() {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      map.dragPan.enable();
      canvas().style.cursor = '';
    }

    function onMove(event: MapMouseEvent) {
      const target = draggingRef.current;
      if (!target) return;
      const props = propsRef.current;
      const meters = toRadiusValue(
        distanceInMeters(props.center, { lat: event.lngLat.lat, lng: event.lngLat.lng }),
      );
      // One ring per gesture: resizing the arrival radius never touches the
      // activation radius, nor the other way round (ADR-013).
      if (target === 'geofence') props.onGeofenceRadiusChange?.(meters);
      else props.onActivationRadiusChange?.(meters);
    }

    function hoverIn() {
      if (propsRef.current.radiiDisabled || draggingRef.current) return;
      canvas().style.cursor = 'ew-resize';
    }

    function hoverOut() {
      if (draggingRef.current) return;
      canvas().style.cursor = '';
    }

    map.on('mousedown', GEOFENCE_HANDLE_LAYER, beginDrag('geofence'));
    map.on('mousedown', ACTIVATION_HANDLE_LAYER, beginDrag('activation'));
    map.on('mouseenter', GEOFENCE_HANDLE_LAYER, hoverIn);
    map.on('mouseenter', ACTIVATION_HANDLE_LAYER, hoverIn);
    map.on('mouseleave', GEOFENCE_HANDLE_LAYER, hoverOut);
    map.on('mouseleave', ACTIVATION_HANDLE_LAYER, hoverOut);
    map.on('mousemove', onMove);
    map.on('mouseup', endDrag);
    // The pointer regularly leaves the canvas mid-drag; without this the map
    // would stay stuck in resize mode.
    window.addEventListener('mouseup', endDrag);

    return () => {
      window.removeEventListener('mouseup', endDrag);
      marker.remove();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      draggingRef.current = null;
      setReady(false);
    };
    // `geofenceRadiusMeters` is read once for the initial ring; later values
    // arrive through the sync effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markerRef.current?.setLngLat([center.lng, center.lat]);
    setCircleData(map, GEOFENCE_SOURCE, center, geofenceRadiusMeters);
    setCircleData(map, ACTIVATION_SOURCE, center, activationRadiusMeters);
  }, [ready, center, geofenceRadiusMeters, activationRadiusMeters]);

  useEffect(() => {
    markerRef.current?.setDraggable(!disabled);
  }, [disabled, ready]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <LegendEntry
          color={`var(${GEOFENCE_TOKEN})`}
          dashed={false}
          label={`${geofenceLabel} · ${geofenceRadiusMeters} m`}
        />
        <LegendEntry
          color={`var(${ACTIVATION_TOKEN})`}
          dashed
          label={`${activationLabel} · ${activationRadiusMeters} m`}
        />
        {!disabled && (
          <span style={{ fontSize: 12, color: 'var(--ink-200)' }}>
            Arrastra el pin para mover la institución.
          </span>
        )}
        {!radiiDisabled && (
          <span style={{ fontSize: 12, color: 'var(--ink-200)' }}>
            Arrastra el borde de un círculo para cambiar su radio.
          </span>
        )}
      </div>
    </div>
  );
}
