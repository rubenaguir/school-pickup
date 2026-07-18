import { describe, expect, it, vi } from 'vitest';
import { PickupRequest, PickupRequestStatusHistory } from '@casillego/shared/entities';
import { LocationIngestionService } from './location-ingestion.service';

const INSTITUTION_ID = 'inst-1';
const PICKUP_REQUEST_ID = 'pr-1';

function buildPickupRequest(overrides?: Partial<PickupRequest>): PickupRequest {
  return {
    id: PICKUP_REQUEST_ID,
    enrollment: {
      id: 'enr-1',
      gradeOrGroup: '3A',
      student: { id: 'stu-1', fullName: 'Ana Pérez' },
    },
    institution: {
      id: INSTITUTION_ID,
      location: { type: 'Point', coordinates: [-99.1332, 19.4326] },
      arrivingLeadMinutes: 5,
      geofenceRadiusMeters: 100,
    },
    guardian: { id: 'user-1' },
    deliveryPoint: null,
    status: 'en_route',
    startedAt: new Date('2026-07-17T08:00:00.000Z'),
    estimatedArrivalAt: null,
    etaSeconds: null,
    etaCalculatedAt: null,
    lastLocation: null,
    deliveryCode: '1234',
    arrivalMode: null,
    vehicle: null,
    vehicleDescription: null,
    vehiclePlate: null,
    completedAt: null,
    createdAt: new Date('2026-07-17T08:00:00.000Z'),
    updatedAt: new Date('2026-07-17T08:00:00.000Z'),
    ...overrides,
  } as PickupRequest;
}

function buildService(overrides?: {
  pickupRequest?: PickupRequest | null;
  mapsProvider?: Partial<Record<'getEta', unknown>>;
  mqttClient?: Partial<Record<'publish', unknown>>;
}) {
  const pickupRequest =
    overrides?.pickupRequest === undefined ? buildPickupRequest() : overrides.pickupRequest;

  const pickupRequestRepo = {
    findOne: vi.fn().mockResolvedValue(pickupRequest),
    save: vi.fn((entity: PickupRequest) => Promise.resolve(entity)),
  };
  const locationUpdateRepo = {
    insert: vi.fn().mockResolvedValue(undefined),
  };
  const statusHistoryRepo = {
    create: vi.fn((partial: object) => partial),
    save: vi.fn((entity: object) => Promise.resolve({ id: 'hist-1', ...entity })),
  };
  const mapsProvider = {
    getEta: vi.fn().mockResolvedValue({ etaSeconds: 600, distanceMeters: 5000 }),
    ...overrides?.mapsProvider,
  };
  const mqttClient = {
    publish: vi.fn().mockResolvedValue(undefined),
    ...overrides?.mqttClient,
  };
  const dataSource = {
    transaction: vi.fn((cb: (manager: unknown) => Promise<unknown>) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === PickupRequest) return pickupRequestRepo;
          if (entity === PickupRequestStatusHistory) return statusHistoryRepo;
          throw new Error('Unexpected entity in test dataSource.transaction');
        },
      }),
    ),
  };

  const service = new LocationIngestionService(
    pickupRequestRepo as never,
    locationUpdateRepo as never,
    mapsProvider as never,
    mqttClient as never,
    dataSource as never,
  );

  return {
    service,
    pickupRequestRepo,
    locationUpdateRepo,
    statusHistoryRepo,
    mapsProvider,
    mqttClient,
    dataSource,
  };
}

// Far enough from the default institution (zocalo, ~19.4326,-99.1332) to sit
// outside the default 100 m geofence — most tests exercise the ETA-only path,
// not the arriving transition (which has its own dedicated tests below).
const validPayload = {
  lat: 19.43,
  lng: -99.14,
  recordedAt: '2026-07-17T08:05:00.000Z',
};

describe('LocationIngestionService', () => {
  it('persists a valid payload as a location_updates row', async () => {
    const { service, locationUpdateRepo } = buildService();

    await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload);

    expect(locationUpdateRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pickupRequest: { id: PICKUP_REQUEST_ID },
        location: { type: 'Point', coordinates: [-99.14, 19.43] },
        recordedAt: new Date('2026-07-17T08:05:00.000Z'),
      }),
    );
  });

  it('discards a malformed payload without inserting or throwing', async () => {
    const { service, locationUpdateRepo, pickupRequestRepo } = buildService();

    await expect(
      service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, { lat: 'not-a-number' }),
    ).resolves.toBeUndefined();

    expect(locationUpdateRepo.insert).not.toHaveBeenCalled();
    expect(pickupRequestRepo.findOne).not.toHaveBeenCalled();
  });

  it('discards a message for an unknown pickup_request without inserting or throwing', async () => {
    const { service, locationUpdateRepo } = buildService({ pickupRequest: null });

    await expect(
      service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload),
    ).resolves.toBeUndefined();

    expect(locationUpdateRepo.insert).not.toHaveBeenCalled();
  });

  it('discards a message whose topic institution does not match the pickup_request institution', async () => {
    const { service, locationUpdateRepo } = buildService();

    await service.handleLocationMessage('other-institution', PICKUP_REQUEST_ID, validPayload);

    expect(locationUpdateRepo.insert).not.toHaveBeenCalled();
  });

  it('inserts the location_updates row but skips ETA recalculation for a terminal pickup_request', async () => {
    const { service, locationUpdateRepo, mapsProvider, mqttClient, pickupRequestRepo } =
      buildService({
        pickupRequest: buildPickupRequest({ status: 'delivered' }),
      });

    await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload);

    expect(locationUpdateRepo.insert).toHaveBeenCalledTimes(1);
    expect(mapsProvider.getEta).not.toHaveBeenCalled();
    expect(pickupRequestRepo.save).not.toHaveBeenCalled();
    expect(mqttClient.publish).not.toHaveBeenCalled();
  });

  it('always recalculates on the first location (eta_calculated_at null)', async () => {
    const { service, mapsProvider } = buildService({
      pickupRequest: buildPickupRequest({ etaCalculatedAt: null, lastLocation: null }),
    });

    await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload);

    expect(mapsProvider.getEta).toHaveBeenCalledTimes(1);
  });

  it('does not recalculate when under 20s and under 150m since the last recalculation', async () => {
    const { service, mapsProvider } = buildService({
      pickupRequest: buildPickupRequest({
        etaCalculatedAt: new Date(Date.now() - 5_000),
        lastLocation: { type: 'Point', coordinates: [-99.14, 19.43] },
      }),
    });

    await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, {
      lat: 19.4301,
      lng: -99.1401,
      recordedAt: '2026-07-17T08:05:00.000Z',
    });

    expect(mapsProvider.getEta).not.toHaveBeenCalled();
  });

  it('recalculates after 20s even if the distance moved is minimal', async () => {
    const { service, mapsProvider } = buildService({
      pickupRequest: buildPickupRequest({
        etaCalculatedAt: new Date(Date.now() - 21_000),
        lastLocation: { type: 'Point', coordinates: [-99.14, 19.43] },
      }),
    });

    await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, {
      lat: 19.4301,
      lng: -99.1401,
      recordedAt: '2026-07-17T08:05:00.000Z',
    });

    expect(mapsProvider.getEta).toHaveBeenCalledTimes(1);
  });

  it('recalculates when >= 150m have been covered even if under 20s have passed', async () => {
    const { service, mapsProvider } = buildService({
      pickupRequest: buildPickupRequest({
        etaCalculatedAt: new Date(Date.now() - 5_000),
        lastLocation: { type: 'Point', coordinates: [-99.1332, 19.4326] },
      }),
    });

    await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, {
      lat: 19.445,
      lng: -99.1332,
      recordedAt: '2026-07-17T08:05:00.000Z',
    });

    expect(mapsProvider.getEta).toHaveBeenCalledTimes(1);
  });

  it('updates last_location, estimated_arrival_at, eta_seconds and eta_calculated_at on recalculation', async () => {
    const { service, pickupRequestRepo } = buildService();

    await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload);

    expect(pickupRequestRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        lastLocation: { type: 'Point', coordinates: [-99.14, 19.43] },
        etaSeconds: 600,
      }),
    );
    const saved = pickupRequestRepo.save.mock.calls[0][0];
    expect(saved.etaCalculatedAt).toBeInstanceOf(Date);
    expect(saved.estimatedArrivalAt).toBeInstanceOf(Date);
  });

  it('publishes the board payload after a successful recalculation', async () => {
    const { service, mqttClient } = buildService();

    await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload);

    expect(mqttClient.publish).toHaveBeenCalledWith(
      `school-pickup/institution/${INSTITUTION_ID}/board`,
      expect.objectContaining({ pickupRequestId: PICKUP_REQUEST_ID }),
      1,
    );
  });

  it('also publishes the delivery-point queue payload when the pickup_request has a delivery point', async () => {
    const { service, mqttClient } = buildService({
      pickupRequest: buildPickupRequest({ deliveryPoint: { id: 'dp-1' } as never }),
    });

    await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload);

    expect(mqttClient.publish).toHaveBeenCalledWith(
      `school-pickup/institution/${INSTITUTION_ID}/delivery-point/dp-1/queue`,
      expect.objectContaining({ pickupRequestId: PICKUP_REQUEST_ID }),
      1,
    );
  });

  it('does not publish to the queue topic when there is no delivery point', async () => {
    const { service, mqttClient } = buildService();

    await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload);

    expect(mqttClient.publish).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the MQTT publish fails, and still keeps the already-saved ETA', async () => {
    const { service, pickupRequestRepo } = buildService({
      mqttClient: { publish: vi.fn().mockRejectedValue(new Error('broker down')) },
    });

    await expect(
      service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload),
    ).resolves.toBeUndefined();

    expect(pickupRequestRepo.save).toHaveBeenCalledTimes(1);
  });

  describe('automatic transition to arriving (feature 020)', () => {
    it('transitions en_route to arriving when eta_seconds falls below arrivingLeadMinutes', async () => {
      const { service, pickupRequestRepo, statusHistoryRepo, mqttClient } = buildService({
        mapsProvider: {
          getEta: vi.fn().mockResolvedValue({ etaSeconds: 250, distanceMeters: 2000 }),
        },
      });

      await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload);

      expect(pickupRequestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'arriving' }),
      );
      expect(statusHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'arriving', changedBy: null }),
      );
      expect(mqttClient.publish).toHaveBeenCalledWith(
        `school-pickup/institution/${INSTITUTION_ID}/board`,
        expect.objectContaining({ status: 'arriving' }),
        1,
      );
    });

    it('transitions en_route to arriving when within geofenceRadiusMeters, even with a high ETA', async () => {
      const { service, pickupRequestRepo, statusHistoryRepo, mqttClient } = buildService();

      await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, {
        lat: 19.4327,
        lng: -99.1333,
        recordedAt: '2026-07-17T08:05:00.000Z',
      });

      expect(pickupRequestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'arriving' }),
      );
      expect(statusHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'arriving', changedBy: null }),
      );
      expect(mqttClient.publish).toHaveBeenCalledWith(
        `school-pickup/institution/${INSTITUTION_ID}/board`,
        expect.objectContaining({ status: 'arriving' }),
        1,
      );
    });

    it('stays en_route when neither the ETA threshold nor the geofence is met', async () => {
      const { service, statusHistoryRepo, mqttClient } = buildService();

      await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload);

      expect(statusHistoryRepo.save).not.toHaveBeenCalled();
      expect(mqttClient.publish).toHaveBeenCalledWith(
        `school-pickup/institution/${INSTITUTION_ID}/board`,
        expect.objectContaining({ status: 'en_route' }),
        1,
      );
    });

    it('does not re-evaluate the arriving transition for a pickup_request already in arriving', async () => {
      const { service, pickupRequestRepo, statusHistoryRepo, mqttClient } = buildService({
        pickupRequest: buildPickupRequest({ status: 'arriving' }),
        mapsProvider: {
          getEta: vi.fn().mockResolvedValue({ etaSeconds: 250, distanceMeters: 2000 }),
        },
      });

      await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload);

      expect(statusHistoryRepo.save).not.toHaveBeenCalled();
      expect(pickupRequestRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'arriving', etaSeconds: 250 }),
      );
      expect(mqttClient.publish).toHaveBeenCalledTimes(1);
    });

    it('publishes exactly once, not twice, when the transition applies', async () => {
      const { service, mqttClient } = buildService({
        mapsProvider: {
          getEta: vi.fn().mockResolvedValue({ etaSeconds: 250, distanceMeters: 2000 }),
        },
      });

      await service.handleLocationMessage(INSTITUTION_ID, PICKUP_REQUEST_ID, validPayload);

      expect(mqttClient.publish).toHaveBeenCalledTimes(1);
    });
  });
});
