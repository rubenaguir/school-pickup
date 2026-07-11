import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { InstitutionMemberRole } from '@casillego/shared';
import { Institution } from './institution.entity';
import { User } from './user.entity';

const INSTITUTION_MEMBER_ROLE_VALUES: readonly InstitutionMemberRole[] = [
  'admin',
  'gate_operator',
  'coordinator',
  'teacher',
];

@Entity('institution_members')
@Index(['institution', 'user'], { unique: true })
export class InstitutionMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Read-only mirror of the institution_id column already owned by the
  // `institution` relation below — lets InstitutionMembershipGuard read the
  // FK without eager-loading Institution. nullable:true matches the JoinColumn's
  // actual (default) nullability; do not tighten it here, it would produce a
  // schema diff. See ADR-029.
  @Column({ name: 'institution_id', type: 'uuid', nullable: true, insert: false, update: false })
  institutionId!: string;

  @ManyToOne(() => Institution, (institution) => institution.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'institution_id' })
  institution!: Institution;

  @Index()
  @ManyToOne(() => User, (user) => user.institutionMembers, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'role', type: 'enum', enum: INSTITUTION_MEMBER_ROLE_VALUES })
  role!: InstitutionMemberRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
