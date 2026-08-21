import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { Institution } from './institution.entity';
import { Enrollment } from './enrollment.entity';
import { DeliveryPointGroup } from './delivery-point-group.entity';

@Entity('institution_groups')
@Index('IDX_institution_groups_name_ci', ['institution', 'name'], {
  unique: true,
  // Functional, over lower(name) — case-insensitive on purpose: the point of
  // this catalog is to eliminate the "1A" vs "1a" ambiguity that free text
  // allowed. Raw SQL of this index is in the migration; this decorator only
  // mirrors it so TypeORM doesn't propose recreating it. See ADR-084.
})
export class InstitutionGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Institution, (institution) => institution.groups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'institution_id' })
  institution!: Institution;

  // Scalar view of the institution_id FK, so InstitutionMembershipGuard can
  // read it without loading the Institution relation (the need established by
  // ADR-029). Same mechanism as DeliveryPoint/Enrollment — see ADR-044.
  @RelationId((institutionGroup: InstitutionGroup) => institutionGroup.institution)
  institutionId!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => Enrollment, (enrollment) => enrollment.group)
  enrollments!: Enrollment[];

  @OneToMany(() => DeliveryPointGroup, (deliveryPointGroup) => deliveryPointGroup.group)
  deliveryPointGroups!: DeliveryPointGroup[];
}
