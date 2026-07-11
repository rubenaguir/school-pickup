import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Institution } from './institution.entity';

// Single composite unique index — the spec describes a (institution_id, date) lookup
// index that "also covers" the (institution_id, date, level) uniqueness constraint;
// one physical unique btree index serves both via leftmost-prefix matching.
@Entity('dismissal_exceptions')
@Index(['institution', 'date', 'level'], { unique: true })
export class DismissalException {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Read-only mirror of the institution_id column already owned by the
  // `institution` relation below — lets InstitutionMembershipGuard read the
  // FK without eager-loading Institution. nullable:true matches the JoinColumn's
  // actual (default) nullability; do not tighten it here, it would produce a
  // schema diff. See ADR-029.
  @Column({ name: 'institution_id', type: 'uuid', nullable: true, insert: false, update: false })
  institutionId!: string;

  @ManyToOne(() => Institution, (institution) => institution.dismissalExceptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'institution_id' })
  institution!: Institution;

  @Column({ name: 'date', type: 'date' })
  date!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'level', type: 'varchar', length: 100, nullable: true })
  level!: string | null;

  @Column({ name: 'time', type: 'time' })
  time!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
