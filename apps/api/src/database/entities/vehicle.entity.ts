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
import { User } from './user.entity';
import { PickupRequest } from './pickup-request.entity';

// Partial unique index from the spec is deliberately absent here (goes in a
// future migration as raw SQL): UNIQUE (guardian_user_id) WHERE is_primary = true
@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => User, (user) => user.vehicles, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'guardian_user_id' })
  guardian!: User;

  @Column({ name: 'description', type: 'varchar', length: 255 })
  description!: string;

  @Column({ name: 'plate', type: 'varchar', length: 20 })
  plate!: string;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => PickupRequest, (pickupRequest) => pickupRequest.vehicle)
  pickupRequests!: PickupRequest[];
}
