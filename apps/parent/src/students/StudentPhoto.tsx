import { Avatar } from '@casillego/ui';
import type { MyStudent } from './useMyStudents';

/**
 * Photo if `photoUrl` exists, otherwise the same initials avatar the portal
 * uses. Shared between `Home` ("Inicio", App móvil) and `PortalStudents`
 * ("Mis hijos", Portal web — ADR-078 punto 3): pulled out of `Home.tsx` once
 * it got a second consumer, rather than duplicating it.
 */
export function StudentPhoto({
  student,
  index,
  size = 56,
}: {
  student: MyStudent;
  index: number;
  size?: number;
}) {
  if (!student.photoUrl) {
    return <Avatar name={student.fullName} index={index} size={size} />;
  }
  return (
    <img
      src={student.photoUrl}
      alt={student.fullName}
      width={size}
      height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  );
}
