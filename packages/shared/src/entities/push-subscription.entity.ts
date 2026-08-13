import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('push_subscriptions')
@Index('IDX_push_subscriptions_user_endpoint', ['user', 'endpoint'], { unique: true })
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => User, (user) => user.pushSubscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'endpoint', type: 'text' })
  endpoint!: string;

  @Column({ name: 'p256dh_key', type: 'varchar', length: 255 })
  p256dhKey!: string;

  @Column({ name: 'auth_key', type: 'varchar', length: 255 })
  authKey!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
