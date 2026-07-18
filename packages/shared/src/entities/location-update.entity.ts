import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GeoPoint } from '../types/geo-point';
import { PickupRequest } from './pickup-request.entity';

@Entity('location_updates')
@Index(['pickupRequest', 'recordedAt'])
export class LocationUpdate {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id!: string;

  @ManyToOne(() => PickupRequest, (pickupRequest) => pickupRequest.locationUpdates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pickup_request_id' })
  pickupRequest!: PickupRequest;

  @Column({ name: 'location', type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location!: GeoPoint;

  @Column({ name: 'accuracy_meters', type: 'double precision', nullable: true })
  accuracyMeters!: number | null;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt!: Date;
}
