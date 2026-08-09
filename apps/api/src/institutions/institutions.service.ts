import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EMAIL_PROVIDER, type EmailProvider } from '@casillego/shared';
import type { InstitutionStatus } from '@casillego/shared';
import { AuditLog, Institution, InstitutionMember, type User } from '@casillego/shared/entities';
import { generateUniqueJoinCode, randomJoinCodeSuffix } from '../auth/join-code.util';
import { isUniqueViolation } from '../common/db-errors.util';
import { geoPointToLatLng, latLngToGeoPoint } from './geo-point.mapper';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import type {
  GetInstitutionResponse,
  InstitutionStatusResponse,
  RegenerateJoinCodeResponse,
  UpdateInstitutionResponse,
} from './dto/responses';

const MAX_JOIN_CODE_SAVE_ATTEMPTS = 5;

const INVALID_STATUS_TRANSITION = {
  code: 'INVALID_STATUS_TRANSITION',
  message: 'The institution is not in a status that allows this transition.',
} as const;

type InstitutionTransitionEmailKind =
  'institution_approved' | 'institution_suspended' | 'institution_reactivated';

interface InstitutionTransition {
  from: InstitutionStatus;
  to: InstitutionStatus;
  /** `entity.verb`, ADR-018 point 9. */
  action: string;
  emailKind: InstitutionTransitionEmailKind;
}

/**
 * The whole state machine of `institutions.status` (ADR-018 point 1). Three
 * entries, one per endpoint: `reactivate` is its own transition rather than a
 * reuse of `approve` — same destination, different origin and a different
 * audit trail (ADR-040 point 6).
 */
const TRANSITIONS = {
  approve: {
    from: 'pending',
    to: 'approved',
    action: 'institution.approved',
    emailKind: 'institution_approved',
  },
  suspend: {
    from: 'approved',
    to: 'suspended',
    action: 'institution.suspended',
    emailKind: 'institution_suspended',
  },
  reactivate: {
    from: 'suspended',
    to: 'approved',
    action: 'institution.reactivated',
    emailKind: 'institution_reactivated',
  },
} as const satisfies Record<string, InstitutionTransition>;

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionsRepository: Repository<Institution>,
    @InjectRepository(InstitutionMember)
    private readonly institutionMembersRepository: Repository<InstitutionMember>,
    private readonly dataSource: DataSource,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  async get(id: string): Promise<GetInstitutionResponse> {
    const institution = await this.findOrFail(id);
    return {
      id: institution.id,
      name: institution.name,
      type: institution.type,
      category: institution.category,
      address: institution.address,
      location: geoPointToLatLng(institution.location),
      geofenceRadiusMeters: institution.geofenceRadiusMeters,
      activationRadiusMeters: institution.activationRadiusMeters,
      timezone: institution.timezone,
      cctCode: institution.cctCode,
      levels: institution.levels,
      arrivalToleranceMinutes: institution.arrivalToleranceMinutes,
      advanceNoticeMinutes: institution.advanceNoticeMinutes,
      arrivingLeadMinutes: institution.arrivingLeadMinutes,
      joinCode: institution.joinCode,
      status: institution.status,
    };
  }

  async update(id: string, dto: UpdateInstitutionDto): Promise<UpdateInstitutionResponse> {
    const institution = await this.findOrFail(id);

    if (institution.status !== 'approved') {
      throw new ConflictException({
        code: 'INSTITUTION_NOT_APPROVED',
        message: 'The institution profile can only be edited while its status is approved.',
      });
    }

    const nextCategory = dto.category !== undefined ? dto.category : institution.category;
    if (nextCategory && institution.type === 'school') {
      throw new ConflictException({
        code: 'CATEGORY_NOT_ALLOWED_FOR_TYPE',
        message: 'category can only be set on institutions with type = extracurricular.',
      });
    }

    if (dto.name !== undefined) institution.name = dto.name;
    if (dto.category !== undefined) institution.category = dto.category;
    if (dto.address !== undefined) institution.address = dto.address;
    if (dto.location !== undefined) institution.location = latLngToGeoPoint(dto.location);
    if (dto.geofenceRadiusMeters !== undefined) {
      institution.geofenceRadiusMeters = dto.geofenceRadiusMeters;
    }
    if (dto.activationRadiusMeters !== undefined) {
      institution.activationRadiusMeters = dto.activationRadiusMeters;
    }
    if (dto.timezone !== undefined) institution.timezone = dto.timezone;
    if (dto.cctCode !== undefined) institution.cctCode = dto.cctCode;
    if (dto.levels !== undefined) institution.levels = dto.levels;
    if (dto.arrivalToleranceMinutes !== undefined) {
      institution.arrivalToleranceMinutes = dto.arrivalToleranceMinutes;
    }
    if (dto.advanceNoticeMinutes !== undefined) {
      institution.advanceNoticeMinutes = dto.advanceNoticeMinutes;
    }
    if (dto.arrivingLeadMinutes !== undefined) {
      institution.arrivingLeadMinutes = dto.arrivingLeadMinutes;
    }

    const saved = await this.institutionsRepository.save(institution);

    return {
      id: saved.id,
      name: saved.name,
      category: saved.category,
      address: saved.address,
      location: geoPointToLatLng(saved.location),
      geofenceRadiusMeters: saved.geofenceRadiusMeters,
      activationRadiusMeters: saved.activationRadiusMeters,
      timezone: saved.timezone,
      cctCode: saved.cctCode,
      levels: saved.levels,
      arrivalToleranceMinutes: saved.arrivalToleranceMinutes,
      advanceNoticeMinutes: saved.advanceNoticeMinutes,
      arrivingLeadMinutes: saved.arrivingLeadMinutes,
      status: saved.status,
    };
  }

  async regenerateJoinCode(id: string): Promise<RegenerateJoinCodeResponse> {
    const institution = await this.findOrFail(id);

    const baseJoinCode = await generateUniqueJoinCode(institution.name, (candidate) =>
      this.institutionsRepository.exists({ where: { joinCode: candidate } }),
    );

    let candidate = baseJoinCode;
    for (let attempt = 0; attempt <= MAX_JOIN_CODE_SAVE_ATTEMPTS; attempt++) {
      try {
        institution.joinCode = candidate;
        await this.institutionsRepository.save(institution);
        return { id: institution.id, joinCode: institution.joinCode };
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_JOIN_CODE_SAVE_ATTEMPTS) {
          candidate = `${baseJoinCode}-${randomJoinCodeSuffix()}`;
          continue;
        }
        throw error;
      }
    }
    /* istanbul ignore next -- loop above always returns or throws */
    throw new Error('Could not regenerate join_code: retries exhausted.');
  }

  /** `pending → approved` (feature 025). Super-admin only. */
  approve(id: string, actorUserId: string): Promise<InstitutionStatusResponse> {
    return this.transition(id, actorUserId, TRANSITIONS.approve);
  }

  /** `approved → suspended` (feature 025). Super-admin only. */
  suspend(id: string, actorUserId: string): Promise<InstitutionStatusResponse> {
    return this.transition(id, actorUserId, TRANSITIONS.suspend);
  }

  /** `suspended → approved` (feature 025). Super-admin only. */
  reactivate(id: string, actorUserId: string): Promise<InstitutionStatusResponse> {
    return this.transition(id, actorUserId, TRANSITIONS.reactivate);
  }

  private async transition(
    id: string,
    actorUserId: string,
    transition: InstitutionTransition,
  ): Promise<InstitutionStatusResponse> {
    const institution = await this.findOrFail(id);
    if (institution.status !== transition.from) {
      throw new ConflictException(INVALID_STATUS_TRANSITION);
    }

    // Status change and audit row commit together: an unaudited transition is
    // as wrong as an unapplied one. The email is outside on purpose.
    const saved = await this.dataSource.transaction(async (manager) => {
      const institutionsRepo = manager.getRepository(Institution);
      const auditRepo = manager.getRepository(AuditLog);

      institution.status = transition.to;
      const saved = await institutionsRepo.save(institution);

      await auditRepo.save(
        auditRepo.create({
          actor: { id: actorUserId } as User,
          action: transition.action,
          entityType: 'institution',
          entityId: saved.id,
          metadata: null,
        }),
      );

      return saved;
    });

    await this.notifyInstitutionAdmins(saved, transition.emailKind);

    return { id: saved.id, status: saved.status };
  }

  /**
   * Every `institution_members` with `role = admin` gets the notice — there can
   * be more than one (ADR-040 point 4). Best-effort, one failure at a time: the
   * transition already committed, and a bounced address for one admin must not
   * cost the other admins their email. Same policy as
   * `EnrollmentsService.approve`.
   */
  private async notifyInstitutionAdmins(
    institution: Institution,
    kind: InstitutionTransitionEmailKind,
  ): Promise<void> {
    const admins = await this.institutionMembersRepository.find({
      where: { institution: { id: institution.id }, role: 'admin' },
      relations: { user: true },
    });

    for (const admin of admins) {
      try {
        await this.emailProvider.send({
          kind,
          to: admin.user.email,
          institutionName: institution.name,
        });
      } catch {
        // Deliberately swallowed, see the doc comment above.
      }
    }
  }

  private async findOrFail(id: string): Promise<Institution> {
    const institution = await this.institutionsRepository.findOne({ where: { id } });
    if (!institution) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'The requested resource does not exist.',
      });
    }
    return institution;
  }
}
