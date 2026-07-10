import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { EnrollmentStatus } from '@casillego/shared';
import { Student } from './student.entity';
import { Institution } from './institution.entity';
import { User } from './user.entity';
import { PickupRequest } from './pickup-request.entity';

const ENROLLMENT_STATUS_VALUES: readonly EnrollmentStatus[] = ['pending', 'approved', 'rejected'];

// Partial unique index from the spec is deliberately absent here (goes in a
// future migration as raw SQL): UNIQUE (student_id, institution_id) WHERE status IN ('pending','approved')
@Entity('enrollments')
@Index(['institution', 'status'])
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
