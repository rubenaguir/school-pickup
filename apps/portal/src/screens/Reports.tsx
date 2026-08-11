import { useNavigate } from 'react-router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SegmentedTabs,
  SkeletonRow,
} from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { useInstitution } from '../institution/InstitutionContext';
import { institutionStatusLabel, roleLabel } from '../institution/institution-labels';
import { institutionReportsErrorMessage } from '../reports/report-error-messages';
import { reportPeriodLabel } from '../reports/report-labels';
import {
  REPORT_PERIODS,
  useInstitutionReports,
  type DeliveriesByDayEntry,
  type InstitutionReport,
} from '../reports/useInstitutionReports';
import {
  DELIVERY_POINTS_PATH,
  DISMISSAL_SCHEDULE_PATH,
  GATE_CONSOLE_PATH,
  INSTITUTION_PROFILE_PATH,
  PENDING_ENROLLMENTS_PATH,
  PERSONNEL_PATH,
} from '../routes/paths';

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

const NOT_ADMIN_REASON = 'Solo un administrador puede ver los reportes de esta institución.';

const LOCKED_ICON = (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const NUMBER_FORMAT = new Intl.NumberFormat('es-MX');
const DATE_FORMAT = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });

function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/** `YYYY-MM-DD` parsed as a local calendar date, never through the UTC `Date` constructor. */
function formatDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return DATE_FORMAT.format(new Date(year, month - 1, day));
}

function formatAverageDuration(seconds: number | null): string {
  if (seconds === null) return 'Sin datos suficientes';
  const minutes = seconds / 60;
  if (minutes < 1) return '< 1 min';
  return `${formatNumber(Math.round(minutes))} min`;
}

/** Same "sin datos suficientes" criterion as GlobalMetrics' average duration tile. */
function formatPunctuality(rate: number | null): string {
  return rate === null ? 'Sin datos suficientes' : `${formatNumber(rate)}%`;
}

function StatTile({ label, value }: { label: string; value: string }) {
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
    </div>
  );
}

const STAT_GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 24,
} as const;

const EMPTY_DELIVERIES_ICON = (
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

/** Simple CSS bars — feature 027 explicitly does not need a charting library for this. */
function DeliveriesByDayChart({ entries }: { entries: DeliveriesByDayEntry[] }) {
  const max = Math.max(...entries.map((entry) => entry.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.map((entry) => (
        <div key={entry.date} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--ink-400)', width: 56, flexShrink: 0 }}>
            {formatDay(entry.date)}
          </span>
          <div
            style={{
              flex: 1,
              background: 'var(--surface-muted)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              height: 18,
            }}
          >
            <div
              style={{
                width: `${max === 0 ? 0 : Math.round((entry.count / max) * 100)}%`,
                minWidth: entry.count > 0 ? 6 : 0,
                height: '100%',
                background: 'var(--brand)',
                borderRadius: 'var(--radius-sm)',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--ink-600)',
              width: 28,
              textAlign: 'right',
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatNumber(entry.count)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReportSections({ report }: { report: InstitutionReport }) {
  return (
    <>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={SECTION_TITLE_STYLE}>Resumen del periodo</h2>
          <div style={STAT_GRID_STYLE}>
            <StatTile
              label="Tiempo promedio de recogida"
              value={formatAverageDuration(report.averagePickupDurationSeconds)}
            />
            <StatTile label="Alumnos activos" value={formatNumber(report.activeStudentsCount)} />
            <StatTile label="Puntualidad" value={formatPunctuality(report.punctualityRate)} />
          </div>
          {/* ADR-060 point 3: se dice explícito para que no se lea como
              inconsistencia frente a las otras tres tarjetas. */}
          <span style={{ fontSize: 12, color: 'var(--ink-300)' }}>
            Alumnos activos es el padrón de hoy — no cambia con el periodo seleccionado.
          </span>
        </div>
      </Card>

      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 style={SECTION_TITLE_STYLE}>Entregas por día</h2>
          {report.deliveriesByDay.length === 0 ? (
            <EmptyState
              icon={EMPTY_DELIVERIES_ICON}
              title="Sin recogidas en este periodo"
              description="En cuanto se completen recogidas dentro del rango elegido, aparecerán aquí agrupadas por día."
            />
          ) : (
            <DeliveriesByDayChart entries={report.deliveriesByDay} />
          )}
        </div>
      </Card>
    </>
  );
}

export function Reports() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const { current } = useInstitution();
  const institutionId = current?.institutionId ?? null;

  // Feature 027, precondición: a diferencia de las otras pantallas de
  // configuración, aquí la LECTURA misma es admin-only (ADR-060 punto 6), no
  // solo la escritura — así que el fetch ni se dispara para alguien sin ese rol.
  const canView = current?.role === 'admin';

  const { status, report, error, period, setPeriod, reload } = useInstitutionReports(
    canView ? institutionId : null,
  );

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
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220, flex: 1 }}
            >
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
                Reportes
              </h1>
              <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
                {current?.institutionName ?? 'Institución'} · sesión de {session?.email}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(DELIVERY_POINTS_PATH)}
              >
                Puntos de entrega
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(DISMISSAL_SCHEDULE_PATH)}
              >
                Horarios de salida
              </Button>
              <Button variant="outline" size="sm" onClick={() => void navigate(GATE_CONSOLE_PATH)}>
                Consola de puerta
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(INSTITUTION_PROFILE_PATH)}
              >
                Perfil de la institución
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(PENDING_ENROLLMENTS_PATH)}
              >
                Aprobaciones
              </Button>
              <Button variant="outline" size="sm" onClick={() => void navigate(PERSONNEL_PATH)}>
                Personal
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                Cerrar sesión
              </Button>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
              marginTop: 16,
            }}
          >
            {current && <Badge tone="brand">{roleLabel(current.role)}</Badge>}
            {current && (
              <Badge tone="neutral">{institutionStatusLabel(current.institutionStatus)}</Badge>
            )}
          </div>
        </Card>

        {!canView && (
          <Card>
            <EmptyState
              icon={LOCKED_ICON}
              title="Solo para administradores"
              description={NOT_ADMIN_REASON}
            />
          </Card>
        )}

        {canView && (
          <Card>
            <SegmentedTabs
              options={REPORT_PERIODS.map(reportPeriodLabel)}
              value={reportPeriodLabel(period)}
              onChange={(label) => {
                const next = REPORT_PERIODS.find(
                  (candidate) => reportPeriodLabel(candidate) === label,
                );
                if (next) setPeriod(next);
              }}
            />
          </Card>
        )}

        {canView && status === 'loading' && (
          <Card padding={0}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        )}

        {canView && status === 'error' && (
          <Card>
            <ErrorState
              title="No pudimos cargar el reporte"
              message={error ? institutionReportsErrorMessage(error.code) : undefined}
              code={error?.code}
              onRetry={reload}
            />
          </Card>
        )}

        {canView && status === 'ready' && report && <ReportSections report={report} />}
      </div>
    </main>
  );
}
