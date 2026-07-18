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

// Espejo declarativo del índice ya aplicado en la migración
// 1783697356401-PartialUniqueAndGinIndexes.ts — el SQL crudo de esa
// migración sigue siendo la fuente de verdad; este decorador solo evita
// que TypeORM proponga recrearlo. Ver ADR-024, ADR-025.
@Entity('vehicles')
@Index('IDX_vehicles_primary_per_guardian', ['guardian'], {
  unique: true,
  where: '"is_primary" = true',
})
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
