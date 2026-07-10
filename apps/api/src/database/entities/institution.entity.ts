import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { InstitutionStatus, InstitutionType } from '@casillego/shared';
import { GeoPoint } from '../types/geo-point';
import { InstitutionMember } from './institution-member.entity';
import { DeliveryPoint } from './delivery-point.entity';
import { Enrollment } from './enrollment.entity';
import { DismissalWindow } from './dismissal-window.entity';
import { DismissalException } from './dismissal-exception.entity';

const INSTITUTION_TYPE_VALUES: readonly InstitutionType[] = ['school', 'extracurricular'];
const INSTITUTION_STATUS_VALUES: readonly InstitutionStatus[] = [
  'pending',
  'approved',
  'suspended',
];

@Entity('institutions')
export class Institution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'type', type: 'enum', enum: INSTITUTION_TYPE_VALUES })
  type!: InstitutionType;

  @Column({ name: 'category', type: 'varchar', length: 100, nullable: true })
  category!: string | null;

  @Column({ name: 'address', type: 'varchar', length: 500 })
  address!: string;

  @Index({ spatial: true })
  @Column({ name: 'location', type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location!: GeoPoint;

  @Column({ name: 'geofence_radius_meters', type: 'int', default: 100 })
  geofenceRadiusMeters!: number;

  @Column({ name: 'activation_radius_meters', type: 'int', default: 3000 })
  activationRadiusMeters!: number;

  @Column({ name: 'timezone', type: 'varchar', length: 50 })
  timezone!: string;

  @Column({ name: 'cct_code', type: 'varchar', length: 20, nullable: true })
  cctCode!: string | null;

  @Column({ name: 'levels', type: 'varchar', array: true, length: 50, default: [] })
  levels!: string[];

  @Column({ name: 'arrival_tolerance_minutes', type: 'int', default: 10 })
  arrivalToleranceMinutes!: number;

  @Column({ name: 'advance_notice_minutes', type: 'int', default: 15 })
  advanceNoticeMinutes!: number;

  @Column({ name: 'arriving_lead_minutes', type: 'int', default: 5 })
  arrivingLeadMinutes!: number;

  @Column({ name: 'join_code', type: 'varchar', length: 20, unique: true })
  joinCode!: string;

  @Index()
  @Column({ name: 'status', type: 'enum', enum: INSTITUTION_STATUS_VALUES, default: 'pending' })
  status!: InstitutionStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => InstitutionMember, (institutionMember) => institutionMember.institution)
  members!: InstitutionMember[];

  @OneToMany(() => DeliveryPoint, (deliveryPoint) => deliveryPoint.institution)
  deliveryPoints!: DeliveryPoint[];

  @OneToMany(() => Enrollment, (enrollment) => enrollment.institution)
  enrollments!: Enrollment[];

  @OneToMany(() => DismissalWindow, (dismissalWindow) => dismissalWindow.institution)
  dismissalWindows!: DismissalWindow[];

  @OneToMany(() => DismissalException, (dismissalException) => dismissalException.institution)
  dismissalExceptions!: DismissalException[];
}
