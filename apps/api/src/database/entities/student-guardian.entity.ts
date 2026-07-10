import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { StudentGuardianRelationship, StudentGuardianStatus } from '@casillego/shared';
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

// Two partial unique indexes from the spec are deliberately absent here (go in a
// future migration as raw SQL, not as entity decorators):
//   UNIQUE (student_id) WHERE is_primary = true
//   UNIQUE (student_id, guardian_user_id) WHERE status IN ('invited','active')
@Entity('student_guardians')
@Index(['student', 'status'])
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
