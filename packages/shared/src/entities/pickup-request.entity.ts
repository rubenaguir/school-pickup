import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import type { ArrivalMode, PickupRequestStatus } from '../types/pickup-request';
import { GeoPoint } from '../types/geo-point';
import { Enrollment } from './enrollment.entity';
import { Institution } from './institution.entity';
import { User } from './user.entity';
import { DeliveryPoint } from './delivery-point.entity';
import { Vehicle } from './vehicle.entity';
import { PickupRequestStatusHistory } from './pickup-request-status-history.entity';
import { LocationUpdate } from './location-update.entity';
import { PICKUP_REQUEST_STATUS_VALUES } from './pickup-request-status.values';

const ARRIVAL_MODE_VALUES: readonly ArrivalMode[] = ['vehicle', 'walking'];

// Espejo declarativo de los índices ya aplicados en las migraciones
// 1783697356401-PartialUniqueAndGinIndexes.ts y
// 1787900000000-PickupRequestApproachingStatus.ts (esta última amplió el
// predicado con 'approaching', ADR-093) — el SQL crudo de esas migraciones
// sigue siendo la fuente de verdad; estos decoradores solo evitan que TypeORM
// proponga recrearlos. Ver ADR-024, ADR-025, ADR-093.
@Entity('pickup_requests')
@Index(['institution', 'status'])
@Index('IDX_pickup_requests_active_per_enrollment', ['enrollment'], {
  unique: true,
  where: `"status" IN ('en_route', 'arriving', 'arrived')`,
})
@Index(
  'IDX_pickup_requests_active_delivery_code_per_institution',
  ['institution', 'deliveryCode'],
  {
    unique: true,
    where: `"status" IN ('en_route', 'approaching', 'arriving', 'arrived')`,
  },
)
// Espejo declarativo del índice aplicado en la migración
// 1788300000000-AttentionWaitMinutesAndPickupIndex.ts — resuelve "¿este tutor
// ya completó alguna vez un `delivered` para este alumno?" (panel "Requiere
// atención" del Dashboard, condición de primera vez). Ver ADR-105.
@Index('IDX_pickup_requests_enrollment_guardian_status', ['enrollment', 'guardian', 'status'])
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
  //
  // nullable: false is what makes TypeORM model the column as NOT NULL. It used
  // to be inferred from the companion @Column, which declared no `nullable` and
  // therefore defaulted to NOT NULL; once @RelationId replaced it (ADR-044) the
  // only remaining source of truth is this relation, whose @ManyToOne default is
  // nullable. Without it, migration:generate proposes DROP NOT NULL and undoes
  // the migration of ADR-045.
  @ManyToOne(() => Institution, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'institution_id' })
  institution!: Institution;

  // Scalar view of the institution_id FK, so InstitutionMembershipGuard's
  // @InstitutionResource can read it without loading the Institution relation
  // (the need established by ADR-029, which this entity ended up sharing even
  // though ADR-018 point 4 scoped it out). @RelationId is virtual — not a
  // column — so unlike the previous companion @Column({ insert: false,
  // update: false }) it cannot suppress institution_id from the INSERT. That
  // companion merged with the @JoinColumn above into a single ColumnMetadata
  // whose isInsert=false won, so the FK was silently never written. See ADR-044.
  @RelationId((pickupRequest: PickupRequest) => pickupRequest.institution)
  institutionId!: string;

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

  // Persisted throttling state for the worker's ETA recalculation: the time half
  // (>= 20 s) is evaluated against this column, the spatial half (>= 150 m)
  // against last_location. Kept on the row, not in worker memory, so it survives
  // a restart and a second process instance. See ADR-024 pt.2 and ADR-031 pt.5.
  @Column({ name: 'eta_calculated_at', type: 'timestamptz', nullable: true })
  etaCalculatedAt!: Date | null;

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
