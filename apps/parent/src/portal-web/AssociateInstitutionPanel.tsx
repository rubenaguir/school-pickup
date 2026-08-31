import { useEffect, useState } from 'react';
import { Button, Card } from '@casillego/ui';
import { ApiError, asApiError, UNKNOWN_ERROR_CODE } from '@casillego/shared';
import type { InstitutionType } from '@casillego/shared';
import { apiClient } from '../api/client';
import { useMyEnrollments, type MyEnrollment } from '../enrollments/useMyEnrollments';
import type { MyStudent } from '../students/useMyStudents';
import { institutionTypeLabel, STATUS_META } from './PortalStudents';
import { blockingEnrollment, rejectedEnrollment } from './associate-institution-rules';
import {
  institutionSearchErrorMessage,
  enrollmentRequestErrorMessage,
} from './associate-error-messages';
import { InlineError } from './InlineError';
import { Icon } from './icons';

const SEARCH_DEBOUNCE_MS = 300;

/** One row of GET /institutions?search=... (specs/api-contracts/institutions.md, ADR-037). */
interface InstitutionSearchResult {
  id: string;
  name: string;
  type: InstitutionType;
  category: string | null;
}

interface SearchInstitutionsResponse {
  institutions: InstitutionSearchResult[];
}

interface CreateEnrollmentResponse {
  id: string;
  studentId: string;
  institutionId: string;
  status: 'pending';
}

interface SearchState {
  status: 'loading' | 'ready' | 'error';
  results: InstitutionSearchResult[];
  error: ApiError | null;
}

/**
 * Owns the actual `GET /institutions?search=` fetch for one settled query.
 * `AssociateInstitutionPanel` mounts it with `key={query}`, so a new query
 * is a fresh mount rather than a prop change reused in place — same
 * "'loading' is the initial state" convention as `useMyStudents`
 * (react-hooks/set-state-in-effect forbids resetting it synchronously from
 * inside this effect on every keystroke's settled query instead).
 */
function InstitutionSearchResults({
  query,
  existingFor,
  rejectedFor,
  submittingId,
  requestErrors,
  onRequest,
}: {
  query: string;
  existingFor: (institutionId: string) => MyEnrollment | undefined;
  rejectedFor: (institutionId: string) => MyEnrollment | undefined;
  submittingId: string | null;
  requestErrors: Record<string, ApiError>;
  onRequest: (institution: InstitutionSearchResult) => void;
}) {
  const [state, setState] = useState<SearchState>({ status: 'loading', results: [], error: null });

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<SearchInstitutionsResponse>(`/institutions?search=${encodeURIComponent(query)}`)
      .then((response) => {
        if (cancelled) return;
        setState({ status: 'ready', results: response.institutions, error: null });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', results: [], error: asApiError(caught) });
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  if (state.status === 'loading') {
    return <span style={{ fontSize: 14, color: 'var(--ink-300)' }}>Buscando…</span>;
  }

  if (state.status === 'error') {
    return (
      <InlineError
        message={institutionSearchErrorMessage(state.error?.code ?? UNKNOWN_ERROR_CODE)}
        code={state.error?.code}
      />
    );
  }

  if (state.results.length === 0) {
    return (
      <span style={{ fontSize: 14, color: 'var(--ink-300)' }}>
        Sin resultados para &ldquo;{query}&rdquo;.
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {state.results.map((institution) => {
        const existing = existingFor(institution.id);
        const meta = existing ? STATUS_META[existing.status] : null;
        const rejected = rejectedFor(institution.id);
        const submitting = submittingId === institution.id;
        const rowError = requestErrors[institution.id];

        return (
          <Card key={institution.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 11,
                  background: 'var(--surface-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ink-300)',
                  flexShrink: 0,
                }}
              >
                <Icon name="building" size={20} />
              </span>
              <span
                style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}
              >
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-900)' }}>
                  {institution.name}
                </span>
                <span style={{ fontSize: 13, color: 'var(--ink-200)' }}>
                  {institutionTypeLabel(institution.type, institution.category)}
                </span>
              </span>
              {meta ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 15px',
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
              ) : (
                <Button size="sm" disabled={submitting} onClick={() => onRequest(institution)}>
                  {submitting ? 'Enviando…' : 'Solicitar asociación'}
                </Button>
              )}
            </div>
            {!meta && rejected && (
              <div style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-300)' }}>
                Tu solicitud anterior fue rechazada.
              </div>
            )}
            {rowError && (
              <div style={{ marginTop: 12 }}>
                <InlineError
                  message={enrollmentRequestErrorMessage(rowError.code)}
                  code={rowError.code}
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/**
 * "Asociar institución" (ADR-078 punto 3, specs/features/005-asociar-institucion.md)
 * for one student at a time — `AssociateAndGuardians` supplies which one via
 * the in-memory tab. Real search against `GET /institutions?search=`
 * (debounced 300ms; the endpoint has no protection of its own against a call
 * per keystroke) instead of the kit's static result list.
 */
export function AssociateInstitutionPanel({ student }: { student: MyStudent }) {
  const enrollments = useMyEnrollments();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [requestErrors, setRequestErrors] = useState<Record<string, ApiError>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // Read the raw array, not gated on `enrollments.status`: `retry()` only
  // flips status back to 'loading' — it does not clear the list — so this
  // stays populated with the previous data through a refetch and updates in
  // place once the new one lands, with no flicker back to "Solicitar
  // asociación" while it's in flight.
  const studentEnrollments = enrollments.enrollments.filter((e) => e.studentId === student.id);

  // Only pending/approved block a retry: the partial unique index
  // `("student_id", "institution_id") WHERE "status" IN ('pending', 'approved')`
  // (apps/api/src/database/migrations/1783697356401-PartialUniqueAndGinIndexes.ts)
  // excludes `rejected` on purpose, and `POST /enrollments` relies on that
  // index to raise DUPLICATE_ENROLLMENT — a rejected row does not 409 on
  // retry (specs/entities/enrollment.md, ADR-026 punto 1).
  const existingEnrollment = (institutionId: string) =>
    blockingEnrollment(studentEnrollments, institutionId);
  const rejectedForInstitution = (institutionId: string) =>
    rejectedEnrollment(studentEnrollments, institutionId);

  function requestAssociation(institution: InstitutionSearchResult) {
    setRequestErrors((current) => {
      const next = { ...current };
      delete next[institution.id];
      return next;
    });
    setSubmittingId(institution.id);

    apiClient
      .post<CreateEnrollmentResponse>('/enrollments', {
        studentId: student.id,
        institutionId: institution.id,
      })
      .then(() => {
        enrollments.retry();
      })
      .catch((caught: unknown) => {
        setRequestErrors((current) => ({ ...current, [institution.id]: asApiError(caught) }));
      })
      .finally(() => {
        setSubmittingId((current) => (current === institution.id ? null : current));
      });
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#fff',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          padding: '13px 16px',
          marginBottom: 18,
        }}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-200)"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4-4" />
        </svg>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar institución por nombre o clave"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            color: 'var(--ink-900)',
          }}
        />
      </div>

      {debouncedQuery !== '' && (
        <InstitutionSearchResults
          key={debouncedQuery}
          query={debouncedQuery}
          existingFor={existingEnrollment}
          rejectedFor={rejectedForInstitution}
          submittingId={submittingId}
          requestErrors={requestErrors}
          onRequest={requestAssociation}
        />
      )}
    </>
  );
}
