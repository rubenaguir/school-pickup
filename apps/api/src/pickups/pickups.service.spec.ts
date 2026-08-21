import { afterEach, describe, expect, it, vi } from 'vitest';
import { In } from 'typeorm';
import { buildBoardMonitorPayload, buildBoardPayload, buildQueuePayload } from '@casillego/shared';
import { PickupsService } from './pickups.service';
import {
  PickupRequest,
  PickupRequestStatusHistory,
  type DeliveryPoint,
  type Enrollment,
  type Institution,
  type InstitutionGroup,
  type Student,
  type Vehicle,
} from '@casillego/shared/entities';

function buildEnrollment(overrides?: Partial<Enrollment>): Enrollment {
  return {
    id: 'enr-1',
    student: { id: 'stu-1', fullName: 'Ana Pérez' } as Student,
    institutionId: 'inst-1',
    institution: { id: 'inst-1', name: 'Escuela Uno', status: 'approved' } as Institution,
    status: 'approved',
    groupId: null,
    group: null,
    enrollmentCode: 'ENR-ABCD1234',
    requestedBy: { id: 'user-1' },
    reviewedBy: null,
    requestedAt: new Date('2026-07-01T00:00:00.000Z'),
    reviewedAt: null,
    ...overrides,
  } as Enrollment;
}

function buildPickupRequest(overrides?: Partial<PickupRequest>): PickupRequest {
  return {
    id: 'pr-1',
    enrollment: { id: 'enr-1' },
    institution: { id: 'inst-1', location: { type: 'Point', coordinates: [-99.1332, 19.4326] } },
    institutionId: 'inst-1',
    guardian: { id: 'user-1' },
    deliveryPoint: null,
    status: 'en_route',
    startedAt: new Date('2026-07-16T08:00:00.000Z'),
    estimatedArrivalAt: null,
    etaSeconds: null,
    lastLocation: null,
    deliveryCode: '1234',
    arrivalMode: null,
    vehicle: null,
    vehicleDescription: null,
    vehiclePlate: null,
    completedAt: null,
    createdAt: new Date('2026-07-16T08:00:00.000Z'),
    updatedAt: new Date('2026-07-16T08:00:00.000Z'),
    ...overrides,
  } as PickupRequest;
}

interface FakeDeliveryPoint {
  id: string;
  institutionId: string;
  status: 'active' | 'inactive';
  groupIds: string[];
  createdAt: Date;
}

// Mirrors the real query in resolveDeliveryPointId (institution + status,
// ordered by oldest created_at) — ADR-083 replaced the createQueryBuilder
// call with a plain find() over the institution's active points, with the
// group match resolved in memory afterwards. ADR-084: the match itself now
// compares deliveryPointGroups[].groupId (ids), not assignedGroups (strings).
function buildDeliveryPointsRepo(deliveryPoints: FakeDeliveryPoint[]) {
  return {
    find: vi.fn(({ where }: { where: { institution: { id: string }; status: string } }) => {
      const matches = deliveryPoints
        .filter((dp) => dp.institutionId === where.institution.id)
        .filter((dp) => dp.status === where.status)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((dp) => ({
          ...dp,
          deliveryPointGroups: dp.groupIds.map((groupId) => ({ groupId })),
        }));
      return Promise.resolve(matches);
    }),
  };
}

function buildOwnedPickupRequest(overrides?: Partial<PickupRequest>): PickupRequest {
  return buildPickupRequest({
    guardian: { id: 'user-1' },
    enrollment: {
      id: 'enr-1',
      institutionId: 'inst-1',
      groupId: 'group-3b',
      group: { name: '3°B' } as InstitutionGroup,
      student: { id: 'stu-1', fullName: 'Ana Pérez' },
    } as Enrollment,
    institution: {
      id: 'inst-1',
      location: { type: 'Point', coordinates: [-99.1332, 19.4326] },
    } as Institution,
    deliveryPoint: null,
    ...overrides,
  });
}

function buildService(overrides?: {
  pickupRequests?: Partial<
    Record<
      'exists' | 'create' | 'save' | 'findOne' | 'findAndCount' | 'createQueryBuilder',
      unknown
    >
  >;
  enrollments?: Partial<Record<'findOne', unknown>>;
  studentGuardians?: Partial<Record<'findOne' | 'exists' | 'find', unknown>>;
  institutionMembers?: Partial<Record<'exists', unknown>>;
  vehicles?: Partial<Record<'findOne', unknown>>;
  auditLog?: Partial<Record<'create' | 'save', unknown>>;
  pushSubscriptions?: Partial<Record<'find', unknown>>;
  pushProvider?: Partial<Record<'send', unknown>>;
  dataSource?: Partial<Record<'transaction', unknown>>;
  mqttClient?: Partial<Record<'publish', unknown>>;
  deliveryPoints?: FakeDeliveryPoint[];
  deliveryPointAccess?: Partial<Record<'checkMemberAccess', unknown>>;
  institutionAccess?: Partial<Record<'checkMemberAccess', unknown>>;
}) {
  const pickupRequestsRepo = {
    exists: vi.fn().mockResolvedValue(false),
    create: vi.fn((partial: Partial<PickupRequest>) => partial),
    save: vi.fn((entity: Partial<PickupRequest>) => Promise.resolve(buildPickupRequest(entity))),
    findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest()),
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
    ...overrides?.pickupRequests,
  };
  const enrollmentsRepo = {
    findOne: vi.fn().mockResolvedValue(buildEnrollment()),
    ...overrides?.enrollments,
  };
  const studentGuardiansRepo = {
    findOne: vi.fn().mockResolvedValue({ status: 'active' }),
    exists: vi.fn().mockResolvedValue(true),
    find: vi.fn().mockResolvedValue([]),
    ...overrides?.studentGuardians,
  };
  const institutionMembersRepo = {
    exists: vi.fn().mockResolvedValue(true),
    ...overrides?.institutionMembers,
  };
  const vehiclesRepo = {
    findOne: vi.fn().mockResolvedValue(null),
    ...overrides?.vehicles,
  };
  const deliveryPointsRepo = buildDeliveryPointsRepo(overrides?.deliveryPoints ?? []);
  const auditLogRepo = {
    create: vi.fn((partial: object) => partial),
    save: vi.fn((entity: object) => Promise.resolve({ id: '1', ...entity })),
    ...overrides?.auditLog,
  };
  const pushSubscriptionsRepo = {
    find: vi.fn().mockResolvedValue([]),
    ...overrides?.pushSubscriptions,
  };
  const pushProvider = {
    send: vi.fn().mockResolvedValue(undefined),
    ...overrides?.pushProvider,
  };
  const statusHistoryRepo = {
    create: vi.fn((partial: object) => partial),
    save: vi.fn((entity: object) => Promise.resolve({ id: '1', ...entity })),
  };
  const dataSource = {
    transaction: vi.fn((cb: (manager: unknown) => Promise<unknown>) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === PickupRequest) return pickupRequestsRepo;
          if (entity === PickupRequestStatusHistory) return statusHistoryRepo;
          throw new Error('Unexpected entity in test dataSource.transaction');
        },
      }),
    ),
    ...overrides?.dataSource,
  };
  const mqttClient = {
    publish: vi.fn().mockResolvedValue(undefined),
    ...overrides?.mqttClient,
  };
  const deliveryPointAccess = {
    checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'granted', institutionId: 'inst-1' }),
    ...overrides?.deliveryPointAccess,
  };
  const institutionAccess = {
    checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'granted' }),
    ...overrides?.institutionAccess,
  };
  const service = new PickupsService(
    pickupRequestsRepo as never,
    enrollmentsRepo as never,
    studentGuardiansRepo as never,
    institutionMembersRepo as never,
    vehiclesRepo as never,
    deliveryPointsRepo as never,
    auditLogRepo as never,
    pushSubscriptionsRepo as never,
    dataSource as never,
    mqttClient as never,
    pushProvider as never,
    deliveryPointAccess as never,
    institutionAccess as never,
  );
  return {
    service,
    pickupRequestsRepo,
    enrollmentsRepo,
    studentGuardiansRepo,
    institutionMembersRepo,
    vehiclesRepo,
    deliveryPointsRepo,
    auditLogRepo,
    statusHistoryRepo,
    pushSubscriptionsRepo,
    pushProvider,
    dataSource,
    mqttClient,
    deliveryPointAccess,
    institutionAccess,
  };
}

describe('PickupsService', () => {
  describe('create', () => {
    it('creates an en_route pickup request with a catalog vehicle and a resolved delivery point', async () => {
      const vehicle = {
        id: 'veh-1',
        guardian: { id: 'user-1' },
        description: 'Honda CRV gris',
        plate: 'ABC-123',
      } as Vehicle;
      const { service, mqttClient } = buildService({
        vehicles: { findOne: vi.fn().mockResolvedValue(vehicle) },
        deliveryPoints: [
          {
            id: 'dp-1',
            institutionId: 'inst-1',
            status: 'active',
            groupIds: ['group-3b'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ groupId: 'group-3b' })),
        },
      });

      const result = await service.create('user-1', {
        enrollmentId: 'enr-1',
        vehicleId: 'veh-1',
      });

      expect(result.status).toBe('en_route');
      expect(result.deliveryPointId).toBe('dp-1');
      expect(result.vehicleDescription).toBe('Honda CRV gris');
      expect(result.vehiclePlate).toBe('ABC-123');
      expect(mqttClient.publish).toHaveBeenCalledTimes(3);
      expect(mqttClient.publish).toHaveBeenNthCalledWith(
        1,
        'school-pickup/institution/inst-1/board',
        expect.any(Object),
        1,
      );
      expect(mqttClient.publish).toHaveBeenNthCalledWith(
        2,
        'school-pickup/institution/inst-1/delivery-point/dp-1/queue',
        expect.any(Object),
        1,
      );
      expect(mqttClient.publish).toHaveBeenNthCalledWith(
        3,
        'school-pickup/institution/inst-1/board-monitor',
        expect.any(Object),
        1,
      );
    });

    it('publishes the exact board and queue payload shape (extracted via buildBoardPayload/buildQueuePayload)', async () => {
      const vehicle = {
        id: 'veh-1',
        guardian: { id: 'user-1' },
        description: 'Honda CRV gris',
        plate: 'ABC-123',
      } as Vehicle;
      const { service, mqttClient } = buildService({
        vehicles: { findOne: vi.fn().mockResolvedValue(vehicle) },
        deliveryPoints: [
          {
            id: 'dp-1',
            institutionId: 'inst-1',
            status: 'active',
            groupIds: ['group-3b'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
        enrollments: {
          findOne: vi
            .fn()
            .mockResolvedValue(
              buildEnrollment({ groupId: 'group-3b', group: { name: '3°B' } as InstitutionGroup }),
            ),
        },
      });

      await service.create('user-1', { enrollmentId: 'enr-1', vehicleId: 'veh-1' });

      expect(mqttClient.publish).toHaveBeenNthCalledWith(
        1,
        'school-pickup/institution/inst-1/board',
        {
          kind: 'row',
          pickupRequestId: 'pr-1',
          status: 'en_route',
          studentFullName: 'Ana Pérez',
          gradeOrGroup: '3°B',
          deliveryPointId: 'dp-1',
          estimatedArrivalAt: null,
          etaSeconds: null,
          arrivalMode: null,
          updatedAt: '2026-07-16T08:00:00.000Z',
        },
        1,
      );
      // The queue payload is asserted off the recorded call rather than with
      // toHaveBeenNthCalledWith, because deliveryCode is generated on create:
      // only its shape is knowable here. The toEqual below still pins the exact
      // key set — an extra field would fail it. Note the board assertion above
      // carries no deliveryCode at all: that asymmetry is ADR-051 pt.2.
      const publishMock = mqttClient.publish as ReturnType<typeof vi.fn>;
      const [queueTopic, queuePayload, queueQos] = publishMock.mock.calls[1] as [
        string,
        Record<string, unknown>,
        number,
      ];

      expect(queueTopic).toBe('school-pickup/institution/inst-1/delivery-point/dp-1/queue');
      expect(queueQos).toBe(1);
      expect(queuePayload.deliveryCode).toMatch(/^\d{4}$/);
      expect(queuePayload).toEqual({
        pickupRequestId: 'pr-1',
        status: 'en_route',
        studentFullName: 'Ana Pérez',
        gradeOrGroup: '3°B',
        vehicleDescription: 'Honda CRV gris',
        vehiclePlate: 'ABC-123',
        deliveryCode: queuePayload.deliveryCode,
        estimatedArrivalAt: null,
        etaSeconds: null,
        // Enmienda a ADR-073: resolveGuardianRelationship's own fallback for a
        // fixture with no matching student_guardians link — untouched by this
        // amendment, buildQueuePayload just started copying it through too.
        guardianFullName: '',
        guardianRelationship: 'other',
        updatedAt: '2026-07-16T08:00:00.000Z',
      });

      // ADR-071 pt.2: the board-monitor payload never carries deliveryCode
      // either, unlike the queue payload above.
      const [monitorTopic, monitorPayload] = publishMock.mock.calls[2] as [
        string,
        Record<string, unknown>,
        number,
      ];
      expect(monitorTopic).toBe('school-pickup/institution/inst-1/board-monitor');
      expect(monitorPayload).not.toHaveProperty('deliveryCode');
      expect(monitorPayload).toMatchObject({
        pickupRequestId: 'pr-1',
        status: 'en_route',
        vehicleDescription: 'Honda CRV gris',
        vehiclePlate: 'ABC-123',
      });
    });

    it('does not assign an inactive delivery point even when it matches the group', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ groupId: 'group-3b' })),
        },
        deliveryPoints: [
          {
            id: 'dp-inactive',
            institutionId: 'inst-1',
            status: 'inactive',
            groupIds: ['group-3b'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });

      const result = await service.create('user-1', { enrollmentId: 'enr-1' });

      expect(result.deliveryPointId).toBeNull();
    });

    it('assigns the active point when an inactive point also matches the same group', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ groupId: 'group-3b' })),
        },
        deliveryPoints: [
          {
            id: 'dp-inactive',
            institutionId: 'inst-1',
            status: 'inactive',
            groupIds: ['group-3b'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          {
            id: 'dp-active',
            institutionId: 'inst-1',
            status: 'active',
            groupIds: ['group-3b'],
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
          },
        ],
      });

      const result = await service.create('user-1', { enrollmentId: 'enr-1' });

      expect(result.deliveryPointId).toBe('dp-active');
    });

    it('breaks ties between two active points matching the same group by oldest created_at', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ groupId: 'group-3b' })),
        },
        deliveryPoints: [
          {
            id: 'dp-newer',
            institutionId: 'inst-1',
            status: 'active',
            groupIds: ['group-3b'],
            createdAt: new Date('2026-02-01T00:00:00.000Z'),
          },
          {
            id: 'dp-older',
            institutionId: 'inst-1',
            status: 'active',
            groupIds: ['group-3b'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });

      const result = await service.create('user-1', { enrollmentId: 'enr-1' });

      expect(result.deliveryPointId).toBe('dp-older');
    });

    // ADR-083: a group that no active point covers (typo, or the point was
    // reconfigured to stop covering it) falls back to the catch-all instead
    // of leaving delivery_point_id null.
    it('falls back to the catch-all point when the group matches no active point (ADR-083)', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ groupId: 'group-huerfano' })),
        },
        deliveryPoints: [
          {
            id: 'dp-grouped',
            institutionId: 'inst-1',
            status: 'active',
            groupIds: ['group-3b'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          {
            id: 'dp-catch-all',
            institutionId: 'inst-1',
            status: 'active',
            groupIds: [],
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
          },
        ],
      });

      const result = await service.create('user-1', { enrollmentId: 'enr-1' });

      expect(result.deliveryPointId).toBe('dp-catch-all');
    });

    // ADR-083: an ungrouped student (institutions without real groups, e.g.
    // a single-point taekwondo school) is exactly the catch-all's purpose.
    it('falls back to the catch-all point when the student has no group at all (ADR-083)', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ groupId: null })),
        },
        deliveryPoints: [
          {
            id: 'dp-catch-all',
            institutionId: 'inst-1',
            status: 'active',
            groupIds: [],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });

      const result = await service.create('user-1', { enrollmentId: 'enr-1' });

      expect(result.deliveryPointId).toBe('dp-catch-all');
    });

    it('creates a walking pickup request with no delivery point when the institution has none configured', async () => {
      const { service, mqttClient } = buildService();

      const result = await service.create('user-1', {
        enrollmentId: 'enr-1',
        arrivalMode: 'walking',
      });

      expect(result.status).toBe('en_route');
      expect(result.deliveryPointId).toBeNull();
      expect(result.vehicleDescription).toBeNull();
      expect(result.vehiclePlate).toBeNull();
      // Board + board-monitor, no queue publish: no delivery_point_id.
      expect(mqttClient.publish).toHaveBeenCalledTimes(2);
    });

    it('creates a pickup request with a free-capture vehicle (no vehicleId)', async () => {
      const { service } = buildService();

      const result = await service.create('user-1', {
        enrollmentId: 'enr-1',
        vehicleDescription: 'Camioneta prestada blanca',
        vehiclePlate: 'XYZ-999',
      });

      expect(result.vehicleDescription).toBe('Camioneta prestada blanca');
      expect(result.vehiclePlate).toBe('XYZ-999');
    });

    it('rejects when the authenticated user has no student_guardian link at all', async () => {
      const { service } = buildService({
        studentGuardians: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.create('user-2', { enrollmentId: 'enr-1' })).rejects.toMatchObject({
        response: { code: 'NOT_STUDENT_GUARDIAN' },
      });
    });

    it('rejects when the student_guardian link exists but is not active', async () => {
      const { service } = buildService({
        studentGuardians: { findOne: vi.fn().mockResolvedValue({ status: 'invited' }) },
      });

      await expect(service.create('user-2', { enrollmentId: 'enr-1' })).rejects.toMatchObject({
        response: { code: 'GUARDIAN_NOT_ACTIVE' },
      });
    });

    it('rejects when the enrollment is not approved', async () => {
      const { service } = buildService({
        enrollments: { findOne: vi.fn().mockResolvedValue(buildEnrollment({ status: 'pending' })) },
      });

      await expect(service.create('user-1', { enrollmentId: 'enr-1' })).rejects.toMatchObject({
        response: { code: 'ENROLLMENT_NOT_APPROVED' },
      });
    });

    it('rejects when the institution is suspended even though the enrollment is approved (ADR-032)', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(
            buildEnrollment({
              institution: { id: 'inst-1', status: 'suspended' } as Institution,
            }),
          ),
        },
      });

      await expect(service.create('user-1', { enrollmentId: 'enr-1' })).rejects.toMatchObject({
        response: { code: 'INSTITUTION_NOT_APPROVED' },
      });
    });

    it('rejects when an active pickup request already exists for the enrollment (pre-check)', async () => {
      const { service } = buildService({
        pickupRequests: { exists: vi.fn().mockResolvedValue(true) },
      });

      await expect(service.create('user-1', { enrollmentId: 'enr-1' })).rejects.toMatchObject({
        response: { code: 'ACTIVE_PICKUP_REQUEST_EXISTS' },
      });
    });

    it('translates a race-condition unique violation on the active-per-enrollment index into ACTIVE_PICKUP_REQUEST_EXISTS', async () => {
      const { service } = buildService({
        pickupRequests: {
          exists: vi.fn().mockResolvedValue(false),
          save: vi.fn().mockRejectedValue(
            Object.assign(new Error('duplicate key value violates unique constraint'), {
              code: '23505',
              constraint: 'IDX_pickup_requests_active_per_enrollment',
            }),
          ),
        },
      });

      await expect(service.create('user-1', { enrollmentId: 'enr-1' })).rejects.toMatchObject({
        response: { code: 'ACTIVE_PICKUP_REQUEST_EXISTS' },
      });
    });

    it('rejects when vehicleId does not exist', async () => {
      const { service } = buildService({
        vehicles: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.create('user-1', { enrollmentId: 'enr-1', vehicleId: 'missing-veh' }),
      ).rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
    });

    it('rejects when vehicleId belongs to another guardian', async () => {
      const { service } = buildService({
        vehicles: {
          findOne: vi.fn().mockResolvedValue({
            id: 'veh-1',
            guardian: { id: 'other-user' },
            description: 'x',
            plate: 'y',
          }),
        },
      });

      await expect(
        service.create('user-1', { enrollmentId: 'enr-1', vehicleId: 'veh-1' }),
      ).rejects.toMatchObject({ response: { code: 'NOT_VEHICLE_OWNER' } });
    });

    it('retries with a new delivery_code when the first candidate collides, then succeeds', async () => {
      let saveAttempts = 0;
      const { service } = buildService({
        pickupRequests: {
          save: vi.fn((entity: Partial<PickupRequest>) => {
            saveAttempts += 1;
            if (saveAttempts === 1) {
              return Promise.reject(
                Object.assign(new Error('duplicate key value violates unique constraint'), {
                  code: '23505',
                  constraint: 'IDX_pickup_requests_active_delivery_code_per_institution',
                }),
              );
            }
            return Promise.resolve(buildPickupRequest(entity));
          }),
        },
      });

      const result = await service.create('user-1', { enrollmentId: 'enr-1' });

      expect(saveAttempts).toBe(2);
      expect(result.status).toBe('en_route');
    });

    it('does not roll back or fail the request when MQTT publish fails', async () => {
      const { service, mqttClient } = buildService({
        mqttClient: { publish: vi.fn().mockRejectedValue(new Error('broker unreachable')) },
      });

      const result = await service.create('user-1', { enrollmentId: 'enr-1' });

      expect(result.status).toBe('en_route');
      expect(mqttClient.publish).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns the full detail when the caller is a guardian of the student', async () => {
      const { service, institutionMembersRepo } = buildService({
        studentGuardians: { exists: vi.fn().mockResolvedValue(true) },
        institutionMembers: { exists: vi.fn().mockResolvedValue(false) },
      });

      const result = await service.findById('user-1', 'pr-1');

      expect(result.id).toBe('pr-1');
      expect(institutionMembersRepo.exists).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { institution: { id: 'inst-1' }, user: { id: 'user-1' } },
        }),
      );
    });

    it('returns the full detail when the caller is an institution_member, any role', async () => {
      const { service } = buildService({
        studentGuardians: { exists: vi.fn().mockResolvedValue(false) },
        institutionMembers: { exists: vi.fn().mockResolvedValue(true) },
      });

      const result = await service.findById('user-1', 'pr-1');

      expect(result.id).toBe('pr-1');
    });

    it('rejects with 403 NOT_INSTITUTION_MEMBER when the caller is neither', async () => {
      const { service } = buildService({
        studentGuardians: { exists: vi.fn().mockResolvedValue(false) },
        institutionMembers: { exists: vi.fn().mockResolvedValue(false) },
      });

      await expect(service.findById('user-1', 'pr-1')).rejects.toMatchObject({
        response: { code: 'NOT_INSTITUTION_MEMBER' },
      });
    });

    it('rejects with 404 before evaluating the OR when the pickup_request does not exist', async () => {
      const { service, studentGuardiansRepo, institutionMembersRepo } = buildService({
        pickupRequests: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.findById('user-1', 'missing')).rejects.toMatchObject({
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
      expect(studentGuardiansRepo.exists).not.toHaveBeenCalled();
      expect(institutionMembersRepo.exists).not.toHaveBeenCalled();
    });

    it('returns the exact detail shape, including deliveryCode/estimatedArrivalAt/etaSeconds/completedAt', async () => {
      const { service } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(
            buildOwnedPickupRequest({
              status: 'arriving',
              estimatedArrivalAt: new Date('2026-07-16T08:10:00.000Z'),
              etaSeconds: 300,
              completedAt: null,
            }),
          ),
        },
      });

      const result = await service.findById('user-1', 'pr-1');

      expect(result).toEqual({
        id: 'pr-1',
        enrollmentId: 'enr-1',
        institutionId: 'inst-1',
        institutionLocation: { lat: 19.4326, lng: -99.1332 },
        guardianUserId: 'user-1',
        deliveryPointId: null,
        status: 'arriving',
        deliveryCode: '1234',
        arrivalMode: null,
        vehicleDescription: null,
        vehiclePlate: null,
        estimatedArrivalAt: '2026-07-16T08:10:00.000Z',
        etaSeconds: 300,
        startedAt: '2026-07-16T08:00:00.000Z',
        completedAt: null,
      });
    });
  });

  describe('listByEnrollment', () => {
    it('returns a page of summaries when the caller is a guardian of the student', async () => {
      const { service } = buildService({
        studentGuardians: { exists: vi.fn().mockResolvedValue(true) },
        institutionMembers: { exists: vi.fn().mockResolvedValue(false) },
        pickupRequests: {
          findAndCount: vi.fn().mockResolvedValue([[buildOwnedPickupRequest()], 1]),
        },
      });

      const result = await service.listByEnrollment('user-1', { enrollmentId: 'enr-1' });

      expect(result).toEqual({
        pickupRequests: [
          {
            id: 'pr-1',
            status: 'en_route',
            startedAt: '2026-07-16T08:00:00.000Z',
            completedAt: null,
            deliveryPointId: null,
          },
        ],
        limit: 20,
        offset: 0,
        total: 1,
      });
    });

    it('returns a page of summaries when the caller is an institution_member, any role', async () => {
      const { service } = buildService({
        studentGuardians: { exists: vi.fn().mockResolvedValue(false) },
        institutionMembers: { exists: vi.fn().mockResolvedValue(true) },
        pickupRequests: {
          findAndCount: vi.fn().mockResolvedValue([[buildOwnedPickupRequest()], 1]),
        },
      });

      const result = await service.listByEnrollment('user-1', { enrollmentId: 'enr-1' });

      expect(result.pickupRequests).toHaveLength(1);
    });

    it('rejects with 403 NOT_INSTITUTION_MEMBER when the caller is neither', async () => {
      const { service } = buildService({
        studentGuardians: { exists: vi.fn().mockResolvedValue(false) },
        institutionMembers: { exists: vi.fn().mockResolvedValue(false) },
      });

      await expect(
        service.listByEnrollment('user-1', { enrollmentId: 'enr-1' }),
      ).rejects.toMatchObject({ response: { code: 'NOT_INSTITUTION_MEMBER' } });
    });

    it('rejects with 404 before evaluating the OR when the enrollment does not exist', async () => {
      const { service, studentGuardiansRepo, institutionMembersRepo } = buildService({
        enrollments: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.listByEnrollment('user-1', { enrollmentId: 'missing' }),
      ).rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
      expect(studentGuardiansRepo.exists).not.toHaveBeenCalled();
      expect(institutionMembersRepo.exists).not.toHaveBeenCalled();
    });

    it('applies limit/offset paging and filters by status, ordered by created_at DESC', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[buildOwnedPickupRequest()], 45]);
      const { service } = buildService({
        pickupRequests: { findAndCount },
      });

      const result = await service.listByEnrollment('user-1', {
        enrollmentId: 'enr-1',
        status: 'delivered',
        limit: 10,
        offset: 20,
      });

      expect(findAndCount).toHaveBeenCalledWith({
        where: { enrollment: { id: 'enr-1' }, status: 'delivered' },
        relations: { deliveryPoint: true },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 20,
      });
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
      expect(result.total).toBe(45);
    });

    it('defaults to limit 20 and offset 0 when not provided', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[], 0]);
      const { service } = buildService({
        pickupRequests: { findAndCount },
      });

      await service.listByEnrollment('user-1', { enrollmentId: 'enr-1' });

      expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 20, skip: 0 }));
    });

    it('returns summaries without deliveryCode/guardianUserId/ETA fields', async () => {
      const { service } = buildService({
        pickupRequests: {
          findAndCount: vi.fn().mockResolvedValue([
            [
              buildOwnedPickupRequest({
                deliveryCode: '9999',
                estimatedArrivalAt: new Date('2026-07-16T08:10:00.000Z'),
                etaSeconds: 300,
              }),
            ],
            1,
          ]),
        },
      });

      const result = await service.listByEnrollment('user-1', { enrollmentId: 'enr-1' });

      expect(Object.keys(result.pickupRequests[0]).sort()).toEqual(
        ['id', 'status', 'startedAt', 'completedAt', 'deliveryPointId'].sort(),
      );
    });
  });

  describe('listByDeliveryPoint', () => {
    const DP_ID = 'dp-1';

    it('returns the active queue of the delivery point for an institution_member', async () => {
      const { service } = buildService({
        pickupRequests: {
          findAndCount: vi.fn().mockResolvedValue([
            [
              buildOwnedPickupRequest({
                status: 'arrived',
                deliveryPoint: { id: DP_ID } as DeliveryPoint,
                deliveryCode: '4821',
                vehicleDescription: 'Honda CRV gris',
                vehiclePlate: 'ABC-123',
              }),
            ],
            1,
          ]),
        },
      });

      const result = await service.listByDeliveryPoint('user-1', { deliveryPointId: DP_ID });

      expect(result.pickupRequests).toEqual([
        {
          pickupRequestId: 'pr-1',
          status: 'arrived',
          studentFullName: 'Ana Pérez',
          gradeOrGroup: '3°B',
          vehicleDescription: 'Honda CRV gris',
          vehiclePlate: 'ABC-123',
          deliveryCode: '4821',
          estimatedArrivalAt: null,
          etaSeconds: null,
          // Enmienda a ADR-073: buildOwnedPickupRequest's `guardian` and the
          // default studentGuardiansRepo mock carry neither a fullName nor a
          // relationship, so resolveGuardianRelationship falls back to its
          // own defaults — same fallback exercised in the `create` tests.
          guardianFullName: '',
          guardianRelationship: 'other',
          updatedAt: '2026-07-16T08:00:00.000Z',
        },
      ]);
      expect(result).toMatchObject({ limit: 20, offset: 0, total: 1 });
    });

    // ADR-051 pt.3: the shape exists so the console can merge snapshot and
    // deltas untouched. If the two drift apart, that stops being true.
    it('returns rows shaped exactly like the WebSocket delta payload', async () => {
      const pickupRequest = buildOwnedPickupRequest({
        status: 'arrived',
        deliveryCode: '4821',
        vehicleDescription: 'Honda CRV gris',
        vehiclePlate: 'ABC-123',
      });
      const { service } = buildService({
        pickupRequests: { findAndCount: vi.fn().mockResolvedValue([[pickupRequest], 1]) },
      });

      const result = await service.listByDeliveryPoint('user-1', { deliveryPointId: DP_ID });

      const queuePayload = buildQueuePayload({
        pickupRequestId: pickupRequest.id,
        status: pickupRequest.status,
        studentFullName: pickupRequest.enrollment.student.fullName,
        gradeOrGroup: pickupRequest.enrollment.group?.name ?? null,
        deliveryPointId: DP_ID,
        estimatedArrivalAt: null,
        etaSeconds: null,
        arrivalMode: pickupRequest.arrivalMode,
        vehicleDescription: pickupRequest.vehicleDescription,
        vehiclePlate: pickupRequest.vehiclePlate,
        deliveryCode: pickupRequest.deliveryCode,
        // Same resolveGuardianRelationship fallback as the previous test.
        guardianFullName: '',
        guardianRelationship: 'other',
        updatedAt: pickupRequest.updatedAt.toISOString(),
      });

      expect(result.pickupRequests[0]).toEqual(queuePayload);
    });

    it('never returns the generic summary shape (no id, no deliveryPointId)', async () => {
      const { service } = buildService({
        pickupRequests: {
          findAndCount: vi.fn().mockResolvedValue([[buildOwnedPickupRequest()], 1]),
        },
      });

      const result = await service.listByDeliveryPoint('user-1', { deliveryPointId: DP_ID });

      expect(result.pickupRequests[0]).not.toHaveProperty('id');
      expect(result.pickupRequests[0]).not.toHaveProperty('deliveryPointId');
    });

    it('filters to active statuses only, never history', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[], 0]);
      const { service } = buildService({ pickupRequests: { findAndCount } });

      await service.listByDeliveryPoint('user-1', { deliveryPointId: DP_ID });

      expect(findAndCount).toHaveBeenCalledWith({
        where: {
          deliveryPoint: { id: DP_ID },
          status: In(['en_route', 'arriving', 'arrived']),
        },
        relations: { enrollment: { student: true, group: true }, guardian: true },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('narrows within the active set when status is given', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[], 0]);
      const { service } = buildService({ pickupRequests: { findAndCount } });

      await service.listByDeliveryPoint('user-1', { deliveryPointId: DP_ID, status: 'arrived' });

      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deliveryPoint: { id: DP_ID }, status: In(['arrived']) },
        }),
      );
    });

    // A terminal status cannot widen the queue back into history: it
    // intersects to nothing, which is an empty page, not an error.
    it('intersects to nothing when status is terminal', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[], 0]);
      const { service } = buildService({ pickupRequests: { findAndCount } });

      await service.listByDeliveryPoint('user-1', { deliveryPointId: DP_ID, status: 'delivered' });

      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deliveryPoint: { id: DP_ID }, status: In([]) },
        }),
      );
    });

    it('applies limit/offset paging', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[], 12]);
      const { service } = buildService({ pickupRequests: { findAndCount } });

      const result = await service.listByDeliveryPoint('user-1', {
        deliveryPointId: DP_ID,
        limit: 5,
        offset: 10,
      });

      expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 5, skip: 10 }));
      expect(result).toMatchObject({ limit: 5, offset: 10, total: 12 });
    });

    it('rejects with 404 RESOURCE_NOT_FOUND when the delivery point does not exist', async () => {
      const { service, pickupRequestsRepo } = buildService({
        deliveryPointAccess: {
          checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_found' }),
        },
      });

      await expect(
        service.listByDeliveryPoint('user-1', { deliveryPointId: 'missing' }),
      ).rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
      expect(pickupRequestsRepo.findAndCount).not.toHaveBeenCalled();
    });

    // No guardian side of the OR here (ADR-050 pt.6): a guardian of a student
    // in this queue still has no business reading the gate's whole queue.
    it('rejects with 403 NOT_INSTITUTION_MEMBER for a non-member, guardian or not', async () => {
      const { service, studentGuardiansRepo } = buildService({
        studentGuardians: { exists: vi.fn().mockResolvedValue(true) },
        deliveryPointAccess: {
          checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_member' }),
        },
      });

      await expect(
        service.listByDeliveryPoint('user-1', { deliveryPointId: DP_ID }),
      ).rejects.toMatchObject({ response: { code: 'NOT_INSTITUTION_MEMBER' } });
      expect(studentGuardiansRepo.exists).not.toHaveBeenCalled();
    });
  });

  describe('listByInstitution', () => {
    const INST_ID = 'inst-1';

    it('returns the active board feed of the institution for an institution_member', async () => {
      const { service } = buildService({
        pickupRequests: {
          findAndCount: vi.fn().mockResolvedValue([
            [
              buildOwnedPickupRequest({
                status: 'arriving',
                deliveryPoint: { id: 'dp-1' } as DeliveryPoint,
                arrivalMode: 'vehicle',
              }),
            ],
            1,
          ]),
        },
      });

      const result = await service.listByInstitution('user-1', { institutionId: INST_ID });

      expect(result.pickupRequests).toEqual([
        {
          pickupRequestId: 'pr-1',
          status: 'arriving',
          studentFullName: 'Ana Pérez',
          gradeOrGroup: '3°B',
          deliveryPointId: 'dp-1',
          estimatedArrivalAt: null,
          etaSeconds: null,
          arrivalMode: 'vehicle',
          updatedAt: '2026-07-16T08:00:00.000Z',
        },
      ]);
      expect(result).toMatchObject({ limit: 20, offset: 0, total: 1 });
    });

    it('never includes deliveryCode (ADR-051, ADR-068 pt.3)', async () => {
      const { service } = buildService({
        pickupRequests: {
          findAndCount: vi.fn().mockResolvedValue([[buildOwnedPickupRequest()], 1]),
        },
      });

      const result = await service.listByInstitution('user-1', { institutionId: INST_ID });

      expect(result.pickupRequests[0]).not.toHaveProperty('deliveryCode');
    });

    // ADR-068 pt.3: the shape exists so apps/board can merge snapshot and
    // deltas untouched. If the two drift apart, that stops being true.
    // `kind` (ADR-073 pt.3) is excluded from this comparison on purpose: it's
    // a wire-protocol discriminator for the two message shapes multiplexed
    // over `/ws/board`, not domain data — a REST response is never
    // ambiguous about its own shape, so PickupRequestBoardSummary never
    // carries it.
    it('returns rows shaped exactly like the WebSocket delta payload', async () => {
      const pickupRequest = buildOwnedPickupRequest({
        status: 'arriving',
        deliveryPoint: { id: 'dp-1' } as DeliveryPoint,
        arrivalMode: 'vehicle',
      });
      const { service } = buildService({
        pickupRequests: { findAndCount: vi.fn().mockResolvedValue([[pickupRequest], 1]) },
      });

      const result = await service.listByInstitution('user-1', { institutionId: INST_ID });

      const { kind, ...boardPayload } = buildBoardPayload({
        pickupRequestId: pickupRequest.id,
        status: pickupRequest.status,
        studentFullName: pickupRequest.enrollment.student.fullName,
        gradeOrGroup: pickupRequest.enrollment.group?.name ?? null,
        deliveryPointId: 'dp-1',
        estimatedArrivalAt: null,
        etaSeconds: null,
        arrivalMode: pickupRequest.arrivalMode,
        vehicleDescription: pickupRequest.vehicleDescription,
        vehiclePlate: pickupRequest.vehiclePlate,
        deliveryCode: pickupRequest.deliveryCode,
        updatedAt: pickupRequest.updatedAt.toISOString(),
      });

      expect(kind).toBe('row');
      expect(result.pickupRequests[0]).toEqual(boardPayload);
    });

    it('never returns the generic summary shape (no id)', async () => {
      const { service } = buildService({
        pickupRequests: {
          findAndCount: vi.fn().mockResolvedValue([[buildOwnedPickupRequest()], 1]),
        },
      });

      const result = await service.listByInstitution('user-1', { institutionId: INST_ID });

      expect(result.pickupRequests[0]).not.toHaveProperty('id');
    });

    it('filters to active statuses only, never history', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[], 0]);
      const { service } = buildService({ pickupRequests: { findAndCount } });

      await service.listByInstitution('user-1', { institutionId: INST_ID });

      expect(findAndCount).toHaveBeenCalledWith({
        where: {
          institution: { id: INST_ID },
          status: In(['en_route', 'arriving', 'arrived']),
        },
        relations: { enrollment: { student: true, group: true }, deliveryPoint: true },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('narrows within the active set when status is given', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[], 0]);
      const { service } = buildService({ pickupRequests: { findAndCount } });

      await service.listByInstitution('user-1', { institutionId: INST_ID, status: 'arrived' });

      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { institution: { id: INST_ID }, status: In(['arrived']) },
        }),
      );
    });

    // A terminal status cannot widen the feed back into history: it
    // intersects to nothing, which is an empty page, not an error.
    it('intersects to nothing when status is terminal', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[], 0]);
      const { service } = buildService({ pickupRequests: { findAndCount } });

      await service.listByInstitution('user-1', { institutionId: INST_ID, status: 'delivered' });

      expect(findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { institution: { id: INST_ID }, status: In([]) },
        }),
      );
    });

    it('applies limit/offset paging', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[], 12]);
      const { service } = buildService({ pickupRequests: { findAndCount } });

      const result = await service.listByInstitution('user-1', {
        institutionId: INST_ID,
        limit: 5,
        offset: 10,
      });

      expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 5, skip: 10 }));
      expect(result).toMatchObject({ limit: 5, offset: 10, total: 12 });
    });

    it('rejects with 404 RESOURCE_NOT_FOUND when the institution does not exist', async () => {
      const { service, pickupRequestsRepo } = buildService({
        institutionAccess: {
          checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_found' }),
        },
      });

      await expect(
        service.listByInstitution('user-1', { institutionId: 'missing' }),
      ).rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
      expect(pickupRequestsRepo.findAndCount).not.toHaveBeenCalled();
    });

    // No guardian side of the OR here (ADR-068 pt.2): a guardian of a
    // student at this institution still has no business reading the whole
    // board feed unless they are also an institution_member.
    it('rejects with 403 NOT_INSTITUTION_MEMBER for a non-member, guardian or not', async () => {
      const { service, studentGuardiansRepo } = buildService({
        studentGuardians: { exists: vi.fn().mockResolvedValue(true) },
        institutionAccess: {
          checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_member' }),
        },
      });

      await expect(
        service.listByInstitution('user-1', { institutionId: INST_ID }),
      ).rejects.toMatchObject({ response: { code: 'NOT_INSTITUTION_MEMBER' } });
      expect(studentGuardiansRepo.exists).not.toHaveBeenCalled();
    });
  });

  // Carril, the staff monitor mode of the board (ADR-071 pt.2): same rows as
  // listByInstitution plus guardian/vehicle data.
  describe('listByInstitutionMonitor', () => {
    const INST_ID = 'inst-1';

    function buildMonitorPickupRequest(overrides?: Partial<PickupRequest>): PickupRequest {
      return buildOwnedPickupRequest({
        status: 'arriving',
        deliveryPoint: { id: 'dp-1' } as DeliveryPoint,
        arrivalMode: 'vehicle',
        guardian: { id: 'user-1', fullName: 'Sofía Ramírez' },
        vehicleDescription: 'Honda CRV gris',
        vehiclePlate: 'ABC-123',
        ...overrides,
      });
    }

    it('returns the active monitor feed of the institution, including guardian/vehicle data', async () => {
      const { service, studentGuardiansRepo } = buildService({
        pickupRequests: {
          findAndCount: vi.fn().mockResolvedValue([[buildMonitorPickupRequest()], 1]),
        },
        studentGuardians: {
          findOne: vi.fn().mockResolvedValue({
            relationship: 'mother',
            guardian: { id: 'user-1', fullName: 'Sofía Ramírez' },
          }),
        },
      });

      const result = await service.listByInstitutionMonitor('user-1', { institutionId: INST_ID });

      expect(result.pickupRequests).toEqual([
        {
          pickupRequestId: 'pr-1',
          status: 'arriving',
          studentFullName: 'Ana Pérez',
          gradeOrGroup: '3°B',
          deliveryPointId: 'dp-1',
          estimatedArrivalAt: null,
          etaSeconds: null,
          arrivalMode: 'vehicle',
          guardianFullName: 'Sofía Ramírez',
          guardianRelationship: 'mother',
          vehicleDescription: 'Honda CRV gris',
          vehiclePlate: 'ABC-123',
          updatedAt: '2026-07-16T08:00:00.000Z',
        },
      ]);
      expect(result).toMatchObject({ limit: 20, offset: 0, total: 1 });
      expect(studentGuardiansRepo.findOne).toHaveBeenCalledWith({
        where: { student: { id: 'stu-1' }, guardian: { id: 'user-1' } },
        relations: { guardian: true },
      });
    });

    it('never includes deliveryCode', async () => {
      const { service } = buildService({
        pickupRequests: {
          findAndCount: vi.fn().mockResolvedValue([[buildMonitorPickupRequest()], 1]),
        },
      });

      const result = await service.listByInstitutionMonitor('user-1', { institutionId: INST_ID });

      expect(result.pickupRequests[0]).not.toHaveProperty('deliveryCode');
    });

    // ADR-071 pt.2: the shape exists so Carril can merge snapshot and deltas
    // untouched, same reasoning as listByInstitution vs buildBoardPayload.
    it('returns rows shaped exactly like the WebSocket delta payload', async () => {
      const pickupRequest = buildMonitorPickupRequest();
      const { service } = buildService({
        pickupRequests: { findAndCount: vi.fn().mockResolvedValue([[pickupRequest], 1]) },
        studentGuardians: {
          findOne: vi.fn().mockResolvedValue({
            relationship: 'mother',
            guardian: { id: 'user-1', fullName: 'Sofía Ramírez' },
          }),
        },
      });

      const result = await service.listByInstitutionMonitor('user-1', { institutionId: INST_ID });

      const monitorPayload = buildBoardMonitorPayload({
        pickupRequestId: pickupRequest.id,
        status: pickupRequest.status,
        studentFullName: pickupRequest.enrollment.student.fullName,
        gradeOrGroup: pickupRequest.enrollment.group?.name ?? null,
        deliveryPointId: 'dp-1',
        estimatedArrivalAt: null,
        etaSeconds: null,
        arrivalMode: pickupRequest.arrivalMode,
        guardianFullName: 'Sofía Ramírez',
        guardianRelationship: 'mother',
        vehicleDescription: pickupRequest.vehicleDescription,
        vehiclePlate: pickupRequest.vehiclePlate,
        deliveryCode: pickupRequest.deliveryCode,
        updatedAt: pickupRequest.updatedAt.toISOString(),
      });

      expect(result.pickupRequests[0]).toEqual(monitorPayload);
    });

    // Defensive fallback (ADR-071 pt.2): should never happen in practice — a
    // pickup_request's guardian always has an active link — but a missing
    // student_guardians row must not throw and take down the whole listing.
    it('falls back to relationship "other" when the student_guardians link is not found', async () => {
      const { service } = buildService({
        pickupRequests: {
          findAndCount: vi.fn().mockResolvedValue([[buildMonitorPickupRequest()], 1]),
        },
        studentGuardians: { findOne: vi.fn().mockResolvedValue(null) },
      });

      const result = await service.listByInstitutionMonitor('user-1', { institutionId: INST_ID });

      expect(result.pickupRequests[0].guardianRelationship).toBe('other');
    });

    it('filters to active statuses only, never history, loading the guardian relation', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[], 0]);
      const { service } = buildService({ pickupRequests: { findAndCount } });

      await service.listByInstitutionMonitor('user-1', { institutionId: INST_ID });

      expect(findAndCount).toHaveBeenCalledWith({
        where: {
          institution: { id: INST_ID },
          status: In(['en_route', 'arriving', 'arrived']),
        },
        relations: {
          enrollment: { student: true, group: true },
          deliveryPoint: true,
          guardian: true,
        },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
    });

    it('applies limit/offset paging', async () => {
      const findAndCount = vi.fn().mockResolvedValue([[], 12]);
      const { service } = buildService({ pickupRequests: { findAndCount } });

      const result = await service.listByInstitutionMonitor('user-1', {
        institutionId: INST_ID,
        limit: 5,
        offset: 10,
      });

      expect(findAndCount).toHaveBeenCalledWith(expect.objectContaining({ take: 5, skip: 10 }));
      expect(result).toMatchObject({ limit: 5, offset: 10, total: 12 });
    });

    it('rejects with 404 RESOURCE_NOT_FOUND when the institution does not exist', async () => {
      const { service, pickupRequestsRepo } = buildService({
        institutionAccess: {
          checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_found' }),
        },
      });

      await expect(
        service.listByInstitutionMonitor('user-1', { institutionId: 'missing' }),
      ).rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
      expect(pickupRequestsRepo.findAndCount).not.toHaveBeenCalled();
    });

    it('rejects with 403 NOT_INSTITUTION_MEMBER for a non-member, guardian or not', async () => {
      const { service, studentGuardiansRepo } = buildService({
        studentGuardians: { exists: vi.fn().mockResolvedValue(true) },
        institutionAccess: {
          checkMemberAccess: vi.fn().mockResolvedValue({ outcome: 'not_member' }),
        },
      });

      await expect(
        service.listByInstitutionMonitor('user-1', { institutionId: INST_ID }),
      ).rejects.toMatchObject({ response: { code: 'NOT_INSTITUTION_MEMBER' } });
      expect(studentGuardiansRepo.exists).not.toHaveBeenCalled();
    });
  });

  describe('getDeliveredToday', () => {
    function buildDeliveredTodayQueryBuilder(pickups: PickupRequest[]) {
      const queryBuilder: Record<string, unknown> = {
        getMany: vi.fn().mockResolvedValue(pickups),
      };
      for (const method of ['innerJoinAndSelect', 'leftJoinAndSelect', 'where', 'andWhere']) {
        queryBuilder[method] = vi.fn(() => queryBuilder);
      }
      return queryBuilder;
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('groups delivered pickups by group name, "Sin grupo" for a missing one, sorted es-MX', async () => {
      const pickups = [
        buildPickupRequest({
          enrollment: { group: { name: '5° A' } as InstitutionGroup } as Enrollment,
        }),
        buildPickupRequest({
          enrollment: { group: { name: '3° B' } as InstitutionGroup } as Enrollment,
        }),
        buildPickupRequest({
          enrollment: { group: { name: '3° B' } as InstitutionGroup } as Enrollment,
        }),
        buildPickupRequest({ enrollment: { group: null } as Enrollment }),
      ];
      const queryBuilder = buildDeliveredTodayQueryBuilder(pickups);
      const { service } = buildService({
        pickupRequests: { createQueryBuilder: vi.fn(() => queryBuilder) },
      });

      const result = await service.getDeliveredToday('inst-1');

      expect(result.total).toBe(4);
      expect(result.byGroup).toEqual([
        { label: '3° B', count: 2 },
        { label: '5° A', count: 1 },
        { label: 'Sin grupo', count: 1 },
      ]);
    });

    it('captures asOf before running the query and reuses it as the query upper bound', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-15T20:03:00.000Z'));

      const queryBuilder = buildDeliveredTodayQueryBuilder([]);
      const { service } = buildService({
        pickupRequests: { createQueryBuilder: vi.fn(() => queryBuilder) },
      });

      const result = await service.getDeliveredToday('inst-1');

      expect(result.asOf).toBe('2026-08-15T20:03:00.000Z');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'pickup.completedAt BETWEEN :start AND :end',
        expect.objectContaining({ end: new Date('2026-08-15T20:03:00.000Z') }),
      );
    });

    it('scopes the query to the institution and delivered status', async () => {
      const queryBuilder = buildDeliveredTodayQueryBuilder([]);
      const { service } = buildService({
        pickupRequests: { createQueryBuilder: vi.fn(() => queryBuilder) },
      });

      await service.getDeliveredToday('inst-1');

      expect(queryBuilder.where).toHaveBeenCalledWith('pickup.institution = :institutionId', {
        institutionId: 'inst-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('pickup.status = :status', {
        status: 'delivered',
      });
    });
  });

  describe('arrive', () => {
    it('transitions from en_route to arrived (direct jump, ADR-024 pt.8)', async () => {
      const { service, mqttClient } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'en_route' })),
        },
      });

      const result = await service.arrive('user-1', 'pr-1');

      expect(result).toEqual({ id: 'pr-1', status: 'arrived' });
      expect(mqttClient.publish).toHaveBeenCalledWith(
        'school-pickup/institution/inst-1/board',
        expect.objectContaining({ status: 'arrived' }),
        1,
      );
    });

    it('transitions from arriving to arrived', async () => {
      const { service } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'arriving' })),
        },
      });

      const result = await service.arrive('user-1', 'pr-1');

      expect(result).toEqual({ id: 'pr-1', status: 'arrived' });
    });

    it('records the status history row with the confirming guardian as changed_by', async () => {
      const { service, statusHistoryRepo } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'en_route' })),
        },
      });

      await service.arrive('user-1', 'pr-1');

      expect(statusHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'arrived', changedBy: { id: 'user-1' } }),
      );
    });

    it('rejects when the authenticated user is not the owner', async () => {
      const { service } = buildService({
        pickupRequests: {
          findOne: vi
            .fn()
            .mockResolvedValue(buildOwnedPickupRequest({ guardian: { id: 'other-user' } })),
        },
      });

      await expect(service.arrive('user-1', 'pr-1')).rejects.toMatchObject({
        response: { code: 'NOT_STUDENT_GUARDIAN' },
      });
    });

    it('rejects with 404 when the pickup_request does not exist', async () => {
      const { service } = buildService({
        pickupRequests: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.arrive('user-1', 'missing')).rejects.toMatchObject({
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('rejects with 409 when the pickup_request is already in a terminal status', async () => {
      const { service } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'delivered' })),
        },
      });

      await expect(service.arrive('user-1', 'pr-1')).rejects.toMatchObject({
        response: { code: 'INVALID_STATUS_TRANSITION' },
      });
    });

    it('does not roll back or fail the request when MQTT publish fails', async () => {
      const { service, mqttClient } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'en_route' })),
        },
        mqttClient: { publish: vi.fn().mockRejectedValue(new Error('broker unreachable')) },
      });

      const result = await service.arrive('user-1', 'pr-1');

      expect(result.status).toBe('arrived');
      expect(mqttClient.publish).toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it.each(['en_route', 'arriving', 'arrived'] as const)(
      'transitions from %s to cancelled and sets completed_at',
      async (status) => {
        const { service } = buildService({
          pickupRequests: {
            findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status })),
          },
        });

        const result = await service.cancel('user-1', 'pr-1');

        expect(result.id).toBe('pr-1');
        expect(result.status).toBe('cancelled');
        expect(result.completedAt).toEqual(expect.any(String));
      },
    );

    it('publishes the cancelled status to the board topic (and board-monitor) when there is no delivery point', async () => {
      const { service, mqttClient } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'en_route' })),
        },
      });

      await service.cancel('user-1', 'pr-1');

      expect(mqttClient.publish).toHaveBeenCalledTimes(2);
      expect(mqttClient.publish).toHaveBeenNthCalledWith(
        1,
        'school-pickup/institution/inst-1/board',
        expect.objectContaining({ status: 'cancelled' }),
        1,
      );
      expect(mqttClient.publish).toHaveBeenNthCalledWith(
        2,
        'school-pickup/institution/inst-1/board-monitor',
        expect.objectContaining({ status: 'cancelled' }),
        1,
      );
    });

    it('also publishes to the delivery-point queue when the pickup_request has one', async () => {
      const { service, mqttClient } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(
            buildOwnedPickupRequest({
              status: 'arrived',
              deliveryPoint: { id: 'dp-1' } as never,
            }),
          ),
        },
      });

      await service.cancel('user-1', 'pr-1');

      expect(mqttClient.publish).toHaveBeenCalledTimes(3);
      expect(mqttClient.publish).toHaveBeenNthCalledWith(
        2,
        'school-pickup/institution/inst-1/delivery-point/dp-1/queue',
        expect.objectContaining({ status: 'cancelled' }),
        1,
      );
      expect(mqttClient.publish).toHaveBeenNthCalledWith(
        3,
        'school-pickup/institution/inst-1/board-monitor',
        expect.objectContaining({ status: 'cancelled' }),
        1,
      );
    });

    it('records the status history row with the cancelling guardian as changed_by', async () => {
      const { service, statusHistoryRepo } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'en_route' })),
        },
      });

      await service.cancel('user-1', 'pr-1');

      expect(statusHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled', changedBy: { id: 'user-1' } }),
      );
    });

    it('rejects when the authenticated user is not the owner', async () => {
      const { service } = buildService({
        pickupRequests: {
          findOne: vi
            .fn()
            .mockResolvedValue(buildOwnedPickupRequest({ guardian: { id: 'other-user' } })),
        },
      });

      await expect(service.cancel('user-1', 'pr-1')).rejects.toMatchObject({
        response: { code: 'NOT_STUDENT_GUARDIAN' },
      });
    });

    it('rejects with 404 when the pickup_request does not exist', async () => {
      const { service } = buildService({
        pickupRequests: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.cancel('user-1', 'missing')).rejects.toMatchObject({
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it.each(['delivered', 'cancelled'] as const)(
      'rejects with 409 when the pickup_request is already %s',
      async (status) => {
        const { service } = buildService({
          pickupRequests: {
            findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status })),
          },
        });

        await expect(service.cancel('user-1', 'pr-1')).rejects.toMatchObject({
          response: { code: 'INVALID_STATUS_TRANSITION' },
        });
      },
    );

    it('does not roll back or fail the request when MQTT publish fails', async () => {
      const { service, mqttClient } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'en_route' })),
        },
        mqttClient: { publish: vi.fn().mockRejectedValue(new Error('broker unreachable')) },
      });

      const result = await service.cancel('user-1', 'pr-1');

      expect(result.status).toBe('cancelled');
      expect(mqttClient.publish).toHaveBeenCalled();
    });
  });

  describe('sendLocation', () => {
    const dto = {
      lat: 19.4326,
      lng: -99.1332,
      accuracyMeters: 12.5,
      recordedAt: '2026-07-16T08:05:00.000Z',
    };

    it.each(['en_route', 'arriving', 'arrived'] as const)(
      'republishes to the pickup location topic at QoS 0 while status is %s',
      async (status) => {
        const { service, mqttClient } = buildService({
          pickupRequests: {
            findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status })),
          },
        });

        await service.sendLocation('user-1', 'pr-1', dto);

        expect(mqttClient.publish).toHaveBeenCalledWith(
          'school-pickup/institution/inst-1/pickup/pr-1/location',
          {
            lat: 19.4326,
            lng: -99.1332,
            accuracyMeters: 12.5,
            recordedAt: '2026-07-16T08:05:00.000Z',
          },
          0,
        );
      },
    );

    it('defaults a missing accuracyMeters to null in the republished payload', async () => {
      const { service, mqttClient } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'en_route' })),
        },
      });

      await service.sendLocation('user-1', 'pr-1', {
        lat: 19.4326,
        lng: -99.1332,
        recordedAt: '2026-07-16T08:05:00.000Z',
      });

      expect(mqttClient.publish).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ accuracyMeters: null }),
        0,
      );
    });

    it('rejects when the authenticated user is not the owner', async () => {
      const { service, mqttClient } = buildService({
        pickupRequests: {
          findOne: vi
            .fn()
            .mockResolvedValue(buildOwnedPickupRequest({ guardian: { id: 'other-user' } })),
        },
      });

      await expect(service.sendLocation('user-1', 'pr-1', dto)).rejects.toMatchObject({
        response: { code: 'NOT_STUDENT_GUARDIAN' },
      });
      expect(mqttClient.publish).not.toHaveBeenCalled();
    });

    it('rejects with 404 when the pickup_request does not exist', async () => {
      const { service } = buildService({
        pickupRequests: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.sendLocation('user-1', 'missing', dto)).rejects.toMatchObject({
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it.each(['delivered', 'cancelled'] as const)(
      'rejects with 409 when the pickup_request is already %s, without publishing',
      async (status) => {
        const { service, mqttClient } = buildService({
          pickupRequests: {
            findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status })),
          },
        });

        await expect(service.sendLocation('user-1', 'pr-1', dto)).rejects.toMatchObject({
          response: { code: 'INVALID_STATUS_TRANSITION' },
        });
        expect(mqttClient.publish).not.toHaveBeenCalled();
      },
    );

    it('does not fail the request when MQTT publish fails', async () => {
      const { service, mqttClient } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'en_route' })),
        },
        mqttClient: { publish: vi.fn().mockRejectedValue(new Error('broker unreachable')) },
      });

      await expect(service.sendLocation('user-1', 'pr-1', dto)).resolves.toBeUndefined();
      expect(mqttClient.publish).toHaveBeenCalled();
    });

    it('does not read or write pickup_request status/history rows (no transition)', async () => {
      const { service, pickupRequestsRepo, statusHistoryRepo } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'en_route' })),
        },
      });

      await service.sendLocation('user-1', 'pr-1', dto);

      expect(pickupRequestsRepo.save).not.toHaveBeenCalled();
      expect(statusHistoryRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('deliver', () => {
    it('transitions from arrived to delivered when the delivery code matches', async () => {
      const { service, auditLogRepo } = buildService({
        pickupRequests: {
          findOne: vi
            .fn()
            .mockResolvedValue(
              buildOwnedPickupRequest({ status: 'arrived', deliveryCode: '1234' }),
            ),
        },
      });

      const result = await service.deliver('staff-1', 'pr-1', '1234');

      expect(result.status).toBe('delivered');
      expect(result.completedAt).toEqual(expect.any(String));
      expect(auditLogRepo.save).not.toHaveBeenCalled();
    });

    it('records the status history row with the confirming staff member as changed_by', async () => {
      const { service, statusHistoryRepo } = buildService({
        pickupRequests: {
          findOne: vi
            .fn()
            .mockResolvedValue(
              buildOwnedPickupRequest({ status: 'arrived', deliveryCode: '1234' }),
            ),
        },
      });

      await service.deliver('staff-1', 'pr-1', '1234');

      expect(statusHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'delivered', changedBy: { id: 'staff-1' } }),
      );
    });

    it('publishes the delivered status, reflecting a real ETA already on the pickup_request', async () => {
      const { service, mqttClient } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(
            buildOwnedPickupRequest({
              status: 'arrived',
              deliveryCode: '1234',
              estimatedArrivalAt: new Date('2026-07-16T08:10:00.000Z'),
              etaSeconds: 120,
            }),
          ),
        },
      });

      await service.deliver('staff-1', 'pr-1', '1234');

      expect(mqttClient.publish).toHaveBeenCalledTimes(2);
      expect(mqttClient.publish).toHaveBeenCalledWith(
        'school-pickup/institution/inst-1/board',
        expect.objectContaining({
          status: 'delivered',
          estimatedArrivalAt: '2026-07-16T08:10:00.000Z',
          etaSeconds: 120,
        }),
        1,
      );
    });

    it.each(['en_route', 'arriving', 'delivered', 'cancelled'] as const)(
      'rejects with 409 when the pickup_request is not arrived (status=%s), without even comparing the code',
      async (status) => {
        const { service, auditLogRepo, dataSource } = buildService({
          pickupRequests: {
            findOne: vi
              .fn()
              .mockResolvedValue(buildOwnedPickupRequest({ status, deliveryCode: '1234' })),
          },
        });

        await expect(service.deliver('staff-1', 'pr-1', 'wrong')).rejects.toMatchObject({
          response: { code: 'INVALID_STATUS_TRANSITION' },
        });

        expect(auditLogRepo.save).not.toHaveBeenCalled();
        expect(dataSource.transaction).not.toHaveBeenCalled();
      },
    );

    it('rejects with 401 and writes an audit_log row when the delivery code does not match', async () => {
      const { service, auditLogRepo } = buildService({
        pickupRequests: {
          findOne: vi
            .fn()
            .mockResolvedValue(
              buildOwnedPickupRequest({ status: 'arrived', deliveryCode: '1234' }),
            ),
        },
      });

      await expect(service.deliver('staff-1', 'pr-1', '9999')).rejects.toMatchObject({
        response: { code: 'INVALID_DELIVERY_CODE' },
      });

      expect(auditLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: { id: 'staff-1' },
          action: 'pickup_request.delivery_code_mismatched',
          entityType: 'pickup_request',
          entityId: 'pr-1',
          metadata: null,
        }),
      );
    });

    it('does not transition the pickup_request when the delivery code does not match', async () => {
      const { service, pickupRequestsRepo } = buildService({
        pickupRequests: {
          findOne: vi
            .fn()
            .mockResolvedValue(
              buildOwnedPickupRequest({ status: 'arrived', deliveryCode: '1234' }),
            ),
        },
      });

      await expect(service.deliver('staff-1', 'pr-1', '9999')).rejects.toBeDefined();

      expect(pickupRequestsRepo.save).not.toHaveBeenCalled();
    });

    it('allows unlimited retries: two consecutive mismatches both reject with 401 and both audit-log, neither blocks', async () => {
      const { service, auditLogRepo } = buildService({
        pickupRequests: {
          findOne: vi
            .fn()
            .mockResolvedValue(
              buildOwnedPickupRequest({ status: 'arrived', deliveryCode: '1234' }),
            ),
        },
      });

      await expect(service.deliver('staff-1', 'pr-1', '9999')).rejects.toMatchObject({
        response: { code: 'INVALID_DELIVERY_CODE' },
      });
      await expect(service.deliver('staff-1', 'pr-1', '0000')).rejects.toMatchObject({
        response: { code: 'INVALID_DELIVERY_CODE' },
      });

      expect(auditLogRepo.save).toHaveBeenCalledTimes(2);
    });

    describe('delivery-confirmed push notification (ADR-066, feature 028)', () => {
      function buildGuardianLink(overrides?: {
        guardianId?: string;
        status?: 'active' | 'invited' | 'revoked';
        relationship?: 'mother' | 'father' | 'grandparent' | 'driver' | 'other';
        fullName?: string | null;
        notifyDeliveryConfirmed?: boolean;
      }) {
        return {
          student: { id: 'stu-1' },
          status: overrides?.status ?? 'active',
          relationship: overrides?.relationship ?? 'mother',
          guardian: {
            id: overrides?.guardianId ?? 'user-2',
            fullName: overrides?.fullName === undefined ? 'Luis Pérez' : overrides.fullName,
            notifyDeliveryConfirmed: overrides?.notifyDeliveryConfirmed ?? true,
          },
        };
      }

      function buildSubscription(overrides?: { id?: string; userId?: string }) {
        return {
          id: overrides?.id ?? 'sub-1',
          endpoint: 'https://push.example/endpoint-1',
          p256dhKey: 'p256dh-key',
          authKey: 'auth-key',
          user: { id: overrides?.userId ?? 'user-2' },
        };
      }

      it('notifies the other active guardian with the preference enabled, including who picked up, and never the one who picked up', async () => {
        const { service, pushProvider, pushSubscriptionsRepo } = buildService({
          pickupRequests: {
            findOne: vi.fn().mockResolvedValue(
              buildOwnedPickupRequest({
                status: 'arrived',
                deliveryCode: '1234',
                guardian: { id: 'user-1', fullName: 'Sofía Ramírez' },
              }),
            ),
          },
          studentGuardians: {
            find: vi
              .fn()
              .mockResolvedValue([
                buildGuardianLink({ guardianId: 'user-1', fullName: 'Sofía Ramírez' }),
                buildGuardianLink({ guardianId: 'user-2', fullName: 'Luis Pérez' }),
              ]),
          },
          pushSubscriptions: {
            find: vi.fn().mockResolvedValue([buildSubscription({ userId: 'user-2' })]),
          },
        });

        await service.deliver('staff-1', 'pr-1', '1234');

        expect(pushSubscriptionsRepo.find).toHaveBeenCalledWith({
          where: { user: { id: In(['user-2']) } },
        });
        expect(pushProvider.send).toHaveBeenCalledTimes(1);
        expect(pushProvider.send).toHaveBeenCalledWith(
          {
            endpoint: 'https://push.example/endpoint-1',
            keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
          },
          { title: 'Entrega confirmada', body: 'Ana Pérez fue recogido por Sofía Ramírez.' },
        );
      });

      it('does not notify a guardian with notify_delivery_confirmed = false, even with a subscription registered', async () => {
        const { service, pushProvider } = buildService({
          pickupRequests: {
            findOne: vi
              .fn()
              .mockResolvedValue(
                buildOwnedPickupRequest({ status: 'arrived', deliveryCode: '1234' }),
              ),
          },
          studentGuardians: {
            find: vi
              .fn()
              .mockResolvedValue([
                buildGuardianLink({ guardianId: 'user-1' }),
                buildGuardianLink({ guardianId: 'user-2', notifyDeliveryConfirmed: false }),
              ]),
          },
          pushSubscriptions: {
            find: vi.fn().mockResolvedValue([buildSubscription({ userId: 'user-2' })]),
          },
        });

        await service.deliver('staff-1', 'pr-1', '1234');

        expect(pushProvider.send).not.toHaveBeenCalled();
      });

      it('does not send anything, and does not error, when the eligible guardian has no push_subscription registered', async () => {
        const { service, pushProvider, pushSubscriptionsRepo } = buildService({
          pickupRequests: {
            findOne: vi
              .fn()
              .mockResolvedValue(
                buildOwnedPickupRequest({ status: 'arrived', deliveryCode: '1234' }),
              ),
          },
          studentGuardians: {
            find: vi
              .fn()
              .mockResolvedValue([
                buildGuardianLink({ guardianId: 'user-1' }),
                buildGuardianLink({ guardianId: 'user-2' }),
              ]),
          },
          pushSubscriptions: { find: vi.fn().mockResolvedValue([]) },
        });

        const result = await service.deliver('staff-1', 'pr-1', '1234');

        expect(result.status).toBe('delivered');
        expect(pushSubscriptionsRepo.find).toHaveBeenCalled();
        expect(pushProvider.send).not.toHaveBeenCalled();
      });

      it('does not notify anyone, without error, when the student has a single (the picking-up) guardian', async () => {
        const { service, pushProvider } = buildService({
          pickupRequests: {
            findOne: vi
              .fn()
              .mockResolvedValue(
                buildOwnedPickupRequest({ status: 'arrived', deliveryCode: '1234' }),
              ),
          },
          studentGuardians: {
            find: vi.fn().mockResolvedValue([buildGuardianLink({ guardianId: 'user-1' })]),
          },
        });

        const result = await service.deliver('staff-1', 'pr-1', '1234');

        expect(result.status).toBe('delivered');
        expect(pushProvider.send).not.toHaveBeenCalled();
      });

      it('sends to every registered push_subscription of an eligible guardian, not just the first', async () => {
        const { service, pushProvider } = buildService({
          pickupRequests: {
            findOne: vi
              .fn()
              .mockResolvedValue(
                buildOwnedPickupRequest({ status: 'arrived', deliveryCode: '1234' }),
              ),
          },
          studentGuardians: {
            find: vi
              .fn()
              .mockResolvedValue([
                buildGuardianLink({ guardianId: 'user-1' }),
                buildGuardianLink({ guardianId: 'user-2' }),
              ]),
          },
          pushSubscriptions: {
            find: vi
              .fn()
              .mockResolvedValue([
                buildSubscription({ id: 'sub-1', userId: 'user-2' }),
                buildSubscription({ id: 'sub-2', userId: 'user-2' }),
              ]),
          },
        });

        await service.deliver('staff-1', 'pr-1', '1234');

        expect(pushProvider.send).toHaveBeenCalledTimes(2);
      });

      it('falls back to the relationship label when the picking-up guardian has no full_name (defensive, ADR-066 pt.5)', async () => {
        const { service, pushProvider } = buildService({
          pickupRequests: {
            findOne: vi.fn().mockResolvedValue(
              buildOwnedPickupRequest({
                status: 'arrived',
                deliveryCode: '1234',
                guardian: { id: 'user-1', fullName: null },
              }),
            ),
          },
          studentGuardians: {
            find: vi
              .fn()
              .mockResolvedValue([
                buildGuardianLink({ guardianId: 'user-1', relationship: 'father', fullName: null }),
                buildGuardianLink({ guardianId: 'user-2' }),
              ]),
          },
          pushSubscriptions: {
            find: vi.fn().mockResolvedValue([buildSubscription({ userId: 'user-2' })]),
          },
        });

        await service.deliver('staff-1', 'pr-1', '1234');

        expect(pushProvider.send).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ body: 'Ana Pérez fue recogido por su padre.' }),
        );
      });

      it('a push send failure for one subscription is logged and does not stop the others, nor affect the response', async () => {
        const { service, pushProvider } = buildService({
          pickupRequests: {
            findOne: vi
              .fn()
              .mockResolvedValue(
                buildOwnedPickupRequest({ status: 'arrived', deliveryCode: '1234' }),
              ),
          },
          studentGuardians: {
            find: vi
              .fn()
              .mockResolvedValue([
                buildGuardianLink({ guardianId: 'user-1' }),
                buildGuardianLink({ guardianId: 'user-2' }),
                buildGuardianLink({ guardianId: 'user-3' }),
              ]),
          },
          pushSubscriptions: {
            find: vi
              .fn()
              .mockResolvedValue([
                buildSubscription({ id: 'sub-2', userId: 'user-2' }),
                buildSubscription({ id: 'sub-3', userId: 'user-3' }),
              ]),
          },
          pushProvider: {
            send: vi
              .fn()
              .mockRejectedValueOnce(new Error('expired subscription'))
              .mockResolvedValueOnce(undefined),
          },
        });

        const result = await service.deliver('staff-1', 'pr-1', '1234');

        expect(result.status).toBe('delivered');
        expect(pushProvider.send).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('announce', () => {
    it.each(['en_route', 'arriving', 'arrived'] as const)(
      'publishes to the board-announce topic when the pickup_request is active (status=%s)',
      async (status) => {
        const { service, mqttClient } = buildService({
          pickupRequests: {
            findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status })),
          },
        });

        await service.announce('staff-1', 'pr-1');

        expect(mqttClient.publish).toHaveBeenCalledWith(
          'school-pickup/institution/inst-1/board-announce',
          expect.objectContaining({
            kind: 'announce',
            pickupRequestId: 'pr-1',
            studentFullName: 'Ana Pérez',
          }),
          1,
        );
      },
    );

    it('writes an audit_log row for the announcing member', async () => {
      const { service, auditLogRepo } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'arrived' })),
        },
      });

      await service.announce('staff-1', 'pr-1');

      expect(auditLogRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: { id: 'staff-1' },
          action: 'pickup_request.announced',
          entityType: 'pickup_request',
          entityId: 'pr-1',
          metadata: null,
        }),
      );
    });

    it.each(['delivered', 'cancelled'] as const)(
      'rejects with 409 when the pickup_request is already %s, without publishing or audit-logging',
      async (status) => {
        const { service, mqttClient, auditLogRepo } = buildService({
          pickupRequests: {
            findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status })),
          },
        });

        await expect(service.announce('staff-1', 'pr-1')).rejects.toMatchObject({
          response: { code: 'INVALID_STATUS_TRANSITION' },
        });

        expect(mqttClient.publish).not.toHaveBeenCalled();
        expect(auditLogRepo.save).not.toHaveBeenCalled();
      },
    );

    it('does not transition the pickup_request status or write status history (no state change)', async () => {
      const { service, pickupRequestsRepo, statusHistoryRepo } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'arrived' })),
        },
      });

      await service.announce('staff-1', 'pr-1');

      expect(pickupRequestsRepo.save).not.toHaveBeenCalled();
      expect(statusHistoryRepo.save).not.toHaveBeenCalled();
    });

    it('a publish failure is logged and does not reject the call', async () => {
      const { service } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'arrived' })),
        },
        mqttClient: {
          publish: vi.fn().mockRejectedValue(new Error('broker unreachable')),
        },
      });

      await expect(service.announce('staff-1', 'pr-1')).resolves.toBeUndefined();
    });
  });
});
