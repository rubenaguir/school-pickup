import { useParams } from 'react-router';
import { Card } from '@casillego/ui';

/**
 * Placeholder for "Seleccionar institución" (docs/design-brief.md, "App del
 * padre") — reached from the "¡Ya voy!" button on "Mis hijos". Only the
 * route exists so navigation doesn't 404; its real content (institución,
 * vehículo/caminando) lands in a future session.
 */
export function SelectInstitution() {
  const { studentId } = useParams<{ studentId: string }>();

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-8)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <Card style={{ width: 380, maxWidth: '100%' }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--ink-400)' }}>
          Selección de institución — próximamente. Alumno {studentId}.
        </p>
      </Card>
    </main>
  );
}
