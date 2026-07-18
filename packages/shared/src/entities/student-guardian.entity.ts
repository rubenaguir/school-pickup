import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { StudentGuardianRelationship, StudentGuardianStatus } from '../types/student-guardian';
import { Student } from './student.entity';
import { User } from './user.entity';

const STUDENT_GUARDIAN_RELATIONSHIP_VALUES: readonly StudentGuardianRelationship[] = [
  'mother',
  'father',
  'grandparent',
  'driver',
  'other',
];
const STUDENT_GUARDIAN_STATUS_VALUES: readonly StudentGuardianStatus[] = [
  'active',
  'invited',
  'revoked',
];

// Espejo declarativo de los índices ya aplicados en la migración
// 1783697356401-PartialUniqueAndGinIndexes.ts — el SQL crudo de esa
// migración sigue siendo la fuente de verdad; estos decoradores solo evitan
// que TypeORM proponga recrearlos. Ver ADR-024, ADR-025.
@Entity('student_guardians')
@Index(['student', 'status'])
@Index('IDX_student_guardians_primary_per_student', ['student'], {
  unique: true,
  where: '"is_primary" = true',
})
@Index('IDX_student_guardians_active_link', ['student', 'guardian'], {
  unique: true,
  where: `"status" IN ('invited', 'active')`,
})
export class StudentGuardian {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Student, (student) => student.guardians, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: Student;

  @Index()
  @ManyToOne(() => User, (user) => user.guardianOf, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'guardian_user_id' })
  guardian!: User;

  @Column({
    name: 'relationship',
    type: 'enum',
    enum: STUDENT_GUARDIAN_RELATIONSHIP_VALUES,
  })
  relationship!: StudentGuardianRelationship;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @Column({
    name: 'status',
    type: 'enum',
    enum: STUDENT_GUARDIAN_STATUS_VALUES,
    default: 'invited',
  })
  status!: StudentGuardianStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
