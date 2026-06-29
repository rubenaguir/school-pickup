import { Controller, Get } from '@nestjs/common';
import { MQTT_TOPIC_ROOT } from '@casillego/shared';

@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string; service: string; mqttTopicRoot: string } {
    return {
      status: 'ok',
      service: 'casillego-api',
      mqttTopicRoot: MQTT_TOPIC_ROOT,
    };
  }
}
