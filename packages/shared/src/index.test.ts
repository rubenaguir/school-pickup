import { describe, expect, it } from 'vitest';
import { MQTT_TOPIC_ROOT, boardTopic, deliveryPointQueueTopic, pickupLocationTopic } from './index';

// Expected strings are copied literally from docs/arquitectura.md ("Estructura
// de topics MQTT y seguridad"), not regenerated with the same builders under
// test — a mismatch here silently breaks the tenant isolation enforced by the
// broker ACL.

describe('boardTopic', () => {
  it('matches the documented format', () => {
    expect(boardTopic('inst-1')).toBe('school-pickup/institution/inst-1/board');
  });
});

describe('pickupLocationTopic', () => {
  it('matches the documented format', () => {
    expect(pickupLocationTopic('inst-1', 'pickup-1')).toBe(
      'school-pickup/institution/inst-1/pickup/pickup-1/location',
    );
  });
});

describe('deliveryPointQueueTopic', () => {
  it('matches the documented format', () => {
    expect(deliveryPointQueueTopic('inst-1', 'dp-1')).toBe(
      'school-pickup/institution/inst-1/delivery-point/dp-1/queue',
    );
  });
});

describe('MQTT_TOPIC_ROOT', () => {
  it('prefixes every generated topic', () => {
    expect(boardTopic('inst-1').startsWith(MQTT_TOPIC_ROOT)).toBe(true);
    expect(pickupLocationTopic('inst-1', 'pickup-1').startsWith(MQTT_TOPIC_ROOT)).toBe(true);
    expect(deliveryPointQueueTopic('inst-1', 'dp-1').startsWith(MQTT_TOPIC_ROOT)).toBe(true);
  });
});
