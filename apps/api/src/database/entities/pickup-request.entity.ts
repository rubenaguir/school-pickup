import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ArrivalMode, PickupRequestStatus } from '@casillego/shared';
import { GeoPoint } from '../types/geo-point';
import { Enrollment } from './enrollment.entity';
import { Institution } from './institution.entity';
import { User } from './user.entity';
import { DeliveryPoint } from './delivery-point.entity';
import { Vehicle } from './vehicle.entity';
import { PickupRequestStatusHistory } from './pickup-request-status-history.entity';
import { LocationUpdate } from './location-update.entity';

export const PICKUP_REQUEST_STATUS_VALUES: readonly PickupRequestStatus[] = [
  'en_route',
  'arriving',
  'arrived',
  'delivered',
  'cancelled',
];
const ARRIVAL_MODE_VALUES: readonly ArrivalMode[] = ['vehicle', 'walking'];

// Two partial unique indexes from the spec are deliberately absent here (go in a
// future migration as raw SQL, not as entity decorators):
//   UNIQUE (enrollment_id) WHERE status IN ('en_route','arriving','arrived')
//   UNIQUE (institution_id, delivery_code) WHERE status IN ('en_route','arriving','arrived')
@Entity('pickup_requests')
@Index(['institution', 'status'])
export class PickupRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Enrollment, (enrollment) => enrollment.pickupRequests, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment!: Enrollment;

  // Denormalized from enrollment.institution_id at creation, immutable thereafter.
  // No inverse relation on Institution — institution.md's own relations list omits it.
  @ManyToOne(() => Institution, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'institution_id' })
  institution!: Institution;

  @ManyToOne(() => User, (user) => user.pickupRequests, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'guardian_user_id' })
  guardian!: User;

  @Index()
  @ManyToOne(() => DeliveryPoint, (deliveryPoint) => deliveryPoint.pickupRequests, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'delivery_point_id' })
  deliveryPoint!: DeliveryPoint | null;

  @Index()
  @Column({
    name: 'status',
    type: 'enum',
    enum: PICKUP_REQUEST_STATUS_VALUES,
    default: 'en_route',
  })
  status!: PickupRequestStatus;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt!: Date;

  @Column({ name: 'estimated_arrival_at', type: 'timestamptz', nullable: true })
  estimatedArrivalAt!: Date | null;

  @Column({ name: 'eta_seconds', type: 'int', nullable: true })
  etaSeconds!: number | null;

  @Column({
    name: 'last_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  lastLocation!: GeoPoint | null;

  @Column({ name: 'delivery_code', type: 'varchar', length: 4 })
  deliveryCode!: string;

  @Column({ name: 'arrival_mode', type: 'enum', enum: ARRIVAL_MODE_VALUES, nullable: true })
  arrivalMode!: ArrivalMode | null;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.pickupRequests, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle!: Vehicle | null;

  @Column({ name: 'vehicle_description', type: 'varchar', length: 255, nullable: true })
  vehicleDescription!: string | null;

  @Column({ name: 'vehicle_plate', type: 'varchar', length: 20, nullable: true })
  vehiclePlate!: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => PickupRequestStatusHistory, (statusHistory) => statusHistory.pickupRequest)
  statusHistory!: PickupRequestStatusHistory[];

  @OneToMany(() => LocationUpdate, (locationUpdate) => locationUpdate.pickupRequest)
  locationUpdates!: LocationUpdate[];
}
