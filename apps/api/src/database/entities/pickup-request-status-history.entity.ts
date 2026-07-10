import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { PickupRequestStatus } from '@casillego/shared';
import { PickupRequest } from './pickup-request.entity';
import { User } from './user.entity';
import { PICKUP_REQUEST_STATUS_VALUES } from './pickup-request-status.values';

@Entity('pickup_request_status_history')
@Index(['pickupRequest', 'changedAt'])
export class PickupRequestStatusHistory {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id!: string;

  @ManyToOne(() => PickupRequest, (pickupRequest) => pickupRequest.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pickup_request_id' })
  pickupRequest!: PickupRequest;

  @Column({ name: 'status', type: 'enum', enum: PICKUP_REQUEST_STATUS_VALUES })
  status!: PickupRequestStatus;

  @Column({ name: 'changed_at', type: 'timestamptz', default: () => 'now()' })
  changedAt!: Date;

  @ManyToOne(() => User, (user) => user.statusChangesMade, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'changed_by_user_id' })
  changedBy!: User | null;
}
