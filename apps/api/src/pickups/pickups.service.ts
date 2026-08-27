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
  boardAnnounceTopic,
  boardMonitorTopic,
  boardTopic,
  buildBoardAnnouncePayload,
  buildBoardMonitorPayload,
  buildBoardPayload,
  buildQueuePayload,
  deliveryPointQueueTopic,
  MQTT_CLIENT,
  type MqttClient,
  pickupLocationTopic,
  type PickupRequestRealtimeSnapshot,
  type PickupRequestStatus,
  PUSH_PROVIDER,
  type PushProvider,
  type StudentGuardianRelationship,
} from '@casillego/shared';
import {
  applyPickupRequestTransition,
  InvalidStatusTransitionError,
} from '@casillego/shared/pickup-request-transition';
import { isUniqueViolation } from '../common/db-errors.util';
import { DeliveryPointAccessService } from '../delivery-points/delivery-point-access.service';
import { geoPointToLatLng } from '../institutions/geo-point.mapper';
import { InstitutionAccessService } from '../institutions/institution-access.service';
import {
  AuditLog,
  DeliveryPoint,
  Enrollment,
  Institution,
  InstitutionMember,
  PickupRequest,
  PickupRequestStatusHistory,
  PushSubscription,
  StudentGuardian,
  type User,
  Vehicle,
} from '@casillego/shared/entities';
import { randomDeliveryCode } from './delivery-code.util';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import type { ListPickupRequestsQueryDto } from './dto/list-pickup-requests-query.dto';
import type { SendLocationDto } from './dto/send-location.dto';
import type {
  DeliveredTodayGroupCount,
  DeliveredTodayResponse,
  ListDeliveryPointQueueResponse,
  ListPickupRequestsBoardMonitorResponse,
  ListPickupRequestsBoardResponse,
  ListPickupRequestsResponse,
  PickupRequestArrivedResponse,
  PickupRequestBoardMonitorSummary,
  PickupRequestBoardSummary,
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

const ACTIVE_STATUSES = ['en_route', 'approaching', 'arriving', 'arrived'] as const;

// Defensive fallback for the delivery-confirmed push notification (ADR-066
// pt.5): used only if pickup_request.guardian.fullName is somehow null,
// which should not happen in practice (an active guardian always has a
// full_name, ADR-030) but the code must not assume that invariant blindly.
const RELATIONSHIP_FALLBACK_LABELS: Record<StudentGuardianRelationship, string> = {
  mother: 'su madre',
  father: 'su padre',
  grandparent: 'su abuelo/a',
  driver: 'su chofer',
  other: 'un tutor autorizado',
};

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
    @InjectRepository(PushSubscription)
    private readonly pushSubscriptionsRepository: Repository<PushSubscription>,
    private readonly dataSource: DataSource,
    @Inject(MQTT_CLIENT) private readonly mqttClient: MqttClient,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
    private readonly deliveryPointAccess: DeliveryPointAccessService,
    private readonly institutionAccess: InstitutionAccessService,
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
      // guardian: true feeds toQueueSummary's guardianFullName (enmienda a
      // ADR-073), same relation listByInstitutionMonitor already loads for
      // the analogous Carril field.
      relations: { enrollment: { student: true, group: true }, guardian: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    const summaries = await Promise.all(
      pickupRequests.map((pickupRequest) => this.toQueueSummary(pickupRequest)),
    );

    return {
      pickupRequests: summaries,
      limit,
      offset,
      total,
    };
  }

  /**
   * Aggregate board feed of a whole institution: the REST snapshot the
   * board kiosk starts from, before the WebSocket bridge takes over with
   * deltas (ADR-068 pt.2). Same shape as `listByDeliveryPoint` otherwise:
   * institution_member-only authorization (no guardian side — the board has
   * no individual-student perspective), active statuses only, never history.
   *
   * Its rows are `PickupRequestBoardSummary`, field for field the same as
   * `buildBoardPayload()` publishes — no `deliveryCode` (ADR-051), unlike
   * `PickupRequestQueueSummary` — so the board merges both without
   * transforming either.
   */
  async listByInstitution(
    userId: string,
    query: ListPickupRequestsQueryDto & { institutionId: string },
  ): Promise<ListPickupRequestsBoardResponse> {
    const access = await this.institutionAccess.checkMemberAccess(query.institutionId, userId);
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
        institution: { id: query.institutionId },
        // Same narrowing-not-widening rule as listByDeliveryPoint: `status`
        // intersects the active set, it never reaches into history.
        status: In(
          query.status ? ACTIVE_STATUSES.filter((s) => s === query.status) : ACTIVE_STATUSES,
        ),
      },
      // deliveryPointId is part of PickupRequestBoardSummary (mirrors
      // PickupRequestBoardPayload) — without this relation loaded it stays
      // unpopulated and every row would wrongly report deliveryPointId: null.
      relations: { enrollment: { student: true, group: true }, deliveryPoint: true },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return {
      pickupRequests: pickupRequests.map((pickupRequest) => this.toBoardSummary(pickupRequest)),
      limit,
      offset,
      total,
    };
  }

  /**
   * Carril (staff monitor view, ADR-071 pt.2): same rows as `listByInstitution`
   * plus guardian/vehicle data — never used without `view=monitor` explicit
   * (`ListPickupRequestsQueryDto`). Same authorization, same active-statuses-
   * only rule; the only differences are the extra `guardian: true` relation
   * and the per-row `guardianRelationship` resolution below.
   */
  async listByInstitutionMonitor(
    userId: string,
    query: ListPickupRequestsQueryDto & { institutionId: string },
  ): Promise<ListPickupRequestsBoardMonitorResponse> {
    const access = await this.institutionAccess.checkMemberAccess(query.institutionId, userId);
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
        institution: { id: query.institutionId },
        status: In(
          query.status ? ACTIVE_STATUSES.filter((s) => s === query.status) : ACTIVE_STATUSES,
        ),
      },
      relations: {
        enrollment: { student: true, group: true },
        deliveryPoint: true,
        guardian: true,
      },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    const summaries = await Promise.all(
      pickupRequests.map((pickupRequest) => this.toBoardMonitorSummary(pickupRequest)),
    );

    return { pickupRequests: summaries, limit, offset, total };
  }

  /**
   * Dashboard's "Entregados hoy"/"Por nivel" baseline (ADR-072 §6 amendment):
   * same `status = 'delivered' AND completedAt BETWEEN :start AND :end`
   * query `InstitutionReportsService.get()` already proves for `period =
   * 'today'`, but not reused as-is — that endpoint requires `role = admin`
   * (ADR-060 pt.6), while the Dashboard is visible to any
   * `institution_member` (ADR-071 pt.1). `asOf` is captured once, before the
   * query runs, and reused as both the query's upper bound and the response
   * field the client uses to de-duplicate against live deltas.
   */
  async getDeliveredToday(institutionId: string): Promise<DeliveredTodayResponse> {
    const asOf = new Date();
    const startOfToday = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate(), 0, 0, 0, 0);

    const deliveredPickups = await this.pickupRequestsRepository
      .createQueryBuilder('pickup')
      .innerJoinAndSelect('pickup.enrollment', 'enrollment')
      .leftJoinAndSelect('enrollment.group', 'group')
      .where('pickup.institution = :institutionId', { institutionId })
      .andWhere('pickup.status = :status', { status: 'delivered' })
      .andWhere('pickup.completedAt BETWEEN :start AND :end', {
        start: startOfToday,
        end: asOf,
      })
      .getMany();

    return {
      asOf: asOf.toISOString(),
      total: deliveredPickups.length,
      byGroup: this.groupDeliveredByGrade(deliveredPickups),
    };
  }

  private groupDeliveredByGrade(pickups: readonly PickupRequest[]): DeliveredTodayGroupCount[] {
    const counts = new Map<string, number>();
    for (const pickup of pickups) {
      const label = pickup.enrollment.group?.name ?? 'Sin grupo';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es-MX'));
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

    // Best-effort, outside the transaction that already committed the
    // delivered transition — same policy as EnrollmentsService.approve()'s
    // email send (ADR-066 pt.4): a notification failure must never revert or
    // affect the response of an already-successful delivery.
    await this.notifyOtherGuardiansOfDelivery(updated);

    return {
      id: updated.id,
      status: updated.status,
      completedAt: updated.completedAt!.toISOString(),
    };
  }

  // ADR-073: "vocear" is ephemeral — no status transition, no persisted row.
  // Only side effects are the audit_log entry (traceability of who announced
  // whom, when) and a best-effort MQTT publish to the board's second
  // channel, same failure policy as publishRealtimeUpdate.
  async announce(userId: string, id: string): Promise<void> {
    const pickupRequest = await this.findPickupRequestOrFail(id);

    if (pickupRequest.status === 'delivered' || pickupRequest.status === 'cancelled') {
      throw new ConflictException(INVALID_STATUS_TRANSITION);
    }

    const announcedAt = new Date();

    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        actor: { id: userId } as User,
        action: 'pickup_request.announced',
        entityType: 'pickup_request',
        entityId: pickupRequest.id,
        metadata: null,
      }),
    );

    try {
      await this.mqttClient.publish(
        boardAnnounceTopic(pickupRequest.institutionId),
        buildBoardAnnouncePayload(
          pickupRequest.id,
          pickupRequest.enrollment.student.fullName,
          announcedAt,
        ),
        1,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish pickup_request ${pickupRequest.id} announce to MQTT`,
        error as Error,
      );
    }
  }

  private async findPickupRequestOrFail(id: string): Promise<PickupRequest> {
    const pickupRequest = await this.pickupRequestsRepository.findOne({
      where: { id },
      relations: {
        guardian: true,
        institution: true,
        enrollment: { student: true, group: true },
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

  // ADR-071 pt.2: same student_guardians lookup already used by
  // notifyOtherGuardiansOfDelivery (ADR-066 pt.5) to resolve the
  // guardian-student link — reused here for the Carril payload
  // (guardianFullName/guardianRelationship), shared between
  // listByInstitutionMonitor and publishRealtimeUpdate so the query isn't
  // duplicated. Returns both fields from a single query rather than trusting
  // pickup_request.guardian to already carry a loaded fullName, which is not
  // reliably true (the entity `create()` just saved only has a `{ id }`
  // reference for guardian). Defensive fallbacks: a missing link should never
  // happen in practice (a pickup_request's guardian always has an active
  // link), but must never throw and break a realtime publish.
  private async resolveGuardianRelationship(
    studentId: string,
    guardianId: string,
  ): Promise<{ relationship: StudentGuardianRelationship; guardianFullName: string }> {
    const link = await this.studentGuardiansRepository.findOne({
      where: { student: { id: studentId }, guardian: { id: guardianId } },
      relations: { guardian: true },
    });
    return {
      relationship: link?.relationship ?? 'other',
      guardianFullName: link?.guardian?.fullName ?? '',
    };
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

  // ADR-066: notifies the OTHER active guardians of the student that the
  // pickup was completed — not the guardian who performed it, who already
  // saw the transition in real time on their own tracking screen (ADR-064).
  // Best-effort: a subscription/send failure for one recipient is logged and
  // must not stop the rest, nor ever surface to the deliver() caller.
  private async notifyOtherGuardiansOfDelivery(pickupRequest: PickupRequest): Promise<void> {
    const guardianLinks = await this.studentGuardiansRepository.find({
      where: { student: { id: pickupRequest.enrollment.student.id } },
      relations: { guardian: true },
    });

    const recipients = guardianLinks
      .filter(
        (link) =>
          link.status === 'active' &&
          link.guardian.id !== pickupRequest.guardian.id &&
          link.guardian.notifyDeliveryConfirmed,
      )
      .map((link) => link.guardian);
    if (recipients.length === 0) {
      return;
    }

    const subscriptions = await this.pushSubscriptionsRepository.find({
      where: { user: { id: In(recipients.map((guardian) => guardian.id)) } },
    });
    if (subscriptions.length === 0) {
      return;
    }

    const ownerLink = guardianLinks.find((link) => link.guardian.id === pickupRequest.guardian.id);
    const guardianLabel =
      pickupRequest.guardian.fullName ??
      RELATIONSHIP_FALLBACK_LABELS[ownerLink?.relationship ?? 'other'];
    const payload = {
      title: 'Entrega confirmada',
      body: `${pickupRequest.enrollment.student.fullName} fue recogido por ${guardianLabel}.`,
    };

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await this.pushProvider.send(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dhKey, auth: subscription.authKey },
            },
            payload,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send delivery-confirmed push notification for pickup_request ${pickupRequest.id} to push_subscription ${subscription.id}`,
            error as Error,
          );
        }
      }),
    );
  }

  private async findEnrollmentOrFail(enrollmentId: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { id: enrollmentId },
      relations: { student: true, institution: true, group: true },
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
    const activePoints = await this.deliveryPointsRepository.find({
      where: { institution: { id: enrollment.institutionId }, status: 'active' },
      relations: { deliveryPointGroups: true },
      order: { createdAt: 'ASC' },
    });

    if (enrollment.groupId) {
      const exactMatch = activePoints.find((point) =>
        point.deliveryPointGroups.some((dpg) => dpg.groupId === enrollment.groupId),
      );
      if (exactMatch) return exactMatch.id;
    }

    // Atrapa-todo: cubre tanto al alumno sin grupo (groupId === null) como al
    // que tiene un grupo que no está configurado en ningún punto activo
    // (reconfiguración que dejó huérfano al grupo). Único por construcción —
    // DeliveryPointsService lo garantiza al crear/editar
    // (assertNoGroupConflicts, ADR-083), así que no hay ambigüedad de cuál
    // usar. Comparación por id, no por string (ADR-084).
    const catchAll = activePoints.find((point) => point.deliveryPointGroups.length === 0);
    return catchAll?.id ?? null;
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
    const { relationship, guardianFullName } = await this.resolveGuardianRelationship(
      enrollment.student.id,
      pickupRequest.guardian.id,
    );

    const snapshot: PickupRequestRealtimeSnapshot = {
      pickupRequestId: pickupRequest.id,
      status: pickupRequest.status,
      studentFullName: enrollment.student.fullName,
      gradeOrGroup: enrollment.group?.name ?? null,
      deliveryPointId,
      estimatedArrivalAt: pickupRequest.estimatedArrivalAt
        ? pickupRequest.estimatedArrivalAt.toISOString()
        : null,
      etaSeconds: pickupRequest.etaSeconds ?? null,
      arrivalMode: pickupRequest.arrivalMode,
      vehicleDescription: pickupRequest.vehicleDescription,
      vehiclePlate: pickupRequest.vehiclePlate,
      deliveryCode: pickupRequest.deliveryCode,
      guardianFullName,
      guardianRelationship: relationship,
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
      await this.mqttClient.publish(
        boardMonitorTopic(enrollment.institutionId),
        buildBoardMonitorPayload(snapshot),
        1,
      );
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
      institutionLocation: geoPointToLatLng(pickupRequest.institution.location),
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
   * to remove. `guardianFullName`/`guardianRelationship` follow the enmienda
   * a ADR-073: same resolution as `toBoardMonitorSummary` — `guardianFullName`
   * straight off the `guardian: true` relation `listByDeliveryPoint` loads,
   * only `guardianRelationship` needs the per-row `student_guardians` lookup.
   */
  private async toQueueSummary(pickupRequest: PickupRequest): Promise<PickupRequestQueueSummary> {
    const { relationship } = await this.resolveGuardianRelationship(
      pickupRequest.enrollment.student.id,
      pickupRequest.guardian.id,
    );
    return {
      pickupRequestId: pickupRequest.id,
      status: pickupRequest.status,
      studentFullName: pickupRequest.enrollment.student.fullName,
      gradeOrGroup: pickupRequest.enrollment.group?.name ?? null,
      vehicleDescription: pickupRequest.vehicleDescription,
      vehiclePlate: pickupRequest.vehiclePlate,
      deliveryCode: pickupRequest.deliveryCode,
      estimatedArrivalAt: pickupRequest.estimatedArrivalAt
        ? pickupRequest.estimatedArrivalAt.toISOString()
        : null,
      etaSeconds: pickupRequest.etaSeconds,
      guardianFullName: pickupRequest.guardian.fullName ?? '',
      guardianRelationship: relationship,
      updatedAt: pickupRequest.updatedAt.toISOString(),
    };
  }

  /**
   * Field for field the same object `buildBoardPayload` publishes over MQTT
   * (ADR-068 pt.3) — keep the two in step, same reasoning as `toQueueSummary`
   * versus `buildQueuePayload`.
   */
  private toBoardSummary(pickupRequest: PickupRequest): PickupRequestBoardSummary {
    return {
      pickupRequestId: pickupRequest.id,
      status: pickupRequest.status,
      studentFullName: pickupRequest.enrollment.student.fullName,
      gradeOrGroup: pickupRequest.enrollment.group?.name ?? null,
      deliveryPointId: pickupRequest.deliveryPoint ? pickupRequest.deliveryPoint.id : null,
      estimatedArrivalAt: pickupRequest.estimatedArrivalAt
        ? pickupRequest.estimatedArrivalAt.toISOString()
        : null,
      etaSeconds: pickupRequest.etaSeconds,
      arrivalMode: pickupRequest.arrivalMode,
      updatedAt: pickupRequest.updatedAt.toISOString(),
    };
  }

  /**
   * Field for field the same object `buildBoardMonitorPayload` publishes over
   * MQTT (ADR-071 pt.2) — keep the two in step, same reasoning as
   * `toBoardSummary` versus `buildBoardPayload`. `guardianFullName` comes
   * straight off the `guardian: true` relation loaded by
   * `listByInstitutionMonitor` — only `guardianRelationship` needs the
   * per-row `student_guardians` lookup.
   */
  private async toBoardMonitorSummary(
    pickupRequest: PickupRequest,
  ): Promise<PickupRequestBoardMonitorSummary> {
    const { relationship } = await this.resolveGuardianRelationship(
      pickupRequest.enrollment.student.id,
      pickupRequest.guardian.id,
    );
    return {
      pickupRequestId: pickupRequest.id,
      status: pickupRequest.status,
      studentFullName: pickupRequest.enrollment.student.fullName,
      gradeOrGroup: pickupRequest.enrollment.group?.name ?? null,
      deliveryPointId: pickupRequest.deliveryPoint ? pickupRequest.deliveryPoint.id : null,
      estimatedArrivalAt: pickupRequest.estimatedArrivalAt
        ? pickupRequest.estimatedArrivalAt.toISOString()
        : null,
      etaSeconds: pickupRequest.etaSeconds,
      arrivalMode: pickupRequest.arrivalMode,
      guardianFullName: pickupRequest.guardian.fullName ?? '',
      guardianRelationship: relationship,
      vehicleDescription: pickupRequest.vehicleDescription,
      vehiclePlate: pickupRequest.vehiclePlate,
      updatedAt: pickupRequest.updatedAt.toISOString(),
    };
  }
}
