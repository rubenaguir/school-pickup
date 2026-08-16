import { useState } from 'react';
import { useLocation } from 'react-router';
import { Card, EmptyState, ErrorState, SkeletonRow } from '@casillego/ui';
import { useMyStudents } from '../students/useMyStudents';
import { StudentPhoto } from '../students/StudentPhoto';
import { TUTOR_PORTAL_GUARDIANS_PATH } from '../routes/paths';
import { AssociateInstitutionPanel } from './AssociateInstitutionPanel';
import { AuthorizedGuardiansPanel } from './AuthorizedGuardiansPanel';
import { Icon } from './icons';

type PanelView = 'asociar' | 'autorizados';

const EMPTY_ICON = <Icon name="kid" size={28} />;

/**
 * "Asociar institución" + "Tutores autorizados" (ADR-078 punto 3): one
 * shared view with an in-memory student tab on top, not two routes keyed by
 * `:studentId` — same information architecture as the kit's `TutorPortal()`
 * (`view === 'asociar' || view === 'autorizados'` block).
 *
 * `view` is read straight from the matched route via `useLocation`, not kept
 * as local state: `TUTOR_PORTAL_ASSOCIATE_PATH` and `TUTOR_PORTAL_GUARDIANS_PATH`
 * both mount this same component at the same position in the tree, so React
 * Router does not necessarily remount it when the sidebar link switches
 * between them (project precedent: react-router-mismo-patron-no-remonta).
 * Deriving `view` from the URL on every render sidesteps that question
 * entirely instead of relying on a remount to reset it.
 */
export function AssociateAndGuardians() {
  const location = useLocation();
  const view: PanelView = location.pathname.startsWith(TUTOR_PORTAL_GUARDIANS_PATH)
    ? 'autorizados'
    : 'asociar';

  const students = useMyStudents();
  // Only ever set by clicking a tab — starts unset and falls back to the
  // first student, computed at render time below rather than synced via an
  // effect (react-hooks/set-state-in-effect: an effect must not call
  // setState synchronously from its own body).
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  if (students.status === 'loading') {
    return (
      <Card padding={0} style={{ width: '100%' }}>
        <SkeletonRow />
        <SkeletonRow />
      </Card>
    );
  }

  if (students.status === 'error') {
    return (
      <Card style={{ width: '100%' }}>
        <ErrorState
          title="No pudimos cargar tus alumnos"
          message={students.error?.message}
          code={students.error?.code}
          onRetry={students.retry}
        />
      </Card>
    );
  }

  if (students.status === 'empty') {
    return (
      <Card style={{ width: '100%' }}>
        <EmptyState
          icon={EMPTY_ICON}
          title="Sin alumnos todavía"
          description="Da de alta a un alumno para poder asociarlo a una institución o administrar sus tutores."
        />
      </Card>
    );
  }

  const activeChild =
    students.students.find((student) => student.id === selectedChildId) ?? students.students[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 840 }}>
      <h1
        style={{
          margin: '0 0 4px',
          fontSize: 'var(--text-display-sm)',
          fontWeight: 800,
          color: 'var(--ink-900)',
          letterSpacing: '-.02em',
        }}
      >
        {view === 'asociar' ? 'Asociar a institución' : 'Tutores autorizados'}
      </h1>
      <div style={{ fontSize: 15, color: 'var(--ink-300)', fontWeight: 500, marginBottom: 18 }}>
        {view === 'asociar'
          ? 'Se enviará una solicitud al administrador de la institución para su aprobación.'
          : `Quién más puede recoger a ${activeChild.fullName.split(' ')[0]}, además de ti.`}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 18,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--ink-200)', fontWeight: 600 }}>Alumno:</span>
        {students.students.map((student, index) => {
          const active = student.id === activeChild.id;
          return (
            <button
              key={student.id}
              type="button"
              onClick={() => setSelectedChildId(student.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 14px',
                borderRadius: 999,
                cursor: 'pointer',
                background: active ? 'var(--ink-900)' : '#fff',
                color: active ? '#fff' : 'var(--ink-600)',
                border: `1px solid ${active ? 'var(--ink-900)' : 'var(--border-strong)'}`,
                fontSize: 14,
                fontWeight: 600,
                fontFamily: 'var(--font-sans)',
              }}
            >
              <StudentPhoto student={student} index={index} size={22} />
              {student.fullName.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* Keyed by student id: switching the tab remounts the panel instead of
          reusing it with a changed prop, so each panel's own data hooks start
          fresh from their 'loading' initial state (same convention as
          useMyStudents) instead of having to reset it mid-life from an
          effect. */}
      {view === 'asociar' ? (
        <AssociateInstitutionPanel key={activeChild.id} student={activeChild} />
      ) : (
        <AuthorizedGuardiansPanel key={activeChild.id} student={activeChild} />
      )}
    </div>
  );
}
