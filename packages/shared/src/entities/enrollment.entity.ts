import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import type { EnrollmentStatus } from '../types/enrollment';
import { Student } from './student.entity';
import { Institution } from './institution.entity';
import { User } from './user.entity';
import { PickupRequest } from './pickup-request.entity';
import { InstitutionGroup } from './institution-group.entity';

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

  @ManyToOne(() => Institution, (institution) => institution.enrollments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'institution_id' })
  institution!: Institution;

  // Scalar view of the institution_id FK, so InstitutionMembershipGuard can
  // read it without loading the Institution relation (the need established by
  // ADR-029). @RelationId is virtual — not a column — so unlike the previous
  // companion @Column({ insert: false, update: false }) it cannot suppress
  // institution_id from the INSERT. That companion merged with the @JoinColumn
  // above into a single ColumnMetadata whose isInsert=false won, so the FK was
  // silently never written and every new row got NULL. See ADR-044.
  @RelationId((enrollment: Enrollment) => enrollment.institution)
  institutionId!: string;

  @Column({ name: 'status', type: 'enum', enum: ENROLLMENT_STATUS_VALUES, default: 'pending' })
  status!: EnrollmentStatus;

  @Index()
  @ManyToOne(() => InstitutionGroup, (group) => group.enrollments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'group_id' })
  group!: InstitutionGroup | null;

  // Scalar view of the group_id FK — same @RelationId pattern as institutionId
  // below (ADR-029/044) — so services can read/validate it without loading the
  // InstitutionGroup relation. See ADR-084.
  @RelationId((enrollment: Enrollment) => enrollment.group)
  groupId!: string | null;

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
