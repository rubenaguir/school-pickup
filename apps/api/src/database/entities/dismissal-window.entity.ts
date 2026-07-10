import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { DismissalWindowStatus } from '@casillego/shared';
import { Institution } from './institution.entity';

const DISMISSAL_WINDOW_STATUS_VALUES: readonly DismissalWindowStatus[] = ['active', 'paused'];

@Entity('dismissal_windows')
@Index(['institution', 'weekday', 'status'])
export class DismissalWindow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Institution, (institution) => institution.dismissalWindows, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'institution_id' })
  institution!: Institution;

  @Column({ name: 'weekday', type: 'smallint' })
  weekday!: number;

  @Column({ name: 'start_time', type: 'time' })
  startTime!: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime!: string;

  @Column({ name: 'label', type: 'varchar', length: 255 })
  label!: string;

  @Column({ name: 'level', type: 'varchar', length: 100, nullable: true })
  level!: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: DISMISSAL_WINDOW_STATUS_VALUES,
    default: 'active',
  })
  status!: DismissalWindowStatus;
}
