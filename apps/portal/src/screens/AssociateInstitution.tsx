import { useId, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { useTutor } from '../tutor/TutorContext';
import {
  useInstitutionSearch,
  type InstitutionSearchResult,
} from '../students/useInstitutionSearch';
import { useAssociateInstitution } from '../students/useAssociateInstitution';
import { institutionTypeLabel } from '../students/student-labels';
import {
  associateInstitutionErrorMessage,
  institutionSearchErrorMessage,
} from '../students/associate-institution-error-messages';
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

const SEARCH_ICON = (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

function InstitutionResultRow({
  institution,
  busy,
  onSelect,
}: {
  institution: InstitutionSearchResult;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--border-hairline)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-900)' }}>
          {institution.name}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink-400)', fontWeight: 500 }}>
          {institutionTypeLabel(institution.type)}
          {institution.type === 'extracurricular' &&
            institution.category &&
            ` · ${institution.category}`}
        </span>
      </div>
      <Button variant="outline" size="sm" disabled={busy} onClick={onSelect}>
        {busy ? 'Enviando…' : 'Asociar'}
      </Button>
    </div>
  );
}

/**
 * "Asociar a institución" (specs/features/005-asociar-institucion.md). Two
 * independent paths to the same POST /enrollments — search by name (resolves
 * `institutionId` client-side) or a join code (resolved server-side) — each
 * with its own `useAssociateInstitution()` instance so a failure on one path
 * never surfaces next to the other.
 */
export function AssociateInstitution() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const fieldId = useId();
  const tutor = useTutor();

  const [query, setQuery] = useState('');
  const search = useInstitutionSearch(query);
  const bySearch = useAssociateInstitution();

  const [joinCode, setJoinCode] = useState('');
  const byCode = useAssociateInstitution();

  const student =
    tutor.status === 'ready' ? tutor.students.find((item) => item.id === studentId) : undefined;

  function goToStudents() {
    // "Mis hijos" reads its enrollments through its own useMyEnrollments()
    // call, mounted fresh by this navigation (it is not a persistent context
    // like TutorContext) — no explicit refetch needed here.
    void navigate(STUDENTS_PATH);
  }

  function handleSelect(institutionId: string) {
    if (!studentId) return;
    bySearch.associate({ studentId, institutionId }, goToStudents);
  }

  function handleJoinCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!studentId) return;
    const trimmed = joinCode.trim();
    if (trimmed.length === 0) return;
    byCode.associate({ studentId, joinCode: trimmed }, goToStudents);
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
              Asociar a institución
            </h1>
            <span style={{ fontSize: 14, color: 'var(--ink-400)', lineHeight: 1.5 }}>
              {student
                ? `Elige cómo asociar a ${student.fullName} con su escuela o actividad. Busca por nombre o captura un código de invitación — son dos formas alternativas de enviar la misma solicitud.`
                : 'Busca por nombre o captura un código de invitación — son dos formas alternativas de enviar la misma solicitud.'}
            </span>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={EYEBROW_STYLE}>Buscar por nombre</span>
            </div>

            <Field label="Nombre de la institución" htmlFor={`${fieldId}-search`}>
              <input
                id={`${fieldId}-search`}
                value={query}
                autoFocus
                placeholder="Ej. Colegio Reforma"
                onChange={(event) => setQuery(event.target.value)}
                style={INPUT_STYLE}
              />
            </Field>

            {search.status === 'loading' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <SkeletonRow />
                <SkeletonRow />
              </div>
            )}

            {search.status === 'error' && (
              <ErrorState
                title="No pudimos buscar instituciones"
                message={
                  search.error ? institutionSearchErrorMessage(search.error.code) : undefined
                }
                code={search.error?.code}
                onRetry={search.retry}
              />
            )}

            {search.status === 'ready' && search.institutions.length === 0 && (
              <EmptyState
                icon={SEARCH_ICON}
                title="Sin resultados"
                description={`No encontramos ninguna institución aprobada que coincida con "${query.trim()}".`}
              />
            )}

            {search.status === 'ready' && search.institutions.length > 0 && (
              <div>
                {search.institutions.map((institution) => (
                  <InstitutionResultRow
                    key={institution.id}
                    institution={institution}
                    busy={bySearch.submitting}
                    onSelect={() => handleSelect(institution.id)}
                  />
                ))}
              </div>
            )}

            {bySearch.error && (
              <Alert
                message={associateInstitutionErrorMessage(bySearch.error.code)}
                code={bySearch.error.code}
              />
            )}
          </div>
        </Card>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
          <span style={EYEBROW_STYLE}>o</span>
          <span style={{ flex: 1, height: 1, background: 'var(--border-hairline)' }} />
        </div>

        <Card>
          <form
            onSubmit={handleJoinCodeSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={EYEBROW_STYLE}>Código de invitación</span>
              <span style={{ fontSize: 13, color: 'var(--ink-400)', lineHeight: 1.5 }}>
                Si la institución te dio un código, captúralo aquí en vez de buscar por nombre.
              </span>
            </div>

            <Field label="Código" htmlFor={`${fieldId}-join-code`}>
              <input
                id={`${fieldId}-join-code`}
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
                style={{ ...INPUT_STYLE, fontFamily: 'var(--font-mono)' }}
              />
            </Field>

            {byCode.error && (
              <Alert
                message={associateInstitutionErrorMessage(byCode.error.code)}
                code={byCode.error.code}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={byCode.submitting || joinCode.trim().length === 0}
              >
                {byCode.submitting ? 'Enviando…' : 'Enviar código'}
              </Button>
            </div>
          </form>
        </Card>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="md" onClick={goToStudents}>
            Cancelar
          </Button>
        </div>
      </div>
    </main>
  );
}
