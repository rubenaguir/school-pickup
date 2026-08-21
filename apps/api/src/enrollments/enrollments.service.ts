import {
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
import { isUniqueViolation } from '../common/db-errors.util';
import {
  AuditLog,
  Enrollment,
  Institution,
  InstitutionMember,
  Student,
  StudentGuardian,
  type User,
} from '@casillego/shared/entities';
import { generateUniqueEnrollmentCode } from './enrollment-code.util';
import { ApproveEnrollmentDto } from './dto/approve-enrollment.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { ListMyEnrollmentsQueryDto } from './dto/list-my-enrollments-query.dto';
import { ListInstitutionEnrollmentsQueryDto } from './dto/list-institution-enrollments-query.dto';
import type {
  EnrollmentResponse,
  InstitutionEnrollmentListItem,
  ListInstitutionEnrollmentsResponse,
  ListMyEnrollmentsResponse,
  MyEnrollmentResponse,
  ReviewEnrollmentResponse,
} from './dto/responses';

const ENROLLMENT_NOT_APPROVED = {
  code: 'ENROLLMENT_NOT_APPROVED',
  message: 'This enrollment is not approved.',
} as const;

const NOT_STUDENT_GUARDIAN = {
  code: 'NOT_STUDENT_GUARDIAN',
  message: 'The authenticated user is not an active guardian of this student.',
} as const;

const INSTITUTION_NOT_FOUND = {
  code: 'INSTITUTION_NOT_FOUND',
  message: 'No approved institution matches the given institutionId or joinCode.',
} as const;

const DUPLICATE_ENROLLMENT = {
  code: 'DUPLICATE_ENROLLMENT',
  message: 'An active or pending enrollment already exists for this student and institution.',
} as const;

const NOT_INSTITUTION_MEMBER = {
  code: 'NOT_INSTITUTION_MEMBER',
  message: 'The authenticated user is not a member of this institution.',
} as const;

const RESOURCE_NOT_FOUND = {
  code: 'RESOURCE_NOT_FOUND',
  message: 'The requested resource does not exist.',
} as const;

const ENROLLMENT_NOT_PENDING = {
  code: 'ENROLLMENT_NOT_PENDING',
  message: 'This enrollment is not pending review.',
} as const;

const INSTITUTION_NOT_APPROVED = {
  code: 'INSTITUTION_NOT_APPROVED',
  message: 'The institution is not approved.',
} as const;

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectRepository(Enrollment)
    private readonly enrollmentsRepository: Repository<Enrollment>,
    @InjectRepository(Institution)
    private readonly institutionsRepository: Repository<Institution>,
    @InjectRepository(StudentGuardian)
    private readonly studentGuardiansRepository: Repository<StudentGuardian>,
    @InjectRepository(InstitutionMember)
    private readonly institutionMembersRepository: Repository<InstitutionMember>,
    private readonly dataSource: DataSource,
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
  ) {}

  async create(userId: string, dto: CreateEnrollmentDto): Promise<EnrollmentResponse> {
    await this.assertActiveGuardian(dto.studentId, userId);
    const institution = await this.resolveApprovedInstitution(dto);

    const enrollmentCode = await generateUniqueEnrollmentCode((candidate) =>
      this.enrollmentsRepository.exists({ where: { enrollmentCode: candidate } }),
    );

    try {
      const saved = await this.enrollmentsRepository.save(
        this.enrollmentsRepository.create({
          student: { id: dto.studentId } as Student,
          institution: { id: institution.id } as Institution,
          status: 'pending',
          gradeOrGroup: dto.gradeOrGroup ?? null,
          enrollmentCode,
          requestedBy: { id: userId } as User,
        }),
      );
      return {
        id: saved.id,
        studentId: dto.studentId,
        institutionId: institution.id,
        status: saved.status,
        enrollmentCode: saved.enrollmentCode,
        requestedAt: saved.requestedAt.toISOString(),
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(DUPLICATE_ENROLLMENT);
      }
      throw error;
    }
  }

  async listMine(
    userId: string,
    query: ListMyEnrollmentsQueryDto,
  ): Promise<ListMyEnrollmentsResponse> {
    const guardianLinks = await this.studentGuardiansRepository.find({
      where: { guardian: { id: userId }, status: 'active' },
      relations: { student: true },
    });
    const studentIds = guardianLinks.map((link) => link.student.id);
    if (studentIds.length === 0) {
      return { enrollments: [] };
    }

    const enrollments = await this.enrollmentsRepository.find({
      where: {
        student: { id: In(studentIds) },
        ...(query.status ? { status: query.status } : {}),
      },
      relations: { student: true, institution: true },
      order: { requestedAt: 'DESC' },
    });

    return { enrollments: enrollments.map((enrollment) => this.toMyResponse(enrollment)) };
  }

  async listForInstitution(
    userId: string,
    query: ListInstitutionEnrollmentsQueryDto,
  ): Promise<ListInstitutionEnrollmentsResponse> {
    const isMember = await this.institutionMembersRepository.exists({
      where: { institution: { id: query.institutionId }, user: { id: userId } },
    });
    if (!isMember) {
      throw new ForbiddenException(NOT_INSTITUTION_MEMBER);
    }

    const enrollments = await this.enrollmentsRepository.find({
      where: {
        institution: { id: query.institutionId },
        ...(query.status ? { status: query.status } : {}),
      },
      relations: { student: true, requestedBy: true, reviewedBy: true },
      order: { requestedAt: 'DESC' },
    });

    return {
      enrollments: enrollments.map((enrollment) => this.toInstitutionResponse(enrollment)),
    };
  }

  async approve(
    id: string,
    actorUserId: string,
    dto?: ApproveEnrollmentDto,
  ): Promise<ReviewEnrollmentResponse> {
    const enrollment = await this.findPendingOrFail(id);
    const institution = await this.getInstitutionOrFail(enrollment.institutionId);
    if (institution.status !== 'approved') {
      throw new UnprocessableEntityException(INSTITUTION_NOT_APPROVED);
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const enrollmentsRepo = manager.getRepository(Enrollment);
      const auditRepo = manager.getRepository(AuditLog);

      enrollment.status = 'approved';
      enrollment.reviewedBy = { id: actorUserId } as User;
      enrollment.reviewedAt = new Date();
      if (dto?.gradeOrGroup !== undefined) enrollment.gradeOrGroup = dto.gradeOrGroup;
      const saved = await enrollmentsRepo.save(enrollment);

      await auditRepo.save(
        auditRepo.create({
          actor: { id: actorUserId } as User,
          action: 'enrollment.approved',
          entityType: 'enrollment',
          entityId: saved.id,
          metadata: null,
        }),
      );

      return saved;
    });

    try {
      await this.emailProvider.send({
        kind: 'enrollment_approved',
        to: enrollment.requestedBy.email,
        studentName: enrollment.student.fullName,
        institutionName: institution.name,
      });
    } catch {
      // Same policy as institution-members.service.ts: a transient email
      // outage must not fail the approval — the status change already
      // committed.
    }

    return this.toReviewResponse(saved, actorUserId);
  }

  async reject(id: string, actorUserId: string): Promise<ReviewEnrollmentResponse> {
    const enrollment = await this.findPendingOrFail(id);
    // Unlike approve, reject does not require institutions.status = approved
    // (ADR-018 only conditions the pending -> approved transition) — the
    // institution is only fetched here for the email's institutionName.
    const institution = await this.getInstitutionOrFail(enrollment.institutionId);

    const saved = await this.dataSource.transaction(async (manager) => {
      const enrollmentsRepo = manager.getRepository(Enrollment);
      const auditRepo = manager.getRepository(AuditLog);

      enrollment.status = 'rejected';
      enrollment.reviewedBy = { id: actorUserId } as User;
      enrollment.reviewedAt = new Date();
      const saved = await enrollmentsRepo.save(enrollment);

      await auditRepo.save(
        auditRepo.create({
          actor: { id: actorUserId } as User,
          action: 'enrollment.rejected',
          entityType: 'enrollment',
          entityId: saved.id,
          metadata: null,
        }),
      );

      return saved;
    });

    try {
      await this.emailProvider.send({
        kind: 'enrollment_rejected',
        to: enrollment.requestedBy.email,
        studentName: enrollment.student.fullName,
        institutionName: institution.name,
      });
    } catch {
      // Same policy as approve() above.
    }

    return this.toReviewResponse(saved, actorUserId);
  }

  // ADR-083: dedicated to correcting an already-approved enrollment, kept
  // separate from approve() on purpose — approve() requires status = pending
  // and re-sends the approval email on every call, so reusing it here to fix
  // a typo would fire a false email. No audit_log entry either: this is an
  // operational data correction, not an access-control decision like
  // approve/reject/invite.
  async updateGrade(
    id: string,
    actorUserId: string,
    gradeOrGroup: string | null | undefined,
  ): Promise<InstitutionEnrollmentListItem> {
    const enrollment = await this.findApprovedOrFail(id);
    if (gradeOrGroup !== undefined) enrollment.gradeOrGroup = gradeOrGroup;
    const saved = await this.enrollmentsRepository.save(enrollment);
    return this.toInstitutionResponse(saved);
  }

  private async findApprovedOrFail(id: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { id },
      relations: { student: true, requestedBy: true, reviewedBy: true },
    });
    if (!enrollment) {
      // Defensive: InstitutionMembershipGuard's own @InstitutionResource
      // lookup already 404s a missing id before this ever runs — same
      // redundant-but-safe pattern as findPendingOrFail.
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }
    if (enrollment.status !== 'approved') {
      throw new ConflictException(ENROLLMENT_NOT_APPROVED);
    }
    return enrollment;
  }

  private async assertActiveGuardian(studentId: string, userId: string): Promise<void> {
    const isGuardian = await this.studentGuardiansRepository.exists({
      where: { student: { id: studentId }, guardian: { id: userId }, status: 'active' },
    });
    if (!isGuardian) {
      throw new ForbiddenException(NOT_STUDENT_GUARDIAN);
    }
  }

  private async resolveApprovedInstitution(dto: CreateEnrollmentDto): Promise<Institution> {
    const institution = dto.institutionId
      ? await this.institutionsRepository.findOne({
          where: { id: dto.institutionId, status: 'approved' },
        })
      : await this.institutionsRepository.findOne({
          where: { joinCode: dto.joinCode, status: 'approved' },
        });
    if (!institution) {
      throw new NotFoundException(INSTITUTION_NOT_FOUND);
    }
    return institution;
  }

  private toMyResponse(enrollment: Enrollment): MyEnrollmentResponse {
    return {
      id: enrollment.id,
      studentId: enrollment.student.id,
      studentFullName: enrollment.student.fullName,
      institutionId: enrollment.institutionId,
      institutionName: enrollment.institution.name,
      institutionType: enrollment.institution.type,
      institutionCategory: enrollment.institution.category,
      status: enrollment.status,
      gradeOrGroup: enrollment.gradeOrGroup,
      enrollmentCode: enrollment.enrollmentCode,
      requestedAt: enrollment.requestedAt.toISOString(),
      reviewedAt: enrollment.reviewedAt ? enrollment.reviewedAt.toISOString() : null,
    };
  }

  private async findPendingOrFail(id: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentsRepository.findOne({
      where: { id },
      relations: { student: true, requestedBy: true },
    });
    if (!enrollment) {
      // Defensive: InstitutionMembershipGuard's own @InstitutionResource
      // lookup already 404s a missing id before this ever runs — same
      // redundant-but-safe pattern as dismissal-exceptions/delivery-points.
      throw new NotFoundException(RESOURCE_NOT_FOUND);
    }
    if (enrollment.status !== 'pending') {
      throw new ConflictException(ENROLLMENT_NOT_PENDING);
    }
    return enrollment;
  }

  private async getInstitutionOrFail(institutionId: string): Promise<Institution> {
    const institution = await this.institutionsRepository.findOneBy({ id: institutionId });
    if (!institution) {
      throw new Error(
        'Invariant violated: institution must exist for an enrollment guarded by InstitutionMembershipGuard.',
      );
    }
    return institution;
  }

  private toInstitutionResponse(enrollment: Enrollment): InstitutionEnrollmentListItem {
    return {
      id: enrollment.id,
      studentId: enrollment.student.id,
      studentFullName: enrollment.student.fullName,
      status: enrollment.status,
      gradeOrGroup: enrollment.gradeOrGroup,
      enrollmentCode: enrollment.enrollmentCode,
      requestedByUserId: enrollment.requestedBy.id,
      requestedAt: enrollment.requestedAt.toISOString(),
      reviewedByUserId: enrollment.reviewedBy ? enrollment.reviewedBy.id : null,
      reviewedAt: enrollment.reviewedAt ? enrollment.reviewedAt.toISOString() : null,
    };
  }

  private toReviewResponse(enrollment: Enrollment, actorUserId: string): ReviewEnrollmentResponse {
    return {
      id: enrollment.id,
      status: enrollment.status,
      reviewedByUserId: actorUserId,
      reviewedAt: (enrollment.reviewedAt as Date).toISOString(),
    };
  }
}
