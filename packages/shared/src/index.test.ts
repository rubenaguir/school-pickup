import { describe, expect, it } from 'vitest';
import {
  MQTT_TOPIC_ROOT,
  boardTopic,
  deliveryPointQueueTopic,
  enrollmentGuardianTopic,
  enrollmentInstitutionTopic,
  institutionsAdminTopic,
  isInstitutionsAdminTopic,
  parseBoardTopic,
  parseDeliveryPointQueueTopic,
  parseEnrollmentGuardianTopic,
  parseEnrollmentInstitutionTopic,
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

describe('parseBoardTopic', () => {
  it('extracts institutionId from a matching topic', () => {
    expect(parseBoardTopic('school-pickup/institution/inst-1/board')).toEqual({
      institutionId: 'inst-1',
    });
  });

  it('is the exact inverse of boardTopic', () => {
    const topic = boardTopic('inst-42');
    expect(parseBoardTopic(topic)).toEqual({ institutionId: 'inst-42' });
  });

  // The api's pickup-request tracking bridge subscribes to a shared broker: a
  // message on any other CasiLlego topic must be discarded, not mistaken for
  // a board update.
  it('returns null for a topic of a different type', () => {
    expect(parseBoardTopic(deliveryPointQueueTopic('inst-1', 'dp-1'))).toBeNull();
    expect(parseBoardTopic(pickupLocationTopic('inst-1', 'pickup-1'))).toBeNull();
  });

  it('returns null for a malformed topic', () => {
    expect(parseBoardTopic('school-pickup/institution/board')).toBeNull();
    expect(parseBoardTopic('school-pickup/institution/inst-1/board/extra')).toBeNull();
    expect(parseBoardTopic('not-even-close')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseBoardTopic('')).toBeNull();
  });
});

describe('enrollmentInstitutionTopic', () => {
  it('matches the documented format', () => {
    expect(enrollmentInstitutionTopic('inst-1')).toBe(
      'school-pickup/institution/inst-1/enrollments',
    );
  });
});

describe('parseEnrollmentInstitutionTopic', () => {
  it('extracts institutionId from a matching topic', () => {
    expect(parseEnrollmentInstitutionTopic('school-pickup/institution/inst-1/enrollments')).toEqual(
      { institutionId: 'inst-1' },
    );
  });

  it('is the exact inverse of enrollmentInstitutionTopic', () => {
    const topic = enrollmentInstitutionTopic('inst-42');
    expect(parseEnrollmentInstitutionTopic(topic)).toEqual({ institutionId: 'inst-42' });
  });

  it('returns null for a topic of a different type', () => {
    expect(parseEnrollmentInstitutionTopic(boardTopic('inst-1'))).toBeNull();
    expect(parseEnrollmentInstitutionTopic(enrollmentGuardianTopic('user-1'))).toBeNull();
  });

  it('returns null for a malformed topic', () => {
    expect(parseEnrollmentInstitutionTopic('school-pickup/institution/enrollments')).toBeNull();
    expect(
      parseEnrollmentInstitutionTopic('school-pickup/institution/inst-1/enrollments/extra'),
    ).toBeNull();
    expect(parseEnrollmentInstitutionTopic('not-even-close')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseEnrollmentInstitutionTopic('')).toBeNull();
  });
});

describe('enrollmentGuardianTopic', () => {
  it('matches the documented format', () => {
    expect(enrollmentGuardianTopic('user-1')).toBe('school-pickup/guardian/user-1/enrollments');
  });

  it('prefixes with MQTT_TOPIC_ROOT', () => {
    expect(enrollmentGuardianTopic('user-1').startsWith(MQTT_TOPIC_ROOT)).toBe(true);
  });
});

describe('parseEnrollmentGuardianTopic', () => {
  it('extracts userId from a matching topic', () => {
    expect(parseEnrollmentGuardianTopic('school-pickup/guardian/user-1/enrollments')).toEqual({
      userId: 'user-1',
    });
  });

  it('is the exact inverse of enrollmentGuardianTopic', () => {
    const topic = enrollmentGuardianTopic('user-42');
    expect(parseEnrollmentGuardianTopic(topic)).toEqual({ userId: 'user-42' });
  });

  // The topics live under different root segments (institution/ vs guardian/)
  // on purpose, so a guardian's channel can never be confused for an
  // institution's even if the ids happened to collide.
  it('returns null for a topic of a different type', () => {
    expect(parseEnrollmentGuardianTopic(enrollmentInstitutionTopic('inst-1'))).toBeNull();
    expect(parseEnrollmentGuardianTopic(boardTopic('inst-1'))).toBeNull();
  });

  it('returns null for a malformed topic', () => {
    expect(parseEnrollmentGuardianTopic('school-pickup/guardian/enrollments')).toBeNull();
    expect(
      parseEnrollmentGuardianTopic('school-pickup/guardian/user-1/enrollments/extra'),
    ).toBeNull();
    expect(parseEnrollmentGuardianTopic('not-even-close')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseEnrollmentGuardianTopic('')).toBeNull();
  });
});

describe('institutionsAdminTopic', () => {
  it('matches the documented format', () => {
    expect(institutionsAdminTopic()).toBe('school-pickup/admin/institutions');
  });

  it('is global — takes no argument, unlike every other topic in this file', () => {
    expect(institutionsAdminTopic()).toBe(institutionsAdminTopic());
  });
});

describe('isInstitutionsAdminTopic', () => {
  it('matches the exact literal topic', () => {
    expect(isInstitutionsAdminTopic('school-pickup/admin/institutions')).toBe(true);
  });

  it('returns false for a topic of a different type', () => {
    expect(isInstitutionsAdminTopic(boardTopic('inst-1'))).toBe(false);
    expect(isInstitutionsAdminTopic(enrollmentInstitutionTopic('inst-1'))).toBe(false);
  });

  it('returns false for a malformed variant', () => {
    expect(isInstitutionsAdminTopic('school-pickup/admin/institutions/extra')).toBe(false);
    expect(isInstitutionsAdminTopic('not-even-close')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isInstitutionsAdminTopic('')).toBe(false);
  });
});
