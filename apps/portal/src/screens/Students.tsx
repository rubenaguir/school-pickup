import { useNavigate } from 'react-router';
import { Avatar, Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { useAuth } from '../auth/AuthContext';
import { useTutor, type StudentSummary } from '../tutor/TutorContext';
import { useMyEnrollments, type MyEnrollment } from '../students/useMyEnrollments';
import { institutionTypeLabel } from '../students/student-labels';
import { EnrollmentStatusPill } from '../students/EnrollmentStatusPill';
import { NEW_STUDENT_PATH, associateInstitutionPath, studentGuardiansPath } from '../routes/paths';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

const EMPTY_LIST_ICON = (
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

/** Photo if `photoUrl` exists, otherwise the same initials avatar every other list in the portal uses. */
function StudentPhoto({ student, index }: { student: StudentSummary; index: number }) {
  if (!student.photoUrl) {
    return <Avatar name={student.fullName} index={index} size={48} />;
  }
  return (
    <img
      src={student.photoUrl}
      alt={student.fullName}
      width={48}
      height={48}
      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  );
}

function InstitutionRow({ enrollment }: { enrollment: MyEnrollment }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '10px 0',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>
          {enrollment.institutionName}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-400)', fontWeight: 500 }}>
          {institutionTypeLabel(enrollment.institutionType)}
          {enrollment.institutionType === 'extracurricular' &&
            enrollment.institutionCategory &&
            ` · ${enrollment.institutionCategory}`}
        </span>
      </div>
      <EnrollmentStatusPill status={enrollment.status} />
    </div>
  );
}

function StudentCard({
  student,
  index,
  enrollments,
}: {
  student: StudentSummary;
  index: number;
  enrollments: MyEnrollment[];
}) {
  const navigate = useNavigate();

  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <StudentPhoto student={student} index={index} />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
              {student.fullName}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void navigate(studentGuardiansPath(student.id))}
            >
              Tutores autorizados
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void navigate(associateInstitutionPath(student.id))}
            >
              Asociar a institución
            </Button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-hairline)' }}>
          {enrollments.length === 0 ? (
            <div style={{ padding: '14px 0 4px' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-400)', lineHeight: 1.5 }}>
                Todavía no está asociado a ninguna institución.
              </span>
            </div>
          ) : (
            enrollments.map((enrollment) => (
              <div key={enrollment.id} style={{ borderBottom: '1px solid var(--border-hairline)' }}>
                <InstitutionRow enrollment={enrollment} />
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}

export function Students() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const tutor = useTutor();
  const myEnrollments = useMyEnrollments();

  const errorSource =
    tutor.status === 'error' ? tutor : myEnrollments.status === 'error' ? myEnrollments : null;
  const isLoading = tutor.status === 'loading' || myEnrollments.status === 'loading';

  const enrollmentsByStudent = new Map<string, MyEnrollment[]>();
  for (const enrollment of myEnrollments.enrollments) {
    const list = enrollmentsByStudent.get(enrollment.studentId) ?? [];
    list.push(enrollment);
    enrollmentsByStudent.set(enrollment.studentId, list);
  }

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
              <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>
                Sesión de {session?.email}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Button variant="primary" size="md" onClick={() => void navigate(NEW_STUDENT_PATH)}>
                Agregar alumno
              </Button>
              <Button variant="outline" size="sm" onClick={logout}>
                Cerrar sesión
              </Button>
            </div>
          </div>
        </Card>

        {isLoading && !errorSource && (
          <Card padding={0}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Card>
        )}

        {errorSource && (
          <Card>
            <ErrorState
              title="No pudimos cargar tus alumnos"
              message={errorSource.error?.message}
              code={errorSource.error?.code}
              onRetry={errorSource.retry}
            />
          </Card>
        )}

        {!isLoading && !errorSource && tutor.status === 'empty' && (
          <Card>
            <EmptyState
              icon={EMPTY_LIST_ICON}
              title="Sin alumnos todavía"
              description="Da de alta a tu primer alumno para empezar a asociarlo a su escuela o actividad."
              action={
                <Button variant="primary" size="md" onClick={() => void navigate(NEW_STUDENT_PATH)}>
                  Agregar alumno
                </Button>
              }
            />
          </Card>
        )}

        {!isLoading &&
          !errorSource &&
          tutor.status === 'ready' &&
          tutor.students.map((student, index) => (
            <StudentCard
              key={student.id}
              student={student}
              index={index}
              enrollments={enrollmentsByStudent.get(student.id) ?? []}
            />
          ))}
      </div>
    </main>
  );
}
