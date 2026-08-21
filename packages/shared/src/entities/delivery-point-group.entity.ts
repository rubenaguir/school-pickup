import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { DeliveryPoint } from './delivery-point.entity';
import { InstitutionGroup } from './institution-group.entity';

// Relation table, same criteria as student-guardian.entity.ts, but with no
// extra columns beyond the composite PK. Replaces delivery_points.assigned_groups
// (free-text array). See ADR-084.
@Entity('delivery_point_groups')
export class DeliveryPointGroup {
  @PrimaryColumn({ name: 'delivery_point_id', type: 'uuid' })
  @ManyToOne(() => DeliveryPoint, (deliveryPoint) => deliveryPoint.deliveryPointGroups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'delivery_point_id' })
  deliveryPoint!: DeliveryPoint;

  @PrimaryColumn({ name: 'group_id', type: 'uuid' })
  @Index()
  @ManyToOne(() => InstitutionGroup, (group) => group.deliveryPointGroups, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'group_id' })
  group!: InstitutionGroup;
}
