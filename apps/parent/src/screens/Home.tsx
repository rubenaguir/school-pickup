import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { useMyStudents, type MyStudent } from '../students/useMyStudents';
import { StudentPhoto } from '../students/StudentPhoto';
import { resolveInitialSurface, setSurface } from '../surface/surface';
import { selectInstitutionPath, trackingPath, TUTOR_PORTAL_STUDENTS_PATH } from '../routes/paths';
import { PushSubscriptionPrompt } from '../push/PushSubscriptionPrompt';
import { useActivePickupRequest } from '../pickup-requests/useActivePickupRequest';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const EMPTY_ICON = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <path d="M9 21V9a3 3 0 0 1 3-3v0a3 3 0 0 1 3 3v12" />
    <path d="M4 21V12a2 2 0 0 1 2-2h1" />
    <path d="M17 10h1a2 2 0 0 1 2 2v9" />
    <path d="M2 21h20" />
  </svg>
);

const SETTINGS_ICON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

/**
 * One student, with "¡Ya voy!" as the only action — the dominant gesture of
 * the whole app (docs/design-brief.md: "prácticamente un botón con
 * seguimiento"). Nothing else on the card competes with it.
 */
function StudentCard({ student, index }: { student: MyStudent; index: number }) {
  const navigate = useNavigate();

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <StudentPhoto student={student} index={index} />
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink-900)' }}>
            {student.fullName}
          </span>
        </div>
        <Button
          variant="primary"
          size="lg"
          full
          onClick={() => void navigate(selectInstitutionPath(student.id))}
        >
          ¡Ya voy!
        </Button>
      </div>
    </Card>
  );
}

export function Home() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [surface] = useState(resolveInitialSurface);
  const students = useMyStudents();
  const activePickup = useActivePickupRequest();

  // Evaluado una sola vez al montar (ADR-078 punto 4): un ancho de escritorio
  // al aterrizar aquí manda directo a Portal web, sin renderizar "Inicio".
  if (surface === 'web') {
    return <Navigate to={TUTOR_PORTAL_STUDENTS_PATH} replace />;
  }

  function goToPortalWeb() {
    setSurface('web');
    void navigate(TUTOR_PORTAL_STUDENTS_PATH);
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        padding: 'var(--space-8)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={EYEBROW_STYLE}>Tutor</span>
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--text-display-sm)',
                fontWeight: 800,
                color: 'var(--ink-900)',
                letterSpacing: '-.02em',
              }}
            >
              Mis hijos
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button variant="ghost" size="sm" icon={SETTINGS_ICON} onClick={goToPortalWeb}>
              Ajustes
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              Cerrar sesión
            </Button>
          </div>
        </div>

        <PushSubscriptionPrompt />

        {activePickup && (
          <Card style={{ background: 'var(--surface-muted)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>
                  Tienes una recogida en curso
                </span>
                <span style={{ fontSize: 13, color: 'var(--ink-400)' }}>
                  {activePickup.studentFullName} · {activePickup.institutionName}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate(trackingPath(activePickup.pickupRequestId))}
              >
                Ver seguimiento
              </Button>
            </div>
          </Card>
        )}

        {students.status === 'loading' && (
          <Card padding={0}>
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        )}

        {students.status === 'error' && (
          <Card>
            <ErrorState
              title="No pudimos cargar tus alumnos"
              message={students.error?.message}
              code={students.error?.code}
              onRetry={students.retry}
            />
          </Card>
        )}

        {students.status === 'empty' && (
          <Card>
            <EmptyState
              icon={EMPTY_ICON}
              title="Sin alumnos todavía"
              description="Da de alta a tu primer alumno desde el portal web para empezar a usar el seguimiento."
            />
          </Card>
        )}

        {students.status === 'ready' &&
          students.students.map((student, index) => (
            <StudentCard key={student.id} student={student} index={index} />
          ))}
      </div>
    </main>
  );
}
