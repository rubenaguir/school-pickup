import { useNavigate } from 'react-router';
import { Avatar, Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { useMyStudents, type MyStudent } from '../students/useMyStudents';
import { selectInstitutionPath } from '../routes/paths';
import { PushSubscriptionPrompt } from '../push/PushSubscriptionPrompt';

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

/** Photo if `photoUrl` exists, otherwise the same initials avatar the portal uses. */
function StudentPhoto({ student, index }: { student: MyStudent; index: number }) {
  if (!student.photoUrl) {
    return <Avatar name={student.fullName} index={index} size={56} />;
  }
  return (
    <img
      src={student.photoUrl}
      alt={student.fullName}
      width={56}
      height={56}
      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  );
}

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
  const students = useMyStudents();

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
          <Button variant="ghost" size="sm" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>

        <PushSubscriptionPrompt />

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
