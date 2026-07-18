import { Inject, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import {
  MQTT_CLIENT,
  MQTT_TOPIC_ROOT,
  parseLocationTopic,
  type MqttClient,
} from '@casillego/shared';
import { LocationIngestionModule } from '../location-ingestion/location-ingestion.module';
import { LocationIngestionService } from '../location-ingestion/location-ingestion.service';
import { MqttClientModule } from './mqtt-client.module';

const LOCATION_WILDCARD_TOPIC = `${MQTT_TOPIC_ROOT}/institution/+/pickup/+/location`;

/**
 * Subscribes, once at startup, to the location wildcard topic (ADR-031
 * pt.4) and delegates every incoming message to `LocationIngestionService`.
 * Connection/disconnection lifecycle lives in `MqttClientModule` — split out
 * so that `LocationIngestionService` (which needs `MQTT_CLIENT` to publish
 * board/queue updates) doesn't create a circular module dependency with the
 * module that owns the subscription.
 */
@Injectable()
export class MqttConnectionService implements OnModuleInit {
  private readonly logger = new Logger(MqttConnectionService.name);

  constructor(
    @Inject(MQTT_CLIENT) private readonly mqttClient: MqttClient,
    private readonly locationIngestion: LocationIngestionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.mqttClient.subscribe(LOCATION_WILDCARD_TOPIC, (topic, payload) => {
      this.handleMessage(topic, payload).catch((error) => {
        this.logger.error(
          `Unhandled error processing MQTT message on topic ${topic}`,
          error as Error,
        );
      });
    });
  }

  private async handleMessage(topic: string, payload: unknown): Promise<void> {
    const parsed = parseLocationTopic(topic);
    if (!parsed) {
      this.logger.warn(`Discarding message on unrecognized topic: ${topic}`);
      return;
    }
    await this.locationIngestion.handleLocationMessage(
      parsed.institutionId,
      parsed.pickupRequestId,
      payload,
    );
  }
}

@Module({
  imports: [MqttClientModule, LocationIngestionModule],
  providers: [MqttConnectionService],
})
export class MqttConnectionModule {}
