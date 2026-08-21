import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { DeliveryPoint } from './delivery-point.entity';
import { InstitutionGroup } from './institution-group.entity';

// Relation table, same criteria as student-guardian.entity.ts, but with no
// extra columns beyond the composite PK. Replaces delivery_points.assigned_groups
// (free-text array). See ADR-084.
//
// deliveryPointId/groupId are real @PrimaryColumn scalars, kept as separate
// properties from the deliveryPoint/group relations below (which point at the
// same physical columns via @JoinColumn) rather than stacking both sets of
// decorators on one property. Stacking them compiles and works for plain
// find()/save() reads, but repository.create({ deliveryPoint, group }) then
// crashes ("Cannot create property 'id' on string ...") — TypeORM's
// PlainObjectToNewEntityTransformer tries to populate the single merged
// ColumnMetadata as both a raw uuid and a relation object on the same slot.
// Verified against Postgres in resolve-delivery-point.integration.spec.ts.
@Entity('delivery_point_groups')
export class DeliveryPointGroup {
  @PrimaryColumn({ name: 'delivery_point_id', type: 'uuid' })
  deliveryPointId!: string;

  @ManyToOne(() => DeliveryPoint, (deliveryPoint) => deliveryPoint.deliveryPointGroups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'delivery_point_id' })
  deliveryPoint!: DeliveryPoint;

  @PrimaryColumn({ name: 'group_id', type: 'uuid' })
  @Index()
  groupId!: string;

  @ManyToOne(() => InstitutionGroup, (group) => group.deliveryPointGroups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  group!: InstitutionGroup;
}
