import { useOutletContext } from 'react-router';
import { Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { adminMetricsErrorMessage } from '../admin/admin-metrics-error-messages';
import type { AdminMetrics, AdminMetricsValue } from '../admin/useAdminMetrics';

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
const DAY_LABEL_FORMAT = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

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

type ChipTone = 'positive' | 'warn' | 'negative';

const CHIP_TONE_STYLE: Record<ChipTone, { color: string; background: string }> = {
  positive: { color: 'var(--status-delivered-fg)', background: 'var(--status-delivered-bg)' },
  warn: { color: 'var(--status-arriving-fg)', background: 'var(--status-arriving-bg)' },
  negative: { color: 'var(--danger)', background: 'var(--danger-bg)' },
};

function KpiTile({
  label,
  value,
  chip,
  hint,
}: {
  label: string;
  value: string;
  chip?: { text: string; tone: ChipTone };
  hint?: string;
}) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-200)' }}>{label}</span>
        <span
          style={{
            fontSize: 'var(--text-display-sm)',
            fontWeight: 800,
            color: 'var(--ink-900)',
            letterSpacing: '-.02em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {chip && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 999,
              width: 'max-content',
              ...CHIP_TONE_STYLE[chip.tone],
            }}
          >
            {chip.text}
          </span>
        )}
        {hint && <span style={{ fontSize: 12, color: 'var(--ink-300)' }}>{hint}</span>}
      </div>
    </Card>
  );
}

function ResumenKpiRow({ metrics }: { metrics: AdminMetrics }) {
  const trend = pickupTrend(
    metrics.pickupRequestsTotal.currentPeriod,
    metrics.pickupRequestsTotal.previousPeriod,
  );
  const pendingInstitutions = metrics.institutionsByStatus.pending;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {/* No monthly-variation chip here, unlike the kit: `institutionsByStatus`
          is a snapshot, not a history — nothing real backs a "▲ N este mes"
          delta (ADR-074 point 2). */}
      <KpiTile
        label="Instituciones activas"
        value={formatNumber(metrics.institutionsByStatus.approved)}
      />
      <KpiTile
        label="Solicitudes pendientes"
        value={formatNumber(pendingInstitutions)}
        chip={pendingInstitutions > 0 ? { text: 'Por validar', tone: 'warn' } : undefined}
        hint={`${formatNumber(metrics.pendingRequests.enrollmentsPending)} asociaciones alumno-institución pendientes`}
      />
      <KpiTile label="Tutores registrados" value={formatNumber(metrics.registeredGuardiansCount)} />
      <KpiTile
        label="Recogidas este periodo"
        value={formatNumber(metrics.pickupRequestsTotal.currentPeriod)}
        chip={
          trend
            ? {
                text: `${trend.positive ? '▲' : '▼'} ${trend.label}`,
                tone: trend.positive ? 'positive' : 'negative',
              }
            : undefined
        }
      />
    </div>
  );
}

function toCalendarDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` parsed as a local calendar date, never through the UTC `Date` constructor. */
function parseCalendarDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * `GET /admin/metrics` only returns days with at least one delivery
 * (specs/api-contracts/admin-metrics.md) — this fills the gaps so the chart
 * always plots 14 consecutive days, zero-height bars included.
 */
function last14DaysSeries(
  deliveriesByDay: readonly { date: string; count: number }[],
): { date: string; count: number }[] {
  const counts = new Map(deliveriesByDay.map((entry) => [entry.date, entry.count]));
  const today = new Date();
  const days: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const date = toCalendarDate(day);
    days.push({ date, count: counts.get(date) ?? 0 });
  }
  return days;
}

function DeliveriesByDayChart({
  deliveriesByDay,
}: {
  deliveriesByDay: readonly { date: string; count: number }[];
}) {
  const days = last14DaysSeries(deliveriesByDay);
  const max = Math.max(...days.map((day) => day.count), 1);
  const lastIndex = days.length - 1;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 188 }}>
        {days.map((day, index) => (
          <span
            key={day.date}
            title={`${DAY_LABEL_FORMAT.format(parseCalendarDate(day.date))} · ${formatNumber(day.count)}`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              height: '100%',
            }}
          >
            <span
              style={{
                width: '100%',
                height: `${Math.round((day.count / max) * 100)}%`,
                background:
                  index === lastIndex ? 'var(--status-arrived)' : 'var(--status-en-route)',
                borderRadius: '6px 6px 0 0',
              }}
            />
          </span>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
          fontSize: 12,
          color: 'var(--ink-100)',
          fontWeight: 500,
        }}
      >
        <span>{DAY_LABEL_FORMAT.format(parseCalendarDate(days[0].date))}</span>
        <span>
          {DAY_LABEL_FORMAT.format(parseCalendarDate(days[Math.floor(lastIndex / 2)].date))}
        </span>
        <span>Hoy</span>
      </div>
    </div>
  );
}

function InstitutionsByStatusPanel({ metrics }: { metrics: AdminMetrics }) {
  const rows = [
    {
      label: 'Activas',
      count: metrics.institutionsByStatus.approved,
      color: 'var(--status-delivered)',
    },
    {
      label: 'Pendientes',
      count: metrics.institutionsByStatus.pending,
      color: 'var(--status-arriving)',
    },
    {
      label: 'Suspendidas',
      count: metrics.institutionsByStatus.suspended,
      color: 'var(--accent-slate)',
    },
  ];

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <h2 style={SECTION_TITLE_STYLE}>Instituciones por estado</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rows.map((row) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background: row.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, fontSize: 14, color: 'var(--ink-600)', fontWeight: 500 }}>
                {row.label}
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink-900)' }}>
                {formatNumber(row.count)}
              </span>
            </div>
          ))}
        </div>
        <div style={{ height: 1, background: 'var(--border-hairline)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-200)', fontWeight: 600 }}>
            Tiempo medio de recogida
          </span>
          <span
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--status-arrived)',
              letterSpacing: '-.02em',
            }}
          >
            {formatAverageDuration(metrics.averagePickupDurationSeconds)}
          </span>
        </div>
      </div>
    </Card>
  );
}

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

function TopInstitutionsPanel({ metrics }: { metrics: AdminMetrics }) {
  const max = Math.max(
    ...metrics.topInstitutionsByUsage.map((item) => item.pickupRequestsCount),
    1,
  );

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={SECTION_TITLE_STYLE}>Top instituciones por uso</h2>
          <span style={{ fontSize: 13, color: 'var(--ink-200)', fontWeight: 600 }}>
            Recogidas este periodo
          </span>
        </div>
        {metrics.topInstitutionsByUsage.length === 0 ? (
          <EmptyState
            icon={EMPTY_TOP_ICON}
            title="Todavía no hay recogidas"
            description="En cuanto se registren recogidas, las instituciones con más actividad aparecerán aquí."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {metrics.topInstitutionsByUsage.map((item, index) => (
              <div
                key={item.institutionId}
                style={{ display: 'flex', alignItems: 'center', gap: 14 }}
              >
                <span
                  style={{
                    width: 22,
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--ink-100)',
                    flexShrink: 0,
                  }}
                >
                  #{index + 1}
                </span>
                <span
                  style={{
                    width: 230,
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--ink-900)',
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.name}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 9,
                    background: 'var(--surface-muted)',
                    borderRadius: 5,
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${Math.round((item.pickupRequestsCount / max) * 100)}%`,
                      background: 'var(--brand)',
                      borderRadius: 5,
                    }}
                  />
                </span>
                <span
                  style={{
                    width: 64,
                    textAlign: 'right',
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--ink-700)',
                    fontVariantNumeric: 'tabular-nums',
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
  );
}

function MetricsSections({ metrics }: { metrics: AdminMetrics }) {
  return (
    <>
      <ResumenKpiRow metrics={metrics} />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div
              style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
            >
              <h2 style={SECTION_TITLE_STYLE}>Recogidas por día</h2>
              <span style={{ fontSize: 13, color: 'var(--ink-200)', fontWeight: 600 }}>
                Últimos 14 días
              </span>
            </div>
            <DeliveriesByDayChart deliveriesByDay={metrics.deliveriesByDay} />
          </div>
        </Card>

        <InstitutionsByStatusPanel metrics={metrics} />
      </div>

      <TopInstitutionsPanel metrics={metrics} />
    </>
  );
}

export function GlobalMetrics() {
  const { status, metrics, error, reload } = useOutletContext<AdminMetricsValue>();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          Resumen
        </h1>
        <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
          Vista de solo lectura del estado de la plataforma completa.
        </span>
      </div>

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
  );
}
