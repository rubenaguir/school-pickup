import { describe, expect, it, vi } from 'vitest';
import { In } from 'typeorm';
import { PickupsService } from './pickups.service';
import {
  PickupRequest,
  PickupRequestStatusHistory,
  type DeliveryPoint,
  type Enrollment,
  type Institution,
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
    gradeOrGroup: null,
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
    institution: { id: 'inst-1' },
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
  assignedGroups: string[];
  createdAt: Date;
}

// Mirrors the real query in resolveDeliveryPointId (institution + status +
// grade-or-group containment, oldest created_at first) by reading the
// params actually passed to where()/andWhere() — a fixed-result stub
// couldn't distinguish "filtered out by status" from "no match at all",
// which is exactly what these tests need to tell apart.
function buildDeliveryPointsRepo(deliveryPoints: FakeDeliveryPoint[]) {
  return {
    createQueryBuilder: vi.fn(() => {
      let institutionId: string | undefined;
      let status: string | undefined;
      let gradeOrGroup: string | undefined;
      const qb = {
        where: vi.fn((_sql: string, params: Record<string, string>) => {
          institutionId = params.institutionId;
          return qb;
        }),
        andWhere: vi.fn((_sql: string, params: Record<string, string>) => {
          if (params.status !== undefined) status = params.status;
          if (params.gradeOrGroup !== undefined) gradeOrGroup = params.gradeOrGroup;
          return qb;
        }),
        orderBy: vi.fn(() => qb),
        getOne: vi.fn(() => {
          const matches = deliveryPoints
            .filter((dp) => dp.institutionId === institutionId)
            .filter((dp) => status === undefined || dp.status === status)
            .filter((dp) => gradeOrGroup === undefined || dp.assignedGroups.includes(gradeOrGroup))
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          return Promise.resolve(matches[0] ?? null);
        }),
      };
      return qb;
    }),
  };
}

function buildOwnedPickupRequest(overrides?: Partial<PickupRequest>): PickupRequest {
  return buildPickupRequest({
    guardian: { id: 'user-1' },
    enrollment: {
      id: 'enr-1',
      institutionId: 'inst-1',
      gradeOrGroup: '3°B',
      student: { id: 'stu-1', fullName: 'Ana Pérez' },
    } as Enrollment,
    institution: { id: 'inst-1' } as Institution,
    deliveryPoint: null,
    ...overrides,
  });
}

function buildService(overrides?: {
  pickupRequests?: Partial<
    Record<'exists' | 'create' | 'save' | 'findOne' | 'findAndCount', unknown>
  >;
  enrollments?: Partial<Record<'findOne', unknown>>;
  studentGuardians?: Partial<Record<'findOne' | 'exists', unknown>>;
  institutionMembers?: Partial<Record<'exists', unknown>>;
  vehicles?: Partial<Record<'findOne', unknown>>;
  auditLog?: Partial<Record<'create' | 'save', unknown>>;
  dataSource?: Partial<Record<'transaction', unknown>>;
  mqttClient?: Partial<Record<'publish', unknown>>;
  deliveryPoints?: FakeDeliveryPoint[];
  deliveryPointAccess?: Partial<Record<'checkMemberAccess', unknown>>;
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
  const service = new PickupsService(
    pickupRequestsRepo as never,
    enrollmentsRepo as never,
    studentGuardiansRepo as never,
    institutionMembersRepo as never,
    vehiclesRepo as never,
    deliveryPointsRepo as never,
    auditLogRepo as never,
    dataSource as never,
    mqttClient as never,
    deliveryPointAccess as never,
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
    dataSource,
    mqttClient,
    deliveryPointAccess,
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
            assignedGroups: ['3°B'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ gradeOrGroup: '3°B' })),
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
      expect(mqttClient.publish).toHaveBeenCalledTimes(2);
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
            assignedGroups: ['3°B'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ gradeOrGroup: '3°B' })),
        },
      });

      await service.create('user-1', { enrollmentId: 'enr-1', vehicleId: 'veh-1' });

      expect(mqttClient.publish).toHaveBeenNthCalledWith(
        1,
        'school-pickup/institution/inst-1/board',
        {
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
      expect(mqttClient.publish).toHaveBeenNthCalledWith(
        2,
        'school-pickup/institution/inst-1/delivery-point/dp-1/queue',
        {
          pickupRequestId: 'pr-1',
          status: 'en_route',
          studentFullName: 'Ana Pérez',
          gradeOrGroup: '3°B',
          vehicleDescription: 'Honda CRV gris',
          vehiclePlate: 'ABC-123',
          estimatedArrivalAt: null,
          etaSeconds: null,
          updatedAt: '2026-07-16T08:00:00.000Z',
        },
        1,
      );
    });

    it('does not assign an inactive delivery point even when it matches the group', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ gradeOrGroup: '3°B' })),
        },
        deliveryPoints: [
          {
            id: 'dp-inactive',
            institutionId: 'inst-1',
            status: 'inactive',
            assignedGroups: ['3°B'],
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
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ gradeOrGroup: '3°B' })),
        },
        deliveryPoints: [
          {
            id: 'dp-inactive',
            institutionId: 'inst-1',
            status: 'inactive',
            assignedGroups: ['3°B'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          {
            id: 'dp-active',
            institutionId: 'inst-1',
            status: 'active',
            assignedGroups: ['3°B'],
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
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ gradeOrGroup: '3°B' })),
        },
        deliveryPoints: [
          {
            id: 'dp-newer',
            institutionId: 'inst-1',
            status: 'active',
            assignedGroups: ['3°B'],
            createdAt: new Date('2026-02-01T00:00:00.000Z'),
          },
          {
            id: 'dp-older',
            institutionId: 'inst-1',
            status: 'active',
            assignedGroups: ['3°B'],
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      });

      const result = await service.create('user-1', { enrollmentId: 'enr-1' });

      expect(result.deliveryPointId).toBe('dp-older');
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
      expect(mqttClient.publish).toHaveBeenCalledTimes(1);
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
              }),
            ],
            1,
          ]),
        },
      });

      const result = await service.listByDeliveryPoint('user-1', { deliveryPointId: DP_ID });

      // deliveryPointId surfaces only because the relation is loaded; without
      // it every summary of a queue would report null for its own gate.
      expect(result.pickupRequests).toEqual([
        {
          id: 'pr-1',
          status: 'arrived',
          startedAt: '2026-07-16T08:00:00.000Z',
          completedAt: null,
          deliveryPointId: DP_ID,
        },
      ]);
      expect(result).toMatchObject({ limit: 20, offset: 0, total: 1 });
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
        relations: { deliveryPoint: true },
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

    it('publishes the cancelled status to the board topic exactly once', async () => {
      const { service, mqttClient } = buildService({
        pickupRequests: {
          findOne: vi.fn().mockResolvedValue(buildOwnedPickupRequest({ status: 'en_route' })),
        },
      });

      await service.cancel('user-1', 'pr-1');

      expect(mqttClient.publish).toHaveBeenCalledTimes(1);
      expect(mqttClient.publish).toHaveBeenCalledWith(
        'school-pickup/institution/inst-1/board',
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

      expect(mqttClient.publish).toHaveBeenCalledTimes(2);
      expect(mqttClient.publish).toHaveBeenNthCalledWith(
        2,
        'school-pickup/institution/inst-1/delivery-point/dp-1/queue',
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

      expect(mqttClient.publish).toHaveBeenCalledTimes(1);
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
  });
});
