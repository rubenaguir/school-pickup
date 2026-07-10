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
