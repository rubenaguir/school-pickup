import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import type { DismissalWindowStatus } from '../types/dismissal-window';
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

  // Scalar view of the institution_id FK, so InstitutionMembershipGuard can
  // read it without loading the Institution relation (the need established by
  // ADR-029). @RelationId is virtual — not a column — so unlike the previous
  // companion @Column({ insert: false, update: false }) it cannot suppress
  // institution_id from the INSERT. That companion merged with the @JoinColumn
  // above into a single ColumnMetadata whose isInsert=false won, so the FK was
  // silently never written and every new row got NULL. See ADR-044.
  @RelationId((dismissalWindow: DismissalWindow) => dismissalWindow.institution)
  institutionId!: string;

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
