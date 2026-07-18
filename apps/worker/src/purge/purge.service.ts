import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationUpdate } from '@casillego/shared/entities';

const RETENTION_DAYS = 90;

@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(
    @InjectRepository(LocationUpdate)
    private readonly locationUpdateRepo: Repository<LocationUpdate>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredLocationUpdates(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const result = await this.locationUpdateRepo
      .createQueryBuilder()
      .delete()
      .from(LocationUpdate)
      .where(
        `pickup_request_id IN (
          SELECT id FROM pickup_requests
          WHERE completed_at IS NOT NULL AND completed_at < :cutoff
        )`,
        { cutoff },
      )
      .execute();

    this.logger.log(
      `Purged ${result.affected ?? 0} location_updates rows older than ${RETENTION_DAYS} days`,
    );
  }
}
