import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  boardTopic,
  buildBoardPayload,
  buildQueuePayload,
  deliveryPointQueueTopic,
  MQTT_CLIENT,
  type MqttClient,
  pickupLocationTopic,
  type PickupRequestRealtimeSnapshot,
  type PickupRequestStatus,
} from '@casillego/shared';
import {
  applyPickupRequestTransition,
  InvalidStatusTransitionError,
} from '@casillego/shared/pickup-request-transition';
import { isUniqueViolation } from '../common/db-errors.util';
import { DeliveryPointAccessService } from '../delivery-points/delivery-point-access.service';
import {
  AuditLog,
  DeliveryPoint,
  Enrollment,
  Institution,
  InstitutionMember,
  PickupRequest,
  PickupRequestStatusHistory,
  StudentGuardian,
  type User,
  Vehicle,
} from '@casillego/shared/entities';
import { randomDeliveryCode } from './delivery-code.util';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import type { ListPickupRequestsQueryDto } from './dto/list-pickup-requests-query.dto';
import type { SendLocationDto } from './dto/send-location.dto';
import type {
  ListDeliveryPointQueueResponse,
  ListPickupRequestsResponse,
  PickupRequestArrivedResponse,
  PickupRequestCancelResponse,
  PickupRequestDeliverResponse,
  PickupRequestDetailResponse,
  PickupRequestQueueSummary,
  PickupRequestResponse,
  PickupRequestSummary,
} from './dto/responses';

const RESOURCE_NOT_FOUND = {
  code: 'RESOURCE_NOT_FOUND',
  message: 'The requested resource does not exist.',
} as const;

const NOT_STUDENT_GUARDIAN = {
  code: 'NOT_STUDENT_GUARDIAN',
  message: 'The authenticated user is not a guardian of this student.',
} as const;

const NOT_INSTITUTION_MEMBER = {
  code: 'NOT_INSTITUTION_MEMBER',
  message: 'The authenticated user is not a member of this institution.',
} as const;

const GUARDIAN_NOT_ACTIVE = {
  code: 'GUARDIAN_NOT_ACTIVE',
  message: 'The authenticated user is a guardian of this student, but is not active.',
} as const;

const ENROLLMENT_NOT_APPROVED = {
  code: 'ENROLLMENT_NOT_APPROVED',
  message: 'This enrollment is not approved.',
} as const;

const INSTITUTION_NOT_APPROVED = {
  code: 'INSTITUTION_NOT_APPROVED',
  message: 'The institution is not approved.',
} as const;

const ACTIVE_PICKUP_REQUEST_EXISTS = {
  code: 'ACTIVE_PICKUP_REQUEST_EXISTS',
  message: 'An active pickup request already exists for this enrollment.',
} as const;

const NOT_VEHICLE_OWNER = {
  code: 'NOT_VEHICLE_OWNER',
  message: 'This vehicle belongs to another guardian.',
} as const;

const INVALID_STATUS_TRANSITION = {
  code: 'INVALID_STATUS_TRANSITION',
  message: 'This transition is not valid for the current status of this pickup request.',
} as const;

const INVALID_DELIVERY_CODE = {
  code: 'INVALID_DELIVERY_CODE',
  message: 'The delivery code does not match.',
} as const;

const MAX_DELIVERY_CODE_ATTEMPTS = 10;

const ACTIVE_STATUSES = ['en_route', 'arriving', 'arrived'] as const;

interface VehicleSnapshot {
  vehicle: Vehicle | null;
  vehicleDescription: string | null;
  vehiclePlate: string | null;
}

@Injectable()
export class PickupsService {
  private readonly logger = new Logger(PickupsService.name);

  constructor(
    @InjectRepository(PickupRequest)
    private readonly pickupRequestsRepository: Repository<PickupRequest>,
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(StudentGuardian)
    private readonly studentGuardiansRepository: Repository<StudentGuardian>,
    @InjectRepository(InstitutionMember)
    private readonly institutionMembersRepository: Repository<InstitutionMember>,
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(DeliveryPoint)
    private readonly deliveryPointsRepository: Repository<DeliveryPoint>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    @Inject(MQTT_CLIENT) private readonly mqttClient: MqttClient,
    private readonly deliveryPointAccess: DeliveryPointAccessService,
  ) {}

  async create(userId: string, dto: CreatePickupRequestDto): Promise<PickupRequestResponse> {
    const enrollment = await this.findEnrollmentOrFail(dto.enrollmentId);
    await this.assertActiveGuardian(enrollment.student.id, userId);

    if (enrollment.status !== 'approved') {
      throw new UnprocessableEntityException(ENROLLMENT_NOT_APPROVED);
    }
    if (enrollment.institution.status !== 'approved') {
      throw new UnprocessableEntityException(INSTITUTION_NOT_APPROVED);
    }

    const hasActivePickup = await this.pickupRequestsRepository.exists({
      where: { enrollment: { id: enrollment.id }, status: In(ACTIVE_STATUSES) },
    });
    if (hasActivePickup) {
      throw new UnprocessableEntityException(ACTIVE_PICKUP_REQUEST_EXISTS);
    }

    const vehicleSnapshot = await this.resolveVehicleSnapshot(userId, dto);
    const deliveryPointId = await this.resolveDeliveryPointId(enrollment);

    const saved = await this.insertWithUniqueDeliveryCode(
      enrollment,
      userId,
      deliveryPointId,
      dto.arrivalMode ?? null,
      vehicleSnapshot,
    );

    await this.publishRealtimeUpdate(saved, enrollment, deliveryPointId);

    return this.toResponse(saved);
  }

  async findById(userId: string, id: string): Promise<PickupRequestDetailResponse> {
    const pickupRequest = await this.findPickupRequestOrFail(id);
    await this.assertReadAccess(
      pickupRequest.enrollment.student.id,
      pickupRequest.institutionId,
      userId,
    );
    return this.toDetailResponse(pickupRequest);
  }

  async listByEnrollment(
    userId: string,
    query: ListPickupRequestsQueryDto & { enrollmentId: string },
  ): Promise<ListPickupRequestsResponse> {
    const enrollment = await this.findEnrollmentOrFail(query.enrollmentId);
    await this.assertReadAccess(enrollment.student.id, enrollment.institutionId, userId);

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const [pickupRequests, total] = await this.pickupRequestsRepository.findAndCount({
      where: {
        enrollment: { id: enrollment.id },
        ...(query.status ? { status: query.status } : {}),
      },
      // Without this the deliveryPoint relation stays unloaded and every
      // summary reports deliveryPointId: null, contradicting the contract.
      relations: { deliveryPoint: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      pickupRequests: pickupRequests.map((pickupRequest) => this.toSummary(pickupRequest)),
      limit,
      offset,
      total,
    };
  }

  /**
   * Operational queue of a delivery point: the REST snapshot the gate console
   * starts from, before the WebSocket bridge takes over with deltas (ADR-050
   * pt.6). Deliberately NOT a variant of listByEnrollment: it authorizes only
   * through the institution_member side of that method's OR (a delivery point
   * has no individual-guardian perspective) and it returns active statuses
   * only, never history.
   *
   * Its rows are `PickupRequestQueueSummary`, not `PickupRequestSummary`: the
   * same fields the WebSocket deltas carry, so the console merges both without
   * transforming either (ADR-051 pt.3).
   */
  async listByDeliveryPoint(
    userId: string,
    query: ListPickupRequestsQueryDto & { deliveryPointId: string },
  ): Promise<ListDeliveryPointQueueResponse> {
    const access = await this.deliveryPointAccess.checkMemberAccess(query.deliveryPointId, userId);
    if (access.outcome === 'not_found') {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }
    if (access.outcome === 'not_member') {
      throw new ForbiddenException(NOT_INSTITUTION_MEMBER);
    }

    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const [pickupRequests, total] = await this.pickupRequestsRepository.findAndCount({
      where: {
        deliveryPoint: { id: query.deliveryPointId },
        // `status`, when present, narrows within the active set rather than
        // widening past it: asking for `delivered` here intersects to nothing
        // and yields an empty page, never a historical row.
        status: In(
          query.status ? ACTIVE_STATUSES.filter((s) => s === query.status) : ACTIVE_STATUSES,
        ),
      },
      // studentFullName and gradeOrGroup are joins, not columns of
      // pickup_requests — the console cannot render a queue row without them.
      relations: { enrollment: { student: true } },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      pickupRequests: pickupRequests.map((pickupRequest) => this.toQueueSummary(pickupRequest)),
      limit,
      offset,
      total,
    };
  }

  async arrive(userId: string, id: string): Promise<PickupRequestArrivedResponse> {
    const pickupRequest = await this.findPickupRequestOrFail(id);
    this.assertOwner(pickupRequest, userId);

    const updated = await this.transitionAndPublish(pickupRequest, 'arrived', userId);

    return { id: updated.id, status: updated.status };
  }

  async cancel(userId: string, id: string): Promise<PickupRequestCancelResponse> {
    const pickupRequest = await this.findPickupRequestOrFail(id);
    this.assertOwner(pickupRequest, userId);
    pickupRequest.completedAt = new Date();

    const updated = await this.transitionAndPublish(pickupRequest, 'cancelled', userId);

    return {
      id: updated.id,
      status: updated.status,
      completedAt: updated.completedAt!.toISOString(),
    };
  }

  // ADR-062: apps/parent posts here instead of publishing to MQTT directly
  // (ADR-050 — the browser never talks to the broker). No throttling here by
  // design (ADR-062 pt.5); the api republishes every valid POST as-is, QoS 0.
  async sendLocation(userId: string, id: string, dto: SendLocationDto): Promise<void> {
    const pickupRequest = await this.findPickupRequestOrFail(id);
    this.assertOwner(pickupRequest, userId);

    if (pickupRequest.status === 'delivered' || pickupRequest.status === 'cancelled') {
      throw new ConflictException(INVALID_STATUS_TRANSITION);
    }

    try {
      await this.mqttClient.publish(
        pickupLocationTopic(pickupRequest.institutionId, pickupRequest.id),
        {
          lat: dto.lat,
          lng: dto.lng,
          accuracyMeters: dto.accuracyMeters ?? null,
          recordedAt: dto.recordedAt,
        },
        0,
      );
    } catch (error) {
      this.logger.error(
        `Failed to republish location update for pickup_request ${pickupRequest.id} to MQTT`,
        error as Error,
      );
    }
  }

  async deliver(
    userId: string,
    id: string,
    deliveryCode: string,
  ): Promise<PickupRequestDeliverResponse> {
    const pickupRequest = await this.findPickupRequestOrFail(id);

    if (pickupRequest.status !== 'arrived') {
      throw new ConflictException(INVALID_STATUS_TRANSITION);
    }

    if (pickupRequest.deliveryCode !== deliveryCode) {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          actor: { id: userId } as User,
          action: 'pickup_request.delivery_code_mismatched',
          entityType: 'pickup_request',
          entityId: pickupRequest.id,
          metadata: null,
        }),
      );
      throw new UnauthorizedException(INVALID_DELIVERY_CODE);
    }

    pickupRequest.completedAt = new Date();
    const updated = await this.transitionAndPublish(pickupRequest, 'delivered', userId);

    return {
      id: updated.id,
      status: updated.status,
      completedAt: updated.completedAt!.toISOString(),
    };
  }

  private async findPickupRequestOrFail(id: string): Promise<PickupRequest> {
    const pickupRequest = await this.pickupRequestsRepository.findOne({
      where: { id },
      relations: {
        guardian: true,
        institution: true,
        enrollment: { student: true },
        deliveryPoint: true,
      },
    });
    if (!pickupRequest) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }
    return pickupRequest;
  }

  private assertOwner(pickupRequest: PickupRequest, userId: string): void {
    if (pickupRequest.guardian.id !== userId) {
      throw new ForbiddenException(NOT_STUDENT_GUARDIAN);
    }
  }

  // Deliberately looser than assertActiveGuardian: any guardian link
  // regardless of status, since reading a pickup request's status is not a
  // sensitive action gated on active status the way creating one is.
  private async hasGuardianLink(studentId: string, userId: string): Promise<boolean> {
    return this.studentGuardiansRepository.exists({
      where: { student: { id: studentId }, guardian: { id: userId } },
    });
  }

  private async assertReadAccess(
    studentId: string,
    institutionId: string,
    userId: string,
  ): Promise<void> {
    const [isGuardian, isMember] = await Promise.all([
      this.hasGuardianLink(studentId, userId),
      this.institutionMembersRepository.exists({
        where: { institution: { id: institutionId }, user: { id: userId } },
      }),
    ]);
    if (!isGuardian && !isMember) {
      throw new ForbiddenException(NOT_INSTITUTION_MEMBER);
    }
  }

  private async transitionAndPublish(
    pickupRequest: PickupRequest,
    newStatus: PickupRequestStatus,
    userId: string,
  ): Promise<PickupRequest> {
    let updated: PickupRequest;
    try {
      updated = await this.dataSource.transaction((manager) =>
        applyPickupRequestTransition(manager, pickupRequest, newStatus, userId),
      );
    } catch (error) {
      if (error instanceof InvalidStatusTransitionError) {
        throw new ConflictException(INVALID_STATUS_TRANSITION);
      }
      throw error;
    }

    await this.publishRealtimeUpdate(
      updated,
      updated.enrollment,
      updated.deliveryPoint ? updated.deliveryPoint.id : null,
    );

    return updated;
  }

  private async findEnrollmentOrFail(enrollmentId: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { id: enrollmentId },
      relations: { student: true, institution: true },
    });
    if (!enrollment) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }
    return enrollment;
  }

  private async assertActiveGuardian(studentId: string, userId: string): Promise<void> {
    const link = await this.studentGuardiansRepository.findOne({
      where: { student: { id: studentId }, guardian: { id: userId } },
    });
    if (!link) {
      throw new ForbiddenException(NOT_STUDENT_GUARDIAN);
    }
    if (link.status !== 'active') {
      throw new ForbiddenException(GUARDIAN_NOT_ACTIVE);
    }
  }

  private async resolveVehicleSnapshot(
    userId: string,
    dto: CreatePickupRequestDto,
  ): Promise<VehicleSnapshot> {
    if (dto.arrivalMode === 'walking') {
      return { vehicle: null, vehicleDescription: null, vehiclePlate: null };
    }

    if (dto.vehicleId) {
      const vehicle = await this.vehiclesRepository.findOne({
        where: { id: dto.vehicleId },
        relations: { guardian: true },
      });
      if (!vehicle) {
        throw new NotFoundException(RESOURCE_NOT_FOUND);
      }
      if (vehicle.guardian.id !== userId) {
        throw new ForbiddenException(NOT_VEHICLE_OWNER);
      }
      return {
        vehicle,
        vehicleDescription: vehicle.description,
        vehiclePlate: vehicle.plate,
      };
    }

    return {
      vehicle: null,
      vehicleDescription: dto.vehicleDescription ?? null,
      vehiclePlate: dto.vehiclePlate ?? null,
    };
  }

  private async resolveDeliveryPointId(enrollment: Enrollment): Promise<string | null> {
    if (!enrollment.gradeOrGroup) {
      return null;
    }
    const match = await this.deliveryPointsRepository
      .createQueryBuilder('deliveryPoint')
      .where('deliveryPoint.institution_id = :institutionId', {
        institutionId: enrollment.institutionId,
      })
      .andWhere('deliveryPoint.status = :status', { status: 'active' })
      .andWhere(':gradeOrGroup = ANY(deliveryPoint.assigned_groups)', {
        gradeOrGroup: enrollment.gradeOrGroup,
      })
      // No hay prioridad de negocio entre puntos activos que se solapan en el
      // mismo grupo (mala configuración de la institución) — created_at ASC
      // es un criterio arbitrario, elegido solo para que el resultado sea
      // determinista/reproducible, no porque tenga significado de negocio.
      .orderBy('deliveryPoint.created_at', 'ASC')
      .getOne();
    return match?.id ?? null;
  }

  private async insertWithUniqueDeliveryCode(
    enrollment: Enrollment,
    userId: string,
    deliveryPointId: string | null,
    arrivalMode: CreatePickupRequestDto['arrivalMode'] | null,
    vehicleSnapshot: VehicleSnapshot,
  ): Promise<PickupRequest> {
    for (let attempt = 0; attempt < MAX_DELIVERY_CODE_ATTEMPTS; attempt++) {
      const deliveryCode = randomDeliveryCode();
      try {
        return await this.dataSource.transaction(async (manager) => {
          const pickupRequestsRepo = manager.getRepository(PickupRequest);
          const statusHistoryRepo = manager.getRepository(PickupRequestStatusHistory);

          const created = await pickupRequestsRepo.save(
            pickupRequestsRepo.create({
              enrollment: { id: enrollment.id } as Enrollment,
              institution: { id: enrollment.institutionId } as Institution,
              guardian: { id: userId },
              deliveryPoint: deliveryPointId ? { id: deliveryPointId } : null,
              status: 'en_route',
              deliveryCode,
              arrivalMode: arrivalMode ?? null,
              vehicle: vehicleSnapshot.vehicle,
              vehicleDescription: vehicleSnapshot.vehicleDescription,
              vehiclePlate: vehicleSnapshot.vehiclePlate,
            }),
          );

          await statusHistoryRepo.save(
            statusHistoryRepo.create({
              pickupRequest: created,
              status: 'en_route',
              changedBy: { id: userId } as User,
            }),
          );

          return created;
        });
      } catch (error) {
        if (isUniqueViolation(error, 'IDX_pickup_requests_active_delivery_code_per_institution')) {
          continue;
        }
        if (isUniqueViolation(error, 'IDX_pickup_requests_active_per_enrollment')) {
          throw new UnprocessableEntityException(ACTIVE_PICKUP_REQUEST_EXISTS);
        }
        throw error;
      }
    }
    throw new Error(
      `Could not generate a unique delivery_code after ${MAX_DELIVERY_CODE_ATTEMPTS} attempts.`,
    );
  }

  private async publishRealtimeUpdate(
    pickupRequest: PickupRequest,
    enrollment: Enrollment,
    deliveryPointId: string | null,
  ): Promise<void> {
    const snapshot: PickupRequestRealtimeSnapshot = {
      pickupRequestId: pickupRequest.id,
      status: pickupRequest.status,
      studentFullName: enrollment.student.fullName,
      gradeOrGroup: enrollment.gradeOrGroup,
      deliveryPointId,
      estimatedArrivalAt: pickupRequest.estimatedArrivalAt
        ? pickupRequest.estimatedArrivalAt.toISOString()
        : null,
      etaSeconds: pickupRequest.etaSeconds ?? null,
      arrivalMode: pickupRequest.arrivalMode,
      vehicleDescription: pickupRequest.vehicleDescription,
      vehiclePlate: pickupRequest.vehiclePlate,
      deliveryCode: pickupRequest.deliveryCode,
      updatedAt: pickupRequest.updatedAt.toISOString(),
    };

    try {
      await this.mqttClient.publish(
        boardTopic(enrollment.institutionId),
        buildBoardPayload(snapshot),
        1,
      );
      if (deliveryPointId) {
        await this.mqttClient.publish(
          deliveryPointQueueTopic(enrollment.institutionId, deliveryPointId),
          buildQueuePayload(snapshot),
          1,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to publish pickup_request ${pickupRequest.id} creation to MQTT`,
        error as Error,
      );
    }
  }

  private toResponse(pickupRequest: PickupRequest): PickupRequestResponse {
    return {
      id: pickupRequest.id,
      enrollmentId: pickupRequest.enrollment.id,
      institutionId: pickupRequest.institution.id,
      guardianUserId: pickupRequest.guardian.id,
      deliveryPointId: pickupRequest.deliveryPoint ? pickupRequest.deliveryPoint.id : null,
      status: pickupRequest.status,
      deliveryCode: pickupRequest.deliveryCode,
      arrivalMode: pickupRequest.arrivalMode,
      vehicleDescription: pickupRequest.vehicleDescription,
      vehiclePlate: pickupRequest.vehiclePlate,
      startedAt: pickupRequest.startedAt.toISOString(),
    };
  }

  private toDetailResponse(pickupRequest: PickupRequest): PickupRequestDetailResponse {
    return {
      id: pickupRequest.id,
      enrollmentId: pickupRequest.enrollment.id,
      institutionId: pickupRequest.institution.id,
      guardianUserId: pickupRequest.guardian.id,
      deliveryPointId: pickupRequest.deliveryPoint ? pickupRequest.deliveryPoint.id : null,
      status: pickupRequest.status,
      deliveryCode: pickupRequest.deliveryCode,
      arrivalMode: pickupRequest.arrivalMode,
      vehicleDescription: pickupRequest.vehicleDescription,
      vehiclePlate: pickupRequest.vehiclePlate,
      estimatedArrivalAt: pickupRequest.estimatedArrivalAt
        ? pickupRequest.estimatedArrivalAt.toISOString()
        : null,
      etaSeconds: pickupRequest.etaSeconds,
      startedAt: pickupRequest.startedAt.toISOString(),
      completedAt: pickupRequest.completedAt ? pickupRequest.completedAt.toISOString() : null,
    };
  }

  private toSummary(pickupRequest: PickupRequest): PickupRequestSummary {
    return {
      id: pickupRequest.id,
      status: pickupRequest.status,
      startedAt: pickupRequest.startedAt.toISOString(),
      completedAt: pickupRequest.completedAt ? pickupRequest.completedAt.toISOString() : null,
      deliveryPointId: pickupRequest.deliveryPoint ? pickupRequest.deliveryPoint.id : null,
    };
  }

  /**
   * Field for field the same object `buildQueuePayload` publishes over MQTT
   * (ADR-051 pt.3) — keep the two in step: a field added to one and not the
   * other reintroduces exactly the snapshot/delta mismatch this shape exists
   * to remove.
   */
  private toQueueSummary(pickupRequest: PickupRequest): PickupRequestQueueSummary {
    return {
      pickupRequestId: pickupRequest.id,
      status: pickupRequest.status,
      studentFullName: pickupRequest.enrollment.student.fullName,
      gradeOrGroup: pickupRequest.enrollment.gradeOrGroup,
      vehicleDescription: pickupRequest.vehicleDescription,
      vehiclePlate: pickupRequest.vehiclePlate,
      deliveryCode: pickupRequest.deliveryCode,
      estimatedArrivalAt: pickupRequest.estimatedArrivalAt
        ? pickupRequest.estimatedArrivalAt.toISOString()
        : null,
      etaSeconds: pickupRequest.etaSeconds,
      updatedAt: pickupRequest.updatedAt.toISOString(),
    };
  }
}
