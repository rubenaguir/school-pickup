import { Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { AdminNav } from '../admin/AdminNav';
import { adminMetricsErrorMessage } from '../admin/admin-metrics-error-messages';
import { useAdminMetrics, type AdminMetrics } from '../admin/useAdminMetrics';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const SECTION_TITLE_STYLE = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: 'var(--ink-900)',
} as const;

const NUMBER_FORMAT = new Intl.NumberFormat('es-MX');

function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

function formatAverageDuration(seconds: number | null): string {
  if (seconds === null) return 'Sin datos suficientes';
  const minutes = seconds / 60;
  if (minutes < 1) return '< 1 min';
  return `${formatNumber(Math.round(minutes))} min`;
}

/**
 * Comparativo simple sin gráfico (feature 024 punto 4): triángulo + variación
 * porcentual. `previousPeriod === 0` no tiene porcentaje bien definido, así
 * que se muestra el delta absoluto en vez de dividir entre cero.
 */
function pickupTrend(
  currentPeriod: number,
  previousPeriod: number,
): { label: string; positive: boolean } | null {
  if (previousPeriod === 0) {
    if (currentPeriod === 0) return null;
    return { label: `+${formatNumber(currentPeriod)} vs. periodo anterior`, positive: true };
  }
  const diff = currentPeriod - previousPeriod;
  const pct = Math.round((diff / previousPeriod) * 100);
  return {
    label: `${diff >= 0 ? '+' : ''}${pct}% vs. periodo anterior`,
    positive: diff >= 0,
  };
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 150 }}>
      <span style={{ fontSize: 13, color: 'var(--ink-400)', fontWeight: 600 }}>{label}</span>
      <span
        style={{
          fontSize: 'var(--text-display-sm)',
          fontWeight: 800,
          color: 'var(--ink-900)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-.02em',
        }}
      >
        {value}
      </span>
      {hint && <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>{hint}</span>}
    </div>
  );
}

const STAT_GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 24,
} as const;

const EMPTY_TOP_ICON = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M4 20V10M11 20V4M18 20v-7" />
  </svg>
);

function MetricsSections({ metrics }: { metrics: AdminMetrics }) {
  const trend = pickupTrend(
    metrics.pickupRequestsTotal.currentPeriod,
    metrics.pickupRequestsTotal.previousPeriod,
  );

  return (
    <>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={SECTION_TITLE_STYLE}>Instituciones</h2>
          <div style={STAT_GRID_STYLE}>
            <StatTile
              label="Pendientes"
              value={formatNumber(metrics.institutionsByStatus.pending)}
            />
            <StatTile
              label="Aprobadas"
              value={formatNumber(metrics.institutionsByStatus.approved)}
            />
            <StatTile
              label="Suspendidas"
              value={formatNumber(metrics.institutionsByStatus.suspended)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={SECTION_TITLE_STYLE}>Solicitudes pendientes</h2>
          <div style={STAT_GRID_STYLE}>
            <StatTile
              label="Instituciones por aprobar"
              value={formatNumber(metrics.pendingRequests.institutionsPendingApproval)}
            />
            <StatTile
              label="Asociaciones alumno-institución"
              value={formatNumber(metrics.pendingRequests.enrollmentsPending)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={SECTION_TITLE_STYLE}>Uso de la plataforma</h2>
          <div style={STAT_GRID_STYLE}>
            <StatTile
              label="Tutores registrados"
              value={formatNumber(metrics.registeredGuardiansCount)}
            />
            <StatTile
              label="Recogidas este periodo"
              value={formatNumber(metrics.pickupRequestsTotal.currentPeriod)}
              hint={trend?.label}
            />
            <StatTile
              label="Tiempo medio de recogida"
              value={formatAverageDuration(metrics.averagePickupDurationSeconds)}
            />
          </div>
          {trend && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: trend.positive ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {trend.positive ? '▲' : '▼'} {trend.label}
            </span>
          )}
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={SECTION_TITLE_STYLE}>Top 5 instituciones por uso</h2>
          {metrics.topInstitutionsByUsage.length === 0 ? (
            <EmptyState
              icon={EMPTY_TOP_ICON}
              title="Todavía no hay recogidas"
              description="En cuanto se registren recogidas, las instituciones con más actividad aparecerán aquí."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {metrics.topInstitutionsByUsage.map((item, index) => (
                <div
                  key={item.institutionId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 0',
                    borderTop: index === 0 ? undefined : '1px solid var(--border-hairline)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--ink-300)',
                        width: 20,
                        flexShrink: 0,
                      }}
                    >
                      {index + 1}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-900)' }}>
                      {item.name}
                    </span>
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--ink-600)',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}
                  >
                    {formatNumber(item.pickupRequestsCount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

export function GlobalMetrics() {
  const { status, metrics, error, reload } = useAdminMetrics();

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        padding: 'var(--space-10)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          maxWidth: 820,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <AdminNav active="metrics" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={EYEBROW_STYLE}>Operación</span>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'var(--text-display-sm)',
                  fontWeight: 800,
                  color: 'var(--ink-900)',
                  letterSpacing: '-.02em',
                }}
              >
                Métricas globales
              </h1>
              <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
                Vista de solo lectura del estado de la plataforma completa.
              </span>
            </div>
          </div>
        </Card>

        {status === 'loading' && (
          <Card padding={0}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        )}

        {status === 'error' && (
          <Card>
            <ErrorState
              title="No pudimos cargar las métricas"
              message={error ? adminMetricsErrorMessage(error.code) : undefined}
              code={error?.code}
              onRetry={reload}
            />
          </Card>
        )}

        {status === 'ready' && metrics && <MetricsSections metrics={metrics} />}
      </div>
    </main>
  );
}
