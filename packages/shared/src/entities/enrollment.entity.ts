import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { EnrollmentStatus } from '../types/enrollment';
import { Student } from './student.entity';
import { Institution } from './institution.entity';
import { User } from './user.entity';
import { PickupRequest } from './pickup-request.entity';

const ENROLLMENT_STATUS_VALUES: readonly EnrollmentStatus[] = ['pending', 'approved', 'rejected'];

// Espejo declarativo del índice ya aplicado en la migración
// 1783697356401-PartialUniqueAndGinIndexes.ts — el SQL crudo de esa
// migración sigue siendo la fuente de verdad; este decorador solo evita
// que TypeORM proponga recrearlo. Ver ADR-024, ADR-025, ADR-026.
@Entity('enrollments')
@Index(['institution', 'status'])
@Index('IDX_enrollments_active_per_student_institution', ['student', 'institution'], {
  unique: true,
  where: `"status" IN ('pending', 'approved')`,
})
export class Enrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Student, (student) => student.enrollments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student!: Student;

  // Read-only mirror of the institution_id column already owned by the
  // `institution` relation below — lets InstitutionMembershipGuard read the
  // FK without eager-loading Institution. nullable:true matches the JoinColumn's
  // actual (default) nullability; do not tighten it here, it would produce a
  // schema diff. See ADR-029.
  @Column({ name: 'institution_id', type: 'uuid', nullable: true, insert: false, update: false })
  institutionId!: string;

  @ManyToOne(() => Institution, (institution) => institution.enrollments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'institution_id' })
  institution!: Institution;

  @Column({ name: 'status', type: 'enum', enum: ENROLLMENT_STATUS_VALUES, default: 'pending' })
  status!: EnrollmentStatus;

  @Column({ name: 'grade_or_group', type: 'varchar', length: 100, nullable: true })
  gradeOrGroup!: string | null;

  @Column({ name: 'enrollment_code', type: 'varchar', length: 50, unique: true })
  enrollmentCode!: string;

  @ManyToOne(() => User, (user) => user.enrollmentsRequested, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'requested_by_user_id' })
  requestedBy!: User;

  @ManyToOne(() => User, (user) => user.enrollmentsReviewed, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'reviewed_by_user_id' })
  reviewedBy!: User | null;

  @Column({ name: 'requested_at', type: 'timestamptz', default: () => 'now()' })
  requestedAt!: Date;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @OneToMany(() => PickupRequest, (pickupRequest) => pickupRequest.enrollment)
  pickupRequests!: PickupRequest[];
}
