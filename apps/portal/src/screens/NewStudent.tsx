import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button, Card } from '@casillego/ui';
import {
  STUDENT_GUARDIAN_RELATIONSHIPS,
  relationshipLabel,
  type StudentGuardianRelationship,
} from '@casillego/shared';
import { useTutor } from '../tutor/TutorContext';
import { createStudentErrorMessage } from '../students/student-error-messages';
import { useCreateStudent } from '../students/useCreateStudent';
import { Alert } from '../components/Alert';
import { Field, INPUT_STYLE } from '../components/Field';
import { STUDENTS_PATH } from '../routes/paths';

const EYEBROW_STYLE = {
  fontSize: 'var(--text-2xs)',
  letterSpacing: 'var(--tracking-eyebrow)',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: 'var(--ink-200)',
} as const;

/**
 * "Alta de alumno" (specs/features/004-alta-alumno.md). A tutor creates a
 * student and, in the same request, becomes its primary active guardian
 * (feature postcondition — nothing else to do here for that part). No photo
 * field: deliberate, ADR-058.
 */
export function NewStudent() {
  const navigate = useNavigate();
  const fieldId = useId();
  const tutor = useTutor();
  const { creating, error, create } = useCreateStudent();

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [relationship, setRelationship] = useState<StudentGuardianRelationship>('mother');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleCancel() {
    void navigate(STUDENTS_PATH);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = fullName.trim();
    if (trimmedName.length === 0) {
      setValidationError('Escribe el nombre completo del alumno.');
      return;
    }

    create({ fullName: trimmedName, birthDate: birthDate.trim() || null, relationship }, () => {
      // The provider already mounted above this route (AuthenticatedLayout),
      // so a refetch here is enough to make the new student show up on "Mis
      // hijos" without a manual reload.
      tutor.retry();
      void navigate(STUDENTS_PATH);
    });
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
          maxWidth: 640,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
              Agregar alumno
            </h1>
            <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
              Quedarás como su tutor principal. Después podrás asociarlo a su escuela o actividad.
            </span>
          </div>
        </Card>

        <Card>
          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 16,
              }}
            >
              <Field label="Nombre completo" htmlFor={`${fieldId}-name`}>
                <input
                  id={`${fieldId}-name`}
                  value={fullName}
                  required
                  autoFocus
                  onChange={(event) => {
                    setValidationError(null);
                    setFullName(event.target.value);
                  }}
                  style={INPUT_STYLE}
                />
              </Field>

              <Field label="Fecha de nacimiento" htmlFor={`${fieldId}-birth-date`} hint="Opcional.">
                <input
                  id={`${fieldId}-birth-date`}
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  style={INPUT_STYLE}
                />
              </Field>

              <Field label="Parentesco" htmlFor={`${fieldId}-relationship`}>
                <select
                  id={`${fieldId}-relationship`}
                  value={relationship}
                  onChange={(event) =>
                    setRelationship(event.target.value as StudentGuardianRelationship)
                  }
                  style={{ ...INPUT_STYLE, cursor: 'pointer' }}
                >
                  {STUDENT_GUARDIAN_RELATIONSHIPS.map((value) => (
                    <option key={value} value={value}>
                      {relationshipLabel(value)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {validationError && <Alert message={validationError} code="INVALID_PAYLOAD" />}
            {error && <Alert message={createStudentErrorMessage(error.code)} code={error.code} />}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
                borderTop: '1px solid var(--border-hairline)',
                paddingTop: 14,
              }}
            >
              <Button
                variant="outline"
                size="md"
                type="button"
                disabled={creating}
                onClick={handleCancel}
              >
                Cancelar
              </Button>
              <Button variant="primary" size="md" type="submit" disabled={creating}>
                {creating ? 'Agregando…' : 'Agregar alumno'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  );
}
