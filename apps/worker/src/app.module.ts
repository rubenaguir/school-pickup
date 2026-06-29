import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';

/**
 * Root module of the worker process. Skeleton stage: only the placeholder
 * service. MQTT subscription, location ingestion and ETA calculation are added
 * in later phases.
 */
@Module({
  imports: [],
  providers: [WorkerService],
})
export class AppModule {}
