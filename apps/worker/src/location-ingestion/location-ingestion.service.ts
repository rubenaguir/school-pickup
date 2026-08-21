import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { LocationUpdate, PickupRequest, StudentGuardian } from '@casillego/shared/entities';
import { applyPickupRequestTransition } from '@casillego/shared/pickup-request-transition';
import {
  boardMonitorTopic,
  boardTopic,
  buildBoardMonitorPayload,
  buildBoardPayload,
  buildQueuePayload,
  deliveryPointQueueTopic,
  MAPS_PROVIDER,
  MQTT_CLIENT,
  type MapsProvider,
  type MqttClient,
  type PickupRequestRealtimeSnapshot,
  type PickupRequestStatus,
  type StudentGuardianRelationship,
} from '@casillego/shared';
import { haversineDistanceMeters } from '../shared/haversine-distance.util';
import { geoPointToLatLng, latLngToGeoPoint } from './geo-point.mapper';
import { parseLocationPayload } from './location-payload.parser';

const THROTTLE_INTERVAL_MS = 20_000;
const THROTTLE_DISTANCE_METERS = 150;
const TERMINAL_STATUSES: readonly PickupRequestStatus[] = ['delivered', 'cancelled'];

@Injectable()
export class LocationIngestionService {
  private readonly logger = new Logger(LocationIngestionService.name);

  constructor(
    @InjectRepository(PickupRequest) private readonly pickupRequestRepo: Repository<PickupRequest>,
    @InjectRepository(LocationUpdate)
    private readonly locationUpdateRepo: Repository<LocationUpdate>,
    @InjectRepository(StudentGuardian)
    private readonly studentGuardiansRepo: Repository<StudentGuardian>,
    @Inject(MAPS_PROVIDER) private readonly mapsProvider: MapsProvider,
    @Inject(MQTT_CLIENT) private readonly mqttClient: MqttClient,
    private readonly dataSource: DataSource,
  ) {}

  async handleLocationMessage(
    institutionId: string,
    pickupRequestId: string,
    rawPayload: unknown,
  ): Promise<void> {
    const payload = parseLocationPayload(rawPayload);
    if (!payload) {
      this.logger.warn(
        `Discarding malformed location payload for pickup_request ${pickupRequestId}`,
      );
      return;
    }

    const pickupRequest = await this.pickupRequestRepo.findOne({
      where: { id: pickupRequestId },
      relations: {
        institution: true,
        enrollment: { student: true, group: true },
        deliveryPoint: true,
        guardian: true,
      },
    });
    if (!pickupRequest) {
      this.logger.warn(`Discarding location update for unknown pickup_request ${pickupRequestId}`);
      return;
    }
    if (pickupRequest.institution.id !== institutionId) {
      this.logger.warn(
        `Discarding location update: topic institution ${institutionId} does not match ` +
          `pickup_request ${pickupRequestId} institution ${pickupRequest.institution.id}`,
      );
      return;
    }

    const newPoint = latLngToGeoPoint({ lat: payload.lat, lng: payload.lng });

    await this.locationUpdateRepo.insert({
      pickupRequest: { id: pickupRequestId } as PickupRequest,
      location: newPoint,
      accuracyMeters: payload.accuracyMeters,
      recordedAt: payload.recordedAt,
    });

    if (TERMINAL_STATUSES.includes(pickupRequest.status)) {
      return;
    }

    if (!this.shouldRecalculateEta(pickupRequest, payload)) {
      return;
    }

    const origin = { lat: payload.lat, lng: payload.lng };
    const destination = geoPointToLatLng(pickupRequest.institution.location);
    const eta = await this.mapsProvider.getEta(origin, destination);

    const now = new Date();
    pickupRequest.lastLocation = newPoint;
    pickupRequest.estimatedArrivalAt = new Date(now.getTime() + eta.etaSeconds * 1000);
    pickupRequest.etaSeconds = eta.etaSeconds;
    pickupRequest.etaCalculatedAt = now;

    const shouldEvaluateArriving = pickupRequest.status === 'en_route';
    const meetsArrivingLeadTime =
      eta.etaSeconds <= pickupRequest.institution.arrivingLeadMinutes * 60;
    const meetsArrivalGeofence =
      haversineDistanceMeters(origin, destination) <=
      pickupRequest.institution.geofenceRadiusMeters;

    const updated =
      shouldEvaluateArriving && (meetsArrivingLeadTime || meetsArrivalGeofence)
        ? await this.dataSource.transaction((manager) =>
            applyPickupRequestTransition(manager, pickupRequest, 'arriving', null),
          )
        : await this.pickupRequestRepo.save(pickupRequest);

    await this.publishRealtimeUpdate(updated);
  }

  private shouldRecalculateEta(
    pickupRequest: PickupRequest,
    payload: { lat: number; lng: number },
  ): boolean {
    if (!pickupRequest.etaCalculatedAt) return true;

    const elapsedMs = Date.now() - pickupRequest.etaCalculatedAt.getTime();
    if (elapsedMs >= THROTTLE_INTERVAL_MS) return true;

    if (!pickupRequest.lastLocation) return true;

    const distanceMeters = haversineDistanceMeters(
      geoPointToLatLng(pickupRequest.lastLocation),
      payload,
    );
    return distanceMeters >= THROTTLE_DISTANCE_METERS;
  }

  // ADR-071 pt.2: same student_guardians lookup already used by
  // PickupsService.notifyOtherGuardiansOfDelivery (ADR-066 pt.5) to resolve
  // the guardian-student link. Kept as its own small query here — not shared
  // with apps/api's identically-named private method — since api and worker
  // are separate processes with no code-sharing mechanism for private service
  // methods; duplicating this one small query is simpler than inventing a
  // cross-process abstraction for it. Defensive 'other' fallback: a missing
  // link should never happen in practice, but must never throw and break a
  // realtime publish.
  private async resolveGuardianRelationship(
    studentId: string,
    guardianId: string,
  ): Promise<StudentGuardianRelationship> {
    const link = await this.studentGuardiansRepo.findOne({
      where: { student: { id: studentId }, guardian: { id: guardianId } },
    });
    return link?.relationship ?? 'other';
  }

  private async publishRealtimeUpdate(pickupRequest: PickupRequest): Promise<void> {
    const deliveryPointId = pickupRequest.deliveryPoint ? pickupRequest.deliveryPoint.id : null;

    const guardianRelationship = await this.resolveGuardianRelationship(
      pickupRequest.enrollment.student.id,
      pickupRequest.guardian.id,
    );

    const snapshot: PickupRequestRealtimeSnapshot = {
      pickupRequestId: pickupRequest.id,
      status: pickupRequest.status,
      studentFullName: pickupRequest.enrollment.student.fullName,
      gradeOrGroup: pickupRequest.enrollment.group?.name ?? null,
      deliveryPointId,
      estimatedArrivalAt: pickupRequest.estimatedArrivalAt
        ? pickupRequest.estimatedArrivalAt.toISOString()
        : null,
      etaSeconds: pickupRequest.etaSeconds,
      arrivalMode: pickupRequest.arrivalMode,
      vehicleDescription: pickupRequest.vehicleDescription,
      vehiclePlate: pickupRequest.vehiclePlate,
      deliveryCode: pickupRequest.deliveryCode,
      guardianFullName: pickupRequest.guardian.fullName ?? '',
      guardianRelationship,
      updatedAt: pickupRequest.updatedAt.toISOString(),
    };

    try {
      await this.mqttClient.publish(
        boardTopic(pickupRequest.institution.id),
        buildBoardPayload(snapshot),
        1,
      );
      if (deliveryPointId) {
        await this.mqttClient.publish(
          deliveryPointQueueTopic(pickupRequest.institution.id, deliveryPointId),
          buildQueuePayload(snapshot),
          1,
        );
      }
      await this.mqttClient.publish(
        boardMonitorTopic(pickupRequest.institution.id),
        buildBoardMonitorPayload(snapshot),
        1,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish pickup_request ${pickupRequest.id} realtime update to MQTT`,
        error as Error,
      );
    }
  }
}
