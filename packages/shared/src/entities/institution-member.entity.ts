import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import type { InstitutionMemberRole } from '../types/institution-member';
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

  @ManyToOne(() => Institution, (institution) => institution.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'institution_id' })
  institution!: Institution;

  // Scalar view of the institution_id FK, so InstitutionMembershipGuard can
  // read it without loading the Institution relation (the need established by
  // ADR-029). @RelationId is virtual — not a column — so unlike the previous
  // companion @Column({ insert: false, update: false }) it cannot suppress
  // institution_id from the INSERT. That companion merged with the @JoinColumn
  // above into a single ColumnMetadata whose isInsert=false won, so the FK was
  // silently never written and every new row got NULL. See ADR-044.
  @RelationId((member: InstitutionMember) => member.institution)
  institutionId!: string;

  @Index()
  @ManyToOne(() => User, (user) => user.institutionMembers, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'role', type: 'enum', enum: INSTITUTION_MEMBER_ROLE_VALUES })
  role!: InstitutionMemberRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
