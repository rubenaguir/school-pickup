import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { UserStatus } from '../types/user';
import { InstitutionMember } from './institution-member.entity';
import { StudentGuardian } from './student-guardian.entity';
import { Vehicle } from './vehicle.entity';
import { Student } from './student.entity';
import { Enrollment } from './enrollment.entity';
import { PickupRequest } from './pickup-request.entity';
import { PickupRequestStatusHistory } from './pickup-request-status-history.entity';
import { DeliveryPoint } from './delivery-point.entity';
import { AuditLog } from './audit-log.entity';
import { PushSubscription } from './push-subscription.entity';

const USER_STATUS_VALUES: readonly UserStatus[] = ['active', 'invited', 'suspended'];

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'email', type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  // Nullable: NULL while a user invited as a student_guardian (feature 015)
  // hasn't accepted yet and their real name isn't known — see ADR-030,
  // same pattern as password_hash (ADR-022 point 2).
  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  fullName!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ name: 'status', type: 'enum', enum: USER_STATUS_VALUES, default: 'invited' })
  status!: UserStatus;

  @Column({ name: 'is_super_admin', type: 'boolean', default: false })
  isSuperAdmin!: boolean;

  @Column({ name: 'notify_enrollment_approved', type: 'boolean', default: true })
  notifyEnrollmentApproved!: boolean;

  @Column({ name: 'notify_dismissal_reminder', type: 'boolean', default: true })
  notifyDismissalReminder!: boolean;

  @Column({ name: 'notify_delivery_confirmed', type: 'boolean', default: true })
  notifyDeliveryConfirmed!: boolean;

  @Column({ name: 'notify_product_news', type: 'boolean', default: false })
  notifyProductNews!: boolean;

  // Nullable: NULL for every account created before ADR-099 (permanently, by
  // design — no retroactive mechanism) and set on the same INSERT/UPDATE that
  // creates or reuses a `users` row for every registration since.
  @Column({ name: 'privacy_accepted_at', type: 'timestamptz', nullable: true })
  privacyAcceptedAt!: Date | null;

  @Column({ name: 'privacy_notice_version', type: 'varchar', length: 20, nullable: true })
  privacyNoticeVersion!: string | null;

  // ADR-103: bumped on a successful password change; every refresh token whose
  // `tokenVersion` claim no longer matches this value is rejected by
  // POST /auth/refresh. Purely internal — never exposed on any endpoint.
  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => InstitutionMember, (institutionMember) => institutionMember.user)
  institutionMembers!: InstitutionMember[];

  @OneToMany(() => StudentGuardian, (studentGuardian) => studentGuardian.guardian)
  guardianOf!: StudentGuardian[];

  @OneToMany(() => Vehicle, (vehicle) => vehicle.guardian)
  vehicles!: Vehicle[];

  @OneToMany(() => Student, (student) => student.createdBy)
  studentsCreated!: Student[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.requestedBy)
  enrollmentsRequested!: Enrollment[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.reviewedBy)
  enrollmentsReviewed!: Enrollment[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.withdrawnBy)
  enrollmentsWithdrawn!: Enrollment[];

  @OneToMany(() => PickupRequest, (pickupRequest) => pickupRequest.guardian)
  pickupRequests!: PickupRequest[];

  @OneToMany(() => PickupRequestStatusHistory, (statusHistory) => statusHistory.changedBy)
  statusChangesMade!: PickupRequestStatusHistory[];

  @OneToMany(() => DeliveryPoint, (deliveryPoint) => deliveryPoint.operator)
  operatedDeliveryPoints!: DeliveryPoint[];

  @OneToMany(() => AuditLog, (auditLog) => auditLog.actor)
  auditLogEntries!: AuditLog[];

  @OneToMany(() => PushSubscription, (pushSubscription) => pushSubscription.user)
  pushSubscriptions!: PushSubscription[];
}
