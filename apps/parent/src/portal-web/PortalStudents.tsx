import { useNavigate } from 'react-router';
import { Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import type { EnrollmentStatus, InstitutionType } from '@casillego/shared';
import { useMyStudents, type MyStudent } from '../students/useMyStudents';
import { useMyEnrollments, type MyEnrollment } from '../enrollments/useMyEnrollments';
import { StudentPhoto } from '../students/StudentPhoto';
import { TUTOR_PORTAL_ASSOCIATE_PATH, TUTOR_PORTAL_GUARDIANS_PATH } from '../routes/paths';
import { Icon } from './icons';

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

/**
 * El kit (`ASOC_META`, línea ~468) solo define 3 etiquetas —
 * aprobada/revisión/enviada — todas de solicitudes en curso o exitosas;
 * nunca dibuja una rechazada. `EnrollmentStatus` sí tiene un tercer valor
 * real (`rejected`) que el kit no cubre — se extiende con los tokens de
 * `--danger` ya existentes en el proyecto en vez de ocultarle al tutor un
 * estado real.
 */
export const STATUS_META: Record<EnrollmentStatus, { label: string; bg: string; fg: string }> = {
  approved: {
    label: 'Aprobada',
    bg: 'var(--status-delivered-bg)',
    fg: 'var(--status-delivered-fg)',
  },
  pending: {
    label: 'En revisión',
    bg: 'var(--status-arriving-bg)',
    fg: 'var(--status-arriving-fg)',
  },
  rejected: { label: 'Rechazada', bg: 'var(--danger-bg)', fg: 'var(--danger)' },
};

/**
 * Second real consumer: `AssociateInstitutionPanel` (ADR-078 punto 3) needs
 * the same "Escuela/Actividad · categoría" formatting for a search result,
 * which carries `type`/`category` directly rather than nested in an
 * enrollment — taking the two fields as plain params (instead of a
 * `MyEnrollment`) is what lets both call sites share it.
 */
export function institutionTypeLabel(type: InstitutionType, category: string | null): string {
  const base = type === 'school' ? 'Escuela' : 'Actividad';
  return category ? `${base} · ${category}` : base;
}

/**
 * `MyStudent` no trae grado ni matrícula — viven en `MyEnrollment`, por
 * inscripción, no por alumno (un alumno con 2 instituciones tiene 2
 * valores distintos). Toma la primera inscripción aprobada, o la primera
 * que exista si ninguna lo está todavía.
 */
function primaryEnrollmentFor(
  studentId: string,
  enrollments: MyEnrollment[],
): MyEnrollment | undefined {
  const forStudent = enrollments.filter((enrollment) => enrollment.studentId === studentId);
  return forStudent.find((enrollment) => enrollment.status === 'approved') ?? forStudent[0];
}

function StudentRow({
  student,
  index,
  enrollments,
  onAuthorized,
  onAssociate,
}: {
  student: MyStudent;
  index: number;
  enrollments: MyEnrollment[];
  onAuthorized: () => void;
  onAssociate: () => void;
}) {
  const primary = primaryEnrollmentFor(student.id, enrollments);
  const studentEnrollments = enrollments.filter(
    (enrollment) => enrollment.studentId === student.id,
  );

  return (
    <Card radius="2xl" style={{ padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', rowGap: 14 }}>
        <StudentPhoto student={student} index={index} size={58} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            flex: '1 1 160px',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: 'var(--ink-900)',
              letterSpacing: '-.01em',
            }}
          >
            {student.fullName}
          </span>
          {primary?.gradeOrGroup && (
            <span style={{ fontSize: 13, color: 'var(--ink-300)', fontWeight: 500 }}>
              {primary.gradeOrGroup}
            </span>
          )}
          {primary && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--ink-200)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '.03em',
                marginTop: 2,
              }}
            >
              Matrícula {primary.enrollmentCode}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="outline" size="sm" onClick={onAuthorized}>
            Tutores autorizados
          </Button>
          <Button variant="outline" size="sm" onClick={onAssociate}>
            Asociar institución
          </Button>
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border-hairline)', margin: '18px 0 14px' }} />

      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '.09em',
          textTransform: 'uppercase',
          color: 'var(--ink-200)',
          marginBottom: 10,
        }}
      >
        Instituciones
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {studentEnrollments.length === 0 && (
          <span style={{ fontSize: 14, color: 'var(--ink-300)' }}>
            Sin instituciones asociadas todavía.
          </span>
        )}
        {studentEnrollments.map((enrollment) => {
          const meta = STATUS_META[enrollment.status];
          return (
            <div
              key={enrollment.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                padding: '11px 14px',
                background: 'var(--surface-muted)',
                borderRadius: 11,
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: '#fff',
                  border: '1px solid var(--border)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ink-300)',
                  flexShrink: 0,
                }}
              >
                <Icon name="building" size={17} />
              </span>
              <span
                style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-900)' }}>
                  {enrollment.institutionName}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-200)' }}>
                  {institutionTypeLabel(enrollment.institutionType, enrollment.institutionCategory)}
                </span>
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: meta.bg,
                  color: meta.fg,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.fg }} />
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * "Mis hijos" del Portal web (ADR-078 punto 3). Solo lectura en este paso:
 * el botón "Agregar alumno" del kit no tiene todavía una ruta de alta de
 * alumno en apps/parent, así que se deja fuera en vez de apuntarlo a la
 * nada (ver también el comentario en `TutorShell`). "Tutores
 * autorizados"/"Asociar institución" navegan a las rutas placeholder — se
 * conectan de verdad en los pasos siguientes.
 */
export function PortalStudents() {
  const navigate = useNavigate();
  const students = useMyStudents();
  const enrollments = useMyEnrollments();

  // Dos hooks independientes con la misma forma status/retry — se combinan
  // con el criterio más simple que cubre este paso: cargando si cualquiera
  // de los dos lo está, error si cualquiera de los dos falló (retry el que
  // haya fallado primero), listo cuando ambos lo están.
  const loading = students.status === 'loading' || enrollments.status === 'loading';
  const failed =
    students.status === 'error' ? students : enrollments.status === 'error' ? enrollments : null;

  const enrollmentList =
    enrollments.status === 'ready' || enrollments.status === 'empty' ? enrollments.enrollments : [];
  const count = students.status === 'ready' ? students.students.length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
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
      {students.status === 'ready' && (
        <div style={{ fontSize: 15, color: 'var(--ink-300)', fontWeight: 500, margin: '0 0 18px' }}>
          {count} {count === 1 ? 'alumno registrado' : 'alumnos registrados'}
        </div>
      )}

      {loading && !failed && (
        <Card padding={0} style={{ marginTop: 18 }}>
          <SkeletonRow />
          <SkeletonRow />
        </Card>
      )}

      {failed && (
        <Card style={{ marginTop: 18 }}>
          <ErrorState
            title="No pudimos cargar tus alumnos"
            message={failed.error?.message}
            code={failed.error?.code}
            onRetry={failed.retry}
          />
        </Card>
      )}

      {!loading && !failed && students.status === 'empty' && (
        <Card style={{ marginTop: 18 }}>
          <EmptyState
            icon={EMPTY_ICON}
            title="Sin alumnos todavía"
            description="Da de alta a tu primer alumno para empezar a usar el seguimiento."
          />
        </Card>
      )}

      {!loading && !failed && students.status === 'ready' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {students.students.map((student, index) => (
            <StudentRow
              key={student.id}
              student={student}
              index={index}
              enrollments={enrollmentList}
              onAuthorized={() => void navigate(TUTOR_PORTAL_GUARDIANS_PATH)}
              onAssociate={() => void navigate(TUTOR_PORTAL_ASSOCIATE_PATH)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
