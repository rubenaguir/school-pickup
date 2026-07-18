import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { LocationIngestionModule } from './location-ingestion/location-ingestion.module';
import { MqttConnectionModule } from './mqtt/mqtt-connection.module';
import { PurgeModule } from './purge/purge.module';

/**
 * Root module of the worker process. Connects to Postgres, connects to the
 * MQTT broker and subscribes to the location wildcard topic, and ingests
 * location readings with throttled ETA recalculation (feature 019). The
 * automatic transition to `arriving` is added in a later round (feature 020).
 * Also runs the daily `location_updates` retention purge (feature 023).
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    LocationIngestionModule,
    MqttConnectionModule,
    PurgeModule,
  ],
})
export class AppModule {}
