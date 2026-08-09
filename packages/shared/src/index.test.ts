import { describe, expect, it } from 'vitest';
import {
  MQTT_TOPIC_ROOT,
  boardTopic,
  deliveryPointQueueTopic,
  parseDeliveryPointQueueTopic,
  parseLocationTopic,
  pickupLocationTopic,
} from './index';

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

describe('parseLocationTopic', () => {
  it('extracts institutionId and pickupRequestId from a matching topic', () => {
    expect(parseLocationTopic('school-pickup/institution/inst-1/pickup/pickup-1/location')).toEqual(
      { institutionId: 'inst-1', pickupRequestId: 'pickup-1' },
    );
  });

  it('is the exact inverse of pickupLocationTopic', () => {
    const topic = pickupLocationTopic('inst-42', 'pickup-99');
    expect(parseLocationTopic(topic)).toEqual({
      institutionId: 'inst-42',
      pickupRequestId: 'pickup-99',
    });
  });

  it('returns null for a topic of a different type', () => {
    expect(parseLocationTopic(boardTopic('inst-1'))).toBeNull();
    expect(parseLocationTopic(deliveryPointQueueTopic('inst-1', 'dp-1'))).toBeNull();
  });

  it('returns null for a malformed topic', () => {
    expect(parseLocationTopic('school-pickup/institution/inst-1/pickup/location')).toBeNull();
    expect(
      parseLocationTopic('school-pickup/institution/inst-1/pickup/pickup-1/location/extra'),
    ).toBeNull();
    expect(parseLocationTopic('not-even-close')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseLocationTopic('')).toBeNull();
  });
});

describe('parseDeliveryPointQueueTopic', () => {
  it('extracts institutionId and deliveryPointId from a matching topic', () => {
    expect(
      parseDeliveryPointQueueTopic('school-pickup/institution/inst-1/delivery-point/dp-1/queue'),
    ).toEqual({ institutionId: 'inst-1', deliveryPointId: 'dp-1' });
  });

  it('is the exact inverse of deliveryPointQueueTopic', () => {
    const topic = deliveryPointQueueTopic('inst-42', 'dp-99');
    expect(parseDeliveryPointQueueTopic(topic)).toEqual({
      institutionId: 'inst-42',
      deliveryPointId: 'dp-99',
    });
  });

  // The api's WebSocket bridge subscribes to a shared broker: a message on any
  // other CasiLlego topic must be discarded, not mistaken for a queue update.
  it('returns null for a topic of a different type', () => {
    expect(parseDeliveryPointQueueTopic(boardTopic('inst-1'))).toBeNull();
    expect(parseDeliveryPointQueueTopic(pickupLocationTopic('inst-1', 'pickup-1'))).toBeNull();
  });

  it('returns null for a malformed topic', () => {
    expect(
      parseDeliveryPointQueueTopic('school-pickup/institution/inst-1/delivery-point/queue'),
    ).toBeNull();
    expect(
      parseDeliveryPointQueueTopic(
        'school-pickup/institution/inst-1/delivery-point/dp-1/queue/extra',
      ),
    ).toBeNull();
    expect(parseDeliveryPointQueueTopic('not-even-close')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseDeliveryPointQueueTopic('')).toBeNull();
  });
});
