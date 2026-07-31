import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EMAIL_PROVIDER, type EmailProvider, type InstitutionMemberRole } from '@casillego/shared';
import { InstitutionMember, Institution, User, AuditLog } from '@casillego/shared/entities';
import {
  ActivationTokenService,
  type ActivationTokenPayload,
} from '../auth/activation-token.service';
import { hashPassword } from '../auth/password.util';
import { isUniqueViolation } from '../common/db-errors.util';
import { InviteInstitutionMemberDto } from './dto/invite-institution-member.dto';
import { UpdateInstitutionMemberDto } from './dto/update-institution-member.dto';
import type {
  InstitutionMemberResponse,
  InviteInstitutionMemberResponse,
  ListInstitutionMembersResponse,
  ListMyMembershipsResponse,
} from './dto/responses';

const RESOURCE_NOT_FOUND = {
  code: 'RESOURCE_NOT_FOUND',
  message: 'The requested resource does not exist.',
} as const;

const INVALID_INVITATION_TOKEN = {
  code: 'INVALID_INVITATION_TOKEN',
  message: 'This invitation token is invalid or malformed.',
} as const;

const INSTITUTION_MEMBER_ALREADY_ACTIVE = {
  code: 'INSTITUTION_MEMBER_ALREADY_ACTIVE',
  message: 'This user is already an active member of this institution.',
} as const;

@Injectable()
export class InstitutionMembersService {
  constructor(
    @InjectRepository(InstitutionMember)
    private readonly institutionMembersRepository: Repository<InstitutionMember>,
    @InjectRepository(Institution)
    private readonly institutionsRepository: Repository<Institution>,
    private readonly dataSource: DataSource,
    private readonly activationTokenService: ActivationTokenService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  async list(institutionId: string): Promise<ListInstitutionMembersResponse> {
    const members = await this.institutionMembersRepository.find({
      where: { institution: { id: institutionId } },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });

    return {
      members: members.map((member) => ({
        id: member.id,
        institutionId: member.institutionId,
        userId: member.user.id,
        role: member.role,
        fullName: member.user.fullName,
        email: member.user.email,
        userStatus: member.user.status,
        createdAt: member.createdAt.toISOString(),
      })),
    };
  }

  /**
   * The authenticated user's own memberships (ADR-041). No InstitutionMembershipGuard
   * on this route — it is the endpoint that resolves which institution the guard
   * would check, so requiring it would be circular. An empty array is a valid
   * answer (e.g. a pure guardian who opened the institution portal by mistake),
   * never a 404.
   */
  async listMine(userId: string): Promise<ListMyMembershipsResponse> {
    const memberships = await this.institutionMembersRepository.find({
      where: { user: { id: userId } },
      relations: { institution: true },
      order: { createdAt: 'ASC' },
    });

    return {
      memberships: memberships.map((membership) => ({
        institutionId: membership.institution.id,
        institutionName: membership.institution.name,
        role: membership.role,
        institutionStatus: membership.institution.status,
      })),
    };
  }

  async invite(
    institutionId: string,
    actorUserId: string,
    dto: InviteInstitutionMemberDto,
  ): Promise<InviteInstitutionMemberResponse> {
    const institution = await this.institutionsRepository.findOneBy({ id: institutionId });
    if (!institution) {
      // Invariant: InstitutionMembershipGuard already confirmed the actor is
      // a member of this institution on this route, so it must exist.
      throw new Error(
        'Invariant violated: institution must exist for a route guarded by InstitutionMembershipGuard.',
      );
    }

    const { member, user, userStatus, invitationSent } = await this.dataSource.transaction(
      async (manager) => {
        const usersRepo = manager.getRepository(User);
        const membersRepo = manager.getRepository(InstitutionMember);
        const auditRepo = manager.getRepository(AuditLog);

        let user = await usersRepo.findOneBy({ email: dto.email });

        if (!user) {
          try {
            user = await usersRepo.save(
              usersRepo.create({
                email: dto.email,
                passwordHash: null,
                // full_name is nullable (ADR-030, same pattern as
                // password_hash) — the real value is only known when this
                // person accepts via POST /invitations/:token/accept.
                fullName: null,
                phone: null,
                status: 'invited',
                isSuperAdmin: false,
              }),
            );
          } catch (error) {
            if (isUniqueViolation(error)) {
              throw new ConflictException(INSTITUTION_MEMBER_ALREADY_ACTIVE);
            }
            throw error;
          }

          const member = await this.createMembership(membersRepo, institutionId, user, dto.role);
          await this.auditMemberAdded(auditRepo, actorUserId, member.id);
          return { member, user, userStatus: 'invited' as const, invitationSent: true };
        }

        const existingMembership = await membersRepo.findOne({
          where: { institution: { id: institutionId }, user: { id: user.id } },
        });

        if (existingMembership) {
          if (user.status === 'active') {
            throw new ConflictException(INSTITUTION_MEMBER_ALREADY_ACTIVE);
          }
          // Resend (ADR-022 point 5): user is still invited and already has a
          // membership row here — reissue the token/email below, do not
          // create a duplicate row or a new audit entry.
          return {
            member: existingMembership,
            user,
            userStatus: 'invited' as const,
            invitationSent: true,
          };
        }

        const member = await this.createMembership(membersRepo, institutionId, user, dto.role);
        await this.auditMemberAdded(auditRepo, actorUserId, member.id);
        const userStatus: 'active' | 'invited' = user.status === 'active' ? 'active' : 'invited';
        return { member, user, userStatus, invitationSent: userStatus === 'invited' };
      },
    );

    if (invitationSent) {
      const token = this.activationTokenService.issue({
        sub: user.id,
        kind: 'institution_member_invitation',
        institutionMemberId: member.id,
      });
      try {
        await this.emailProvider.send({
          kind: 'institution_member_invitation',
          to: user.email,
          token,
          institutionName: institution.name,
        });
      } catch {
        // Same policy as auth.service.ts / student-guardians.service.ts: a
        // transient email outage must not fail the invite — the membership
        // was already created.
      }
    }

    return {
      member: {
        id: member.id,
        institutionId,
        userId: user.id,
        role: member.role,
      },
      userStatus,
      invitationSent,
    };
  }

  async updateRole(
    id: string,
    actorUserId: string,
    dto: UpdateInstitutionMemberDto,
  ): Promise<InstitutionMemberResponse> {
    const target = await this.institutionMembersRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!target) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }

    if (target.role === 'admin' && dto.role !== 'admin') {
      await this.assertNotLastAdmin(target.institutionId);
    }

    return this.dataSource.transaction(async (manager) => {
      const membersRepo = manager.getRepository(InstitutionMember);
      const auditRepo = manager.getRepository(AuditLog);

      target.role = dto.role;
      const saved = await membersRepo.save(target);

      await auditRepo.save(
        auditRepo.create({
          actor: { id: actorUserId } as User,
          action: 'institution_member.role_changed',
          entityType: 'institution_member',
          entityId: saved.id,
          metadata: null,
        }),
      );

      return {
        id: saved.id,
        institutionId: saved.institutionId,
        userId: saved.user.id,
        role: saved.role,
      };
    });
  }

  async remove(id: string, actorUserId: string): Promise<void> {
    const target = await this.institutionMembersRepository.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }

    if (target.role === 'admin') {
      await this.assertNotLastAdmin(target.institutionId);
    }

    // TypeORM's remove() clears the primary key off the in-memory entity, so
    // the id must be captured before the call to use it in the audit entry.
    const removedId = target.id;

    await this.dataSource.transaction(async (manager) => {
      const membersRepo = manager.getRepository(InstitutionMember);
      const auditRepo = manager.getRepository(AuditLog);

      await membersRepo.remove(target);

      await auditRepo.save(
        auditRepo.create({
          actor: { id: actorUserId } as User,
          action: 'institution_member.removed',
          entityType: 'institution_member',
          entityId: removedId,
          metadata: null,
        }),
      );
    });
  }

  async acceptInvitation(
    payload: ActivationTokenPayload,
    params: { password?: string; fullName?: string },
  ): Promise<{ status: 'active' }> {
    if (!payload.institutionMemberId) {
      throw new BadRequestException(INVALID_INVITATION_TOKEN);
    }

    await this.dataSource.transaction(async (manager) => {
      const membersRepo = manager.getRepository(InstitutionMember);
      const usersRepo = manager.getRepository(User);
      const auditRepo = manager.getRepository(AuditLog);

      const member = await membersRepo.findOne({
        where: { id: payload.institutionMemberId },
        relations: { user: true },
      });
      if (!member || member.user.id !== payload.sub) {
        throw new BadRequestException(INVALID_INVITATION_TOKEN);
      }

      const user = member.user;
      // institution_members has no status of its own (specs/entities/
      // institution_member.md) — "already accepted" is decided purely by
      // users.status, per specs/api-contracts/institution-members.md.
      if (user.status === 'active') {
        throw new ConflictException({
          code: 'INVITATION_ALREADY_ACCEPTED',
          message: 'This invitation has already been accepted.',
        });
      }

      if (!params.password || !params.fullName) {
        throw new BadRequestException({
          code: 'INVALID_PAYLOAD',
          message: 'password and fullName are required to complete this invitation.',
        });
      }
      user.passwordHash = await hashPassword(params.password);
      user.fullName = params.fullName;
      user.status = 'active';
      await usersRepo.save(user);

      await auditRepo.save(
        auditRepo.create({
          actor: user,
          action: 'institution_member.accepted',
          entityType: 'institution_member',
          entityId: member.id,
          metadata: null,
        }),
      );
    });

    return { status: 'active' };
  }

  private async createMembership(
    membersRepo: Repository<InstitutionMember>,
    institutionId: string,
    user: User,
    role: InstitutionMemberRole,
  ): Promise<InstitutionMember> {
    try {
      return await membersRepo.save(
        membersRepo.create({
          institution: { id: institutionId } as Institution,
          user,
          role,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(INSTITUTION_MEMBER_ALREADY_ACTIVE);
      }
      throw error;
    }
  }

  private async auditMemberAdded(
    auditRepo: Repository<AuditLog>,
    actorUserId: string,
    memberId: string,
  ): Promise<void> {
    await auditRepo.save(
      auditRepo.create({
        actor: { id: actorUserId } as User,
        action: 'institution_member.added',
        entityType: 'institution_member',
        entityId: memberId,
        metadata: null,
      }),
    );
  }

  private async assertNotLastAdmin(institutionId: string): Promise<void> {
    const adminCount = await this.institutionMembersRepository.count({
      where: { institution: { id: institutionId }, role: 'admin' },
    });
    if (adminCount <= 1) {
      throw new UnprocessableEntityException({
        code: 'LAST_ADMIN_PROTECTED',
        message: 'Cannot remove or demote the sole admin of this institution.',
      });
    }
  }
}
