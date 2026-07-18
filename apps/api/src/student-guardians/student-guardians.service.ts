import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { EMAIL_PROVIDER, type EmailProvider } from '@casillego/shared';
import { Student, StudentGuardian, User, AuditLog } from '@casillego/shared/entities';
import {
  ActivationTokenService,
  type ActivationTokenPayload,
} from '../auth/activation-token.service';
import { hashPassword } from '../auth/password.util';
import { isUniqueViolation } from '../common/db-errors.util';
import { InviteStudentGuardianDto } from './dto/invite-student-guardian.dto';
import { UpdateStudentGuardianDto } from './dto/update-student-guardian.dto';
import type {
  InviteStudentGuardianResponse,
  ListStudentGuardiansResponse,
  UpdateStudentGuardianResponse,
} from './dto/responses';

const RESOURCE_NOT_FOUND = {
  code: 'RESOURCE_NOT_FOUND',
  message: 'The requested resource does not exist.',
} as const;

const PRIMARY_GUARDIAN_REQUIRED = {
  code: 'PRIMARY_GUARDIAN_REQUIRED',
  message: 'Only the primary, active guardian of this student can perform this action.',
} as const;

@Injectable()
export class StudentGuardiansService {
  constructor(
    @InjectRepository(Student)
    private readonly studentsRepository: Repository<Student>,
    @InjectRepository(StudentGuardian)
    private readonly studentGuardiansRepository: Repository<StudentGuardian>,
    private readonly dataSource: DataSource,
    private readonly activationTokenService: ActivationTokenService,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  async list(studentId: string, userId: string): Promise<ListStudentGuardiansResponse> {
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }

    const requesterLink = await this.studentGuardiansRepository.findOne({
      where: { student: { id: studentId }, guardian: { id: userId }, status: 'active' },
    });
    if (!requesterLink) {
      throw new ForbiddenException({
        code: 'NOT_STUDENT_GUARDIAN',
        message: 'The authenticated user is not an active guardian of this student.',
      });
    }

    const links = await this.studentGuardiansRepository.find({
      where: { student: { id: studentId } },
      relations: { guardian: true },
      order: { createdAt: 'ASC' },
    });

    return {
      guardians: links.map((link) => ({
        id: link.id,
        guardianUserId: link.guardian.id,
        fullName: link.guardian.fullName,
        email: link.guardian.email,
        relationship: link.relationship,
        isPrimary: link.isPrimary,
        status: link.status,
      })),
    };
  }

  async invite(
    studentId: string,
    userId: string,
    dto: InviteStudentGuardianDto,
  ): Promise<InviteStudentGuardianResponse> {
    const student = await this.studentsRepository.findOne({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }

    const inviterLink = await this.assertPrimaryActiveGuardian(studentId, userId);

    const { link, userStatus } = await this.dataSource.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const guardiansRepo = manager.getRepository(StudentGuardian);
      const auditRepo = manager.getRepository(AuditLog);

      let user = await usersRepo.findOneBy({ email: dto.email });
      let userStatus: 'active' | 'invited';

      if (user) {
        const existingLink = await guardiansRepo.findOne({
          where: {
            student: { id: studentId },
            guardian: { id: user.id },
            status: In(['invited', 'active']),
          },
        });
        if (existingLink) {
          throw new ConflictException({
            code: 'GUARDIAN_ALREADY_LINKED',
            message: 'This user already has a non-terminal guardian link with this student.',
          });
        }
        userStatus = user.status === 'active' ? 'active' : 'invited';
      } else {
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
            throw new ConflictException({
              code: 'GUARDIAN_ALREADY_LINKED',
              message: 'This user already has a non-terminal guardian link with this student.',
            });
          }
          throw error;
        }
        userStatus = 'invited';
      }

      let link: StudentGuardian;
      try {
        link = await guardiansRepo.save(
          guardiansRepo.create({
            student: { id: studentId } as Student,
            guardian: user,
            relationship: dto.relationship,
            isPrimary: false,
            status: 'invited',
          }),
        );
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException({
            code: 'GUARDIAN_ALREADY_LINKED',
            message: 'This user already has a non-terminal guardian link with this student.',
          });
        }
        throw error;
      }

      await auditRepo.save(
        auditRepo.create({
          actor: { id: userId } as User,
          action: 'student_guardian.added',
          entityType: 'student_guardian',
          entityId: link.id,
          metadata: null,
        }),
      );

      return { link, userStatus, user };
    });

    const token = this.activationTokenService.issue({
      sub: link.guardian.id,
      kind: 'student_guardian_invitation',
      studentGuardianId: link.id,
    });

    const inviterFullName = inviterLink.guardian.fullName;
    if (inviterFullName === null) {
      // Invariant (ADR-030, same as password_hash): status = active implies
      // full_name is not null. assertPrimaryActiveGuardian already required
      // status = active for inviterLink, so this can't happen in practice.
      throw new Error('Invariant violated: an active guardian must have full_name set.');
    }

    try {
      await this.emailProvider.send({
        kind: 'student_guardian_invitation',
        to: dto.email,
        token,
        studentName: student.fullName,
        inviterName: inviterFullName,
      });
    } catch {
      // Same policy as auth.service.ts: a transient email outage must not
      // fail the invite — the guardian link was already created.
    }

    return {
      guardian: {
        id: link.id,
        studentId,
        guardianUserId: link.guardian.id,
        relationship: link.relationship,
        isPrimary: link.isPrimary,
        status: link.status,
      },
      userStatus,
      invitationSent: true,
    };
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateStudentGuardianDto,
  ): Promise<UpdateStudentGuardianResponse> {
    if ((dto.status === undefined) === (dto.isPrimary === undefined)) {
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: 'Exactly one of status or isPrimary must be provided.',
      });
    }
    if (dto.isPrimary === false) {
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: 'isPrimary can only be set to true.',
      });
    }

    const target = await this.studentGuardiansRepository.findOne({
      where: { id },
      relations: { student: true, guardian: true },
    });
    if (!target) {
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }

    await this.assertPrimaryActiveGuardian(target.student.id, userId);

    if (dto.status === 'revoked') {
      return this.revoke(target, userId);
    }
    return this.reassignPrimary(target, userId);
  }

  async acceptInvitation(
    payload: ActivationTokenPayload,
    params: { password?: string; fullName?: string },
  ): Promise<{ status: 'active' }> {
    if (!payload.studentGuardianId) {
      throw new BadRequestException({
        code: 'INVALID_INVITATION_TOKEN',
        message: 'This invitation token is invalid or malformed.',
      });
    }

    await this.dataSource.transaction(async (manager) => {
      const guardiansRepo = manager.getRepository(StudentGuardian);
      const usersRepo = manager.getRepository(User);
      const auditRepo = manager.getRepository(AuditLog);

      const link = await guardiansRepo.findOne({
        where: { id: payload.studentGuardianId },
        relations: { guardian: true },
      });
      if (!link || link.guardian.id !== payload.sub) {
        throw new BadRequestException({
          code: 'INVALID_INVITATION_TOKEN',
          message: 'This invitation token is invalid or malformed.',
        });
      }
      if (link.status !== 'invited') {
        throw new ConflictException({
          code: 'INVITATION_ALREADY_ACCEPTED',
          message: 'This invitation has already been accepted.',
        });
      }

      const user = link.guardian;
      if (user.passwordHash === null) {
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
      }

      link.status = 'active';
      await guardiansRepo.save(link);

      await auditRepo.save(
        auditRepo.create({
          actor: user,
          action: 'student_guardian.accepted',
          entityType: 'student_guardian',
          entityId: link.id,
          metadata: null,
        }),
      );
    });

    return { status: 'active' };
  }

  private async assertPrimaryActiveGuardian(
    studentId: string,
    userId: string,
  ): Promise<StudentGuardian> {
    const link = await this.studentGuardiansRepository.findOne({
      where: {
        student: { id: studentId },
        guardian: { id: userId },
        isPrimary: true,
        status: 'active',
      },
      relations: { guardian: true },
    });
    if (!link) {
      throw new ForbiddenException(PRIMARY_GUARDIAN_REQUIRED);
    }
    return link;
  }

  private async revoke(
    target: StudentGuardian,
    actorUserId: string,
  ): Promise<UpdateStudentGuardianResponse> {
    if (target.status === 'revoked') {
      throw new ConflictException({
        code: 'ALREADY_REVOKED',
        message: 'This guardian link is already revoked.',
      });
    }
    if (target.isPrimary) {
      throw new UnprocessableEntityException({
        code: 'PRIMARY_GUARDIAN_REASSIGN_REQUIRED',
        message: 'Reassign the primary guardian before revoking it.',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const guardiansRepo = manager.getRepository(StudentGuardian);
      const auditRepo = manager.getRepository(AuditLog);

      target.status = 'revoked';
      const saved = await guardiansRepo.save(target);

      await auditRepo.save(
        auditRepo.create({
          actor: { id: actorUserId } as User,
          action: 'student_guardian.revoked',
          entityType: 'student_guardian',
          entityId: saved.id,
          metadata: null,
        }),
      );

      return this.toDetailResponse(saved);
    });
  }

  private async reassignPrimary(
    target: StudentGuardian,
    actorUserId: string,
  ): Promise<UpdateStudentGuardianResponse> {
    if (target.status !== 'active') {
      throw new UnprocessableEntityException({
        code: 'GUARDIAN_NOT_ACTIVE',
        message: 'Cannot reassign primary to a guardian that is not active.',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const guardiansRepo = manager.getRepository(StudentGuardian);
      const auditRepo = manager.getRepository(AuditLog);

      const previousPrimary = await guardiansRepo.findOne({
        where: { student: { id: target.student.id }, isPrimary: true },
      });
      if (previousPrimary && previousPrimary.id !== target.id) {
        previousPrimary.isPrimary = false;
        await guardiansRepo.save(previousPrimary);
      }
      target.isPrimary = true;
      const saved = await guardiansRepo.save(target);

      await auditRepo.save(
        auditRepo.create({
          actor: { id: actorUserId } as User,
          action: 'student_guardian.primary_reassigned',
          entityType: 'student_guardian',
          entityId: saved.id,
          metadata: null,
        }),
      );

      return this.toDetailResponse(saved);
    });
  }

  private toDetailResponse(entity: StudentGuardian): UpdateStudentGuardianResponse {
    return {
      id: entity.id,
      studentId: entity.student.id,
      guardianUserId: entity.guardian.id,
      isPrimary: entity.isPrimary,
      status: entity.status,
    };
  }
}
