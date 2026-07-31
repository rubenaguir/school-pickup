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

  // Scalar view of the institution_id FK, so InstitutionMembershipGuard can read
  // it without loading the Institution relation.
  //
  // PILOTO (ADR-029 pendiente de corregir): esto era un `@Column({ name:
  // 'institution_id', insert: false, update: false })`. TypeORM 1.0.0 fusiona esa
  // columna companion con el @JoinColumn de arriba en un unico ColumnMetadata, y
  // el `insert: false` gana: `InsertQueryBuilder.getInsertedColumns()` descartaba
  // institution_id de todo INSERT y el FK quedaba NULL en la base, aunque el
  // objeto en memoria devuelto por .save() si mostrara el valor. @RelationId es
  // virtual — no es una columna, asi que no puede suprimir nada del INSERT — y se
  // puebla en un `findOne` sin `relations`, que es justo lo que el guard hace.
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
