import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MQTT_TOPIC_ROOT } from '@casillego/shared';

@Injectable()
export class WorkerService implements OnModuleInit {
  private readonly logger = new Logger(WorkerService.name);

  onModuleInit(): void {
    // Placeholder: a real MQTT client will subscribe under this root prefix.
    this.logger.log(`worker up — listening under topic root "${MQTT_TOPIC_ROOT}/"`);
  }
}
