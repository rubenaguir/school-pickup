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
import type { DeliveryPointStatus } from '../types/delivery-point';
import { Institution } from './institution.entity';
import { User } from './user.entity';
import { PickupRequest } from './pickup-request.entity';

const DELIVERY_POINT_STATUS_VALUES: readonly DeliveryPointStatus[] = ['active', 'inactive'];

@Entity('delivery_points')
export class DeliveryPoint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Institution, (institution) => institution.deliveryPoints, {
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
  @RelationId((deliveryPoint: DeliveryPoint) => deliveryPoint.institution)
  institutionId!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'description', type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @ManyToOne(() => User, (user) => user.operatedDeliveryPoints, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'operator_user_id' })
  operator!: User | null;

  // Espejo declarativo del índice ya aplicado en la migración
  // 1783697356401-PartialUniqueAndGinIndexes.ts — el SQL crudo de esa
  // migración sigue siendo la fuente de verdad; este decorador solo evita
  // que TypeORM proponga recrearlo. Ver ADR-024, ADR-025.
  @Index('IDX_delivery_points_assigned_groups', { type: 'gin' })
  @Column({ name: 'assigned_groups', type: 'varchar', array: true, length: 100, nullable: true })
  assignedGroups!: string[] | null;

  @Column({ name: 'status', type: 'enum', enum: DELIVERY_POINT_STATUS_VALUES, default: 'active' })
  status!: DeliveryPointStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => PickupRequest, (pickupRequest) => pickupRequest.deliveryPoint)
  pickupRequests!: PickupRequest[];
}
