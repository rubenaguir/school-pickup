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
import type { DeliveryPointStatus } from '@casillego/shared';
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

  // GIN index on assigned_groups is deliberately excluded here — belongs in a future migration.
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
