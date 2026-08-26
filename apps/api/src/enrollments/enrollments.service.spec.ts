import { describe, expect, it, vi } from 'vitest';
import { EnrollmentsService } from './enrollments.service';
import {
  Enrollment,
  AuditLog,
  type Institution,
  type InstitutionGroup,
  type Student,
  type User,
} from '@casillego/shared/entities';

function buildInstitution(overrides?: Partial<Institution>): Institution {
  return {
    id: 'inst-1',
    name: 'Escuela Uno',
    type: 'school',
    category: null,
    status: 'approved',
    joinCode: 'CSB-2024',
    ...overrides,
  } as Institution;
}

function buildGroup(id: string, name: string): InstitutionGroup {
  return { id, institutionId: 'inst-1', name, createdAt: new Date() } as InstitutionGroup;
}

function buildEnrollment(overrides?: Partial<Enrollment>): Enrollment {
  return {
    id: 'enr-1',
    student: { id: 'stu-1', fullName: 'Ana Pérez' } as Student,
    institutionId: 'inst-1',
    institution: buildInstitution(),
    status: 'pending',
    group: null,
    enrollmentCode: 'ENR-ABCD1234',
    requestedBy: { id: 'user-1', email: 'tutor@example.com' } as User,
    reviewedBy: null,
    requestedAt: new Date('2026-07-01T00:00:00.000Z'),
    reviewedAt: null,
    ...overrides,
  } as Enrollment;
}

function buildService(overrides?: {
  enrollments?: Partial<Record<'find' | 'create' | 'save' | 'exists' | 'findOne', unknown>>;
  institutions?: Partial<Record<'findOne' | 'findOneBy', unknown>>;
  studentGuardians?: Partial<Record<'find' | 'exists', unknown>>;
  institutionMembers?: Partial<Record<'exists', unknown>>;
  institutionGroups?: Partial<Record<'findOne', unknown>>;
  students?: Partial<Record<'findOneBy', unknown>>;
  dataSource?: Partial<Record<'transaction', unknown>>;
  emailProvider?: Partial<Record<'send', unknown>>;
  mqttClient?: Partial<Record<'publish', unknown>>;
}) {
  const enrollmentsRepo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(buildEnrollment()),
    create: vi.fn((partial: Partial<Enrollment>) => partial),
    save: vi.fn((entity: Partial<Enrollment>) => Promise.resolve(buildEnrollment(entity))),
    exists: vi.fn().mockResolvedValue(false),
    ...overrides?.enrollments,
  };
  const institutionsRepo = {
    findOne: vi.fn().mockResolvedValue(buildInstitution()),
    findOneBy: vi.fn().mockResolvedValue(buildInstitution()),
    ...overrides?.institutions,
  };
  const studentGuardiansRepo = {
    find: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(true),
    ...overrides?.studentGuardians,
  };
  const institutionMembersRepo = {
    exists: vi.fn().mockResolvedValue(true),
    ...overrides?.institutionMembers,
  };
  // Resolves any requested groupId as belonging to inst-1 by default, naming
  // the group after its id — tests asserting a specific group name build one
  // with buildGroup() and override this mock; tests asserting the 422
  // GROUP_NOT_IN_INSTITUTION rejection override it to resolve null.
  const institutionGroupsRepo = {
    findOne: vi.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(buildGroup(where.id, where.id)),
    ),
    ...overrides?.institutionGroups,
  };
  const studentsRepo = {
    findOneBy: vi.fn().mockResolvedValue({ id: 'stu-1', fullName: 'Ana Pérez' }),
    ...overrides?.students,
  };
  const auditRepo = {
    create: vi.fn((partial: object) => ({ ...partial })),
    save: vi.fn((entity: object) =>
      Promise.resolve({ id: 'audit-1', createdAt: new Date(), ...entity }),
    ),
  };
  const dataSource = {
    transaction: vi.fn((cb: (manager: unknown) => Promise<unknown>) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === Enrollment) return enrollmentsRepo;
          if (entity === AuditLog) return auditRepo;
          throw new Error('Unexpected entity in test dataSource.transaction');
        },
      }),
    ),
    ...overrides?.dataSource,
  };
  const emailProvider = {
    send: vi.fn().mockResolvedValue(undefined),
    ...overrides?.emailProvider,
  };
  const mqttClient = {
    publish: vi.fn().mockResolvedValue(undefined),
    ...overrides?.mqttClient,
  };
  const service = new EnrollmentsService(
    enrollmentsRepo as never,
    institutionsRepo as never,
    studentGuardiansRepo as never,
    institutionMembersRepo as never,
    institutionGroupsRepo as never,
    studentsRepo as never,
    dataSource as never,
    emailProvider as never,
    mqttClient as never,
  );
  return {
    service,
    enrollmentsRepo,
    institutionsRepo,
    studentGuardiansRepo,
    institutionMembersRepo,
    institutionGroupsRepo,
    studentsRepo,
    auditRepo,
    dataSource,
    emailProvider,
    mqttClient,
  };
}

describe('EnrollmentsService', () => {
  describe('create', () => {
    it('creates a pending enrollment when the institution is approved and the student belongs to the caller', async () => {
      const { service, enrollmentsRepo } = buildService();

      const result = await service.create('user-1', {
        studentId: 'stu-1',
        institutionId: 'inst-1',
      });

      expect(enrollmentsRepo.save).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        studentId: 'stu-1',
        institutionId: 'inst-1',
        status: 'pending',
      });
    });

    it('resolves the institution by joinCode when institutionId is omitted', async () => {
      const { service, institutionsRepo } = buildService();

      await service.create('user-1', { studentId: 'stu-1', joinCode: 'CSB-2024' });

      expect(institutionsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { joinCode: 'CSB-2024', status: 'approved' } }),
      );
    });

    it('rejects with 403 NOT_STUDENT_GUARDIAN when the caller is not an active guardian of the student', async () => {
      const { service } = buildService({
        studentGuardians: { exists: vi.fn().mockResolvedValue(false) },
      });

      await expect(
        service.create('user-1', { studentId: 'stu-1', institutionId: 'inst-1' }),
      ).rejects.toMatchObject({ status: 403, response: { code: 'NOT_STUDENT_GUARDIAN' } });
    });

    it('rejects with 404 INSTITUTION_NOT_FOUND when the institution is not approved (pending/suspended)', async () => {
      const { service } = buildService({
        institutions: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.create('user-1', { studentId: 'stu-1', institutionId: 'inst-1' }),
      ).rejects.toMatchObject({ status: 404, response: { code: 'INSTITUTION_NOT_FOUND' } });
    });

    it('rejects with 404 INSTITUTION_NOT_FOUND when the joinCode matches no approved institution', async () => {
      const { service } = buildService({
        institutions: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.create('user-1', { studentId: 'stu-1', joinCode: 'DOES-NOT-EXIST' }),
      ).rejects.toMatchObject({ status: 404, response: { code: 'INSTITUTION_NOT_FOUND' } });
    });

    it('rejects with 409 DUPLICATE_ENROLLMENT when a non-terminal enrollment already exists for the pair', async () => {
      const dbError = Object.assign(new Error('duplicate key'), { code: '23505' });
      const { service } = buildService({
        enrollments: { save: vi.fn().mockRejectedValue(dbError) },
      });

      await expect(
        service.create('user-1', { studentId: 'stu-1', institutionId: 'inst-1' }),
      ).rejects.toMatchObject({ status: 409, response: { code: 'DUPLICATE_ENROLLMENT' } });
    });

    it('allows a new request after a prior rejected enrollment for the same pair (ADR-026 pt.1 — partial index excludes rejected)', async () => {
      // The partial unique index only covers status IN ('pending','approved');
      // a prior `rejected` row for the same (student, institution) does not
      // collide, so the insert succeeds instead of hitting the 23505 path.
      const { service, enrollmentsRepo } = buildService();

      const result = await service.create('user-1', {
        studentId: 'stu-1',
        institutionId: 'inst-1',
      });

      expect(enrollmentsRepo.save).toHaveBeenCalledOnce();
      expect(result.status).toBe('pending');
    });

    it('propagates unrelated save errors unchanged', async () => {
      const otherError = new Error('connection lost');
      const { service } = buildService({
        enrollments: { save: vi.fn().mockRejectedValue(otherError) },
      });

      await expect(
        service.create('user-1', { studentId: 'stu-1', institutionId: 'inst-1' }),
      ).rejects.toBe(otherError);
    });

    // ADR-087 pt.2: the institution learns of a brand-new request; the tutor
    // who just submitted it does not need a second notice on their own topic.
    it('publishes to the institution enrollments topic only, not the guardian one', async () => {
      const { service, mqttClient } = buildService();

      await service.create('user-1', { studentId: 'stu-1', institutionId: 'inst-1' });

      expect(mqttClient.publish).toHaveBeenCalledOnce();
      expect(mqttClient.publish).toHaveBeenCalledWith(
        'school-pickup/institution/inst-1/enrollments',
        expect.objectContaining({ studentFullName: 'Ana Pérez', status: 'pending' }),
        1,
      );
    });

    it('does not fail the request when the MQTT publish throws', async () => {
      const { service } = buildService({
        mqttClient: { publish: vi.fn().mockRejectedValue(new Error('broker down')) },
      });

      const result = await service.create('user-1', {
        studentId: 'stu-1',
        institutionId: 'inst-1',
      });

      expect(result.status).toBe('pending');
    });
  });

  describe('listMine', () => {
    it('returns an empty list when the caller is not an active guardian of any student', async () => {
      const { service, enrollmentsRepo } = buildService({
        studentGuardians: { find: vi.fn().mockResolvedValue([]) },
      });

      const result = await service.listMine('user-1', {});

      expect(result.enrollments).toEqual([]);
      expect(enrollmentsRepo.find).not.toHaveBeenCalled();
    });

    it("lists only the caller's own enrollments", async () => {
      const { service, enrollmentsRepo } = buildService({
        studentGuardians: {
          find: vi.fn().mockResolvedValue([{ student: { id: 'stu-1' } }]),
        },
        enrollments: { find: vi.fn().mockResolvedValue([buildEnrollment()]) },
      });

      const result = await service.listMine('user-1', {});

      expect(result.enrollments).toHaveLength(1);
      expect(result.enrollments[0]).toMatchObject({ studentId: 'stu-1', status: 'pending' });
      expect(enrollmentsRepo.find).toHaveBeenCalledOnce();
    });

    it('enriches each enrollment with the institution name, type and category (ADR-057)', async () => {
      const { service } = buildService({
        studentGuardians: {
          find: vi.fn().mockResolvedValue([{ student: { id: 'stu-1' } }]),
        },
        enrollments: {
          find: vi.fn().mockResolvedValue([
            buildEnrollment({
              institutionId: 'inst-2',
              institution: buildInstitution({
                id: 'inst-2',
                name: 'Ballet CDMX',
                type: 'extracurricular',
                category: 'Ballet',
              }),
            }),
          ]),
        },
      });

      const result = await service.listMine('user-1', {});

      expect(result.enrollments[0]).toMatchObject({
        institutionId: 'inst-2',
        institutionName: 'Ballet CDMX',
        institutionType: 'extracurricular',
        institutionCategory: 'Ballet',
      });
    });
  });

  describe('listForInstitution', () => {
    it("rejects with 403 NOT_INSTITUTION_MEMBER when the caller isn't a member of the institution", async () => {
      const { service } = buildService({
        institutionMembers: { exists: vi.fn().mockResolvedValue(false) },
      });

      await expect(
        service.listForInstitution('user-1', { institutionId: 'inst-1' }),
      ).rejects.toMatchObject({ status: 403, response: { code: 'NOT_INSTITUTION_MEMBER' } });
    });

    it('lists the enrollments of the given institution', async () => {
      const { service, enrollmentsRepo } = buildService({
        enrollments: { find: vi.fn().mockResolvedValue([buildEnrollment()]) },
      });

      const result = await service.listForInstitution('user-1', { institutionId: 'inst-1' });

      expect(result.enrollments).toHaveLength(1);
      expect(result.enrollments[0]).toMatchObject({
        studentId: 'stu-1',
        requestedByUserId: 'user-1',
        status: 'pending',
      });
      expect(enrollmentsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { institution: { id: 'inst-1' } } }),
      );
    });
  });

  describe('approve', () => {
    it('approves a pending enrollment of an approved institution', async () => {
      const { service, enrollmentsRepo, auditRepo, emailProvider } = buildService();

      const result = await service.approve('enr-1', 'admin-1');

      expect(result).toMatchObject({
        id: 'enr-1',
        status: 'approved',
        reviewedByUserId: 'admin-1',
      });
      expect(enrollmentsRepo.save).toHaveBeenCalledOnce();
      expect(auditRepo.save).toHaveBeenCalledOnce();
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'enrollment.approved', entityType: 'enrollment' }),
      );
      expect(emailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'enrollment_approved', to: 'tutor@example.com' }),
      );
    });

    it('rejects with 404 RESOURCE_NOT_FOUND when the enrollment does not exist', async () => {
      const { service } = buildService({
        enrollments: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.approve('missing', 'admin-1')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('rejects with 409 ENROLLMENT_NOT_PENDING when the enrollment is already resolved', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ status: 'approved' })),
        },
      });

      await expect(service.approve('enr-1', 'admin-1')).rejects.toMatchObject({
        status: 409,
        response: { code: 'ENROLLMENT_NOT_PENDING' },
      });
    });

    it('rejects with 422 INSTITUTION_NOT_APPROVED when the institution is no longer approved', async () => {
      const { service, enrollmentsRepo } = buildService({
        institutions: {
          findOneBy: vi.fn().mockResolvedValue(buildInstitution({ status: 'suspended' })),
        },
      });

      await expect(service.approve('enr-1', 'admin-1')).rejects.toMatchObject({
        status: 422,
        response: { code: 'INSTITUTION_NOT_APPROVED' },
      });
      expect(enrollmentsRepo.save).not.toHaveBeenCalled();
    });

    it('does not fail the approval when the email provider throws', async () => {
      const { service, enrollmentsRepo } = buildService({
        emailProvider: { send: vi.fn().mockRejectedValue(new Error('smtp down')) },
      });

      const result = await service.approve('enr-1', 'admin-1');

      expect(result.status).toBe('approved');
      expect(enrollmentsRepo.save).toHaveBeenCalledOnce();
    });

    // ADR-083: groupId is optional on approve — assigning or correcting the
    // student's group in the same step, instead of relying only on the
    // catch-all delivery point. Renamed from gradeOrGroup (ADR-084): the
    // field is a catalog reference now, not free text.
    it('assigns the resolved group when the approve body includes a groupId', async () => {
      const { service, enrollmentsRepo } = buildService();

      await service.approve('enr-1', 'admin-1', { groupId: 'group-3b' });

      expect(enrollmentsRepo.save).toHaveBeenCalledOnce();
      const saved = (enrollmentsRepo.save as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Partial<Enrollment>;
      expect(saved.group?.id).toBe('group-3b');
    });

    it('leaves the group untouched when the approve body omits groupId', async () => {
      const { service, enrollmentsRepo } = buildService({
        enrollments: {
          findOne: vi
            .fn()
            .mockResolvedValue(buildEnrollment({ group: buildGroup('group-1a', '1A') })),
        },
      });

      await service.approve('enr-1', 'admin-1');

      expect(enrollmentsRepo.save).toHaveBeenCalledOnce();
      const saved = (enrollmentsRepo.save as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Partial<Enrollment>;
      expect(saved.group?.id).toBe('group-1a');
    });

    it('rejects with 422 GROUP_NOT_IN_INSTITUTION when groupId does not belong to the enrollment institution', async () => {
      const { service } = buildService({
        institutionGroups: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(
        service.approve('enr-1', 'admin-1', { groupId: 'foreign-group' }),
      ).rejects.toMatchObject({ status: 422, response: { code: 'GROUP_NOT_IN_INSTITUTION' } });
    });

    // ADR-087 pt.2: unlike create(), a status change is published to BOTH the
    // institution and the requesting guardian's own topic.
    it('publishes to both the institution and the requesting guardian topics', async () => {
      const { service, mqttClient } = buildService();

      await service.approve('enr-1', 'admin-1');

      expect(mqttClient.publish).toHaveBeenCalledTimes(2);
      expect(mqttClient.publish).toHaveBeenCalledWith(
        'school-pickup/institution/inst-1/enrollments',
        expect.objectContaining({ status: 'approved' }),
        1,
      );
      expect(mqttClient.publish).toHaveBeenCalledWith(
        'school-pickup/guardian/user-1/enrollments',
        expect.objectContaining({ status: 'approved' }),
        1,
      );
    });

    it('does not fail the approval when the MQTT publish throws', async () => {
      const { service } = buildService({
        mqttClient: { publish: vi.fn().mockRejectedValue(new Error('broker down')) },
      });

      const result = await service.approve('enr-1', 'admin-1');

      expect(result.status).toBe('approved');
    });
  });

  describe('reject', () => {
    it('rejects a pending enrollment without validating institution status', async () => {
      const { service, enrollmentsRepo, auditRepo, emailProvider } = buildService({
        institutions: {
          findOneBy: vi.fn().mockResolvedValue(buildInstitution({ status: 'suspended' })),
        },
      });

      const result = await service.reject('enr-1', 'admin-1');

      expect(result).toMatchObject({
        id: 'enr-1',
        status: 'rejected',
        reviewedByUserId: 'admin-1',
      });
      expect(enrollmentsRepo.save).toHaveBeenCalledOnce();
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'enrollment.rejected', entityType: 'enrollment' }),
      );
      expect(emailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'enrollment_rejected' }),
      );
    });

    it('rejects with 409 ENROLLMENT_NOT_PENDING when the enrollment is already terminal', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ status: 'rejected' })),
        },
      });

      await expect(service.reject('enr-1', 'admin-1')).rejects.toMatchObject({
        status: 409,
        response: { code: 'ENROLLMENT_NOT_PENDING' },
      });
    });

    it('publishes to both the institution and the requesting guardian topics', async () => {
      const { service, mqttClient } = buildService();

      await service.reject('enr-1', 'admin-1');

      expect(mqttClient.publish).toHaveBeenCalledTimes(2);
      expect(mqttClient.publish).toHaveBeenCalledWith(
        'school-pickup/institution/inst-1/enrollments',
        expect.objectContaining({ status: 'rejected' }),
        1,
      );
      expect(mqttClient.publish).toHaveBeenCalledWith(
        'school-pickup/guardian/user-1/enrollments',
        expect.objectContaining({ status: 'rejected' }),
        1,
      );
    });
  });

  // Renamed from updateGrade (ADR-084): the field is a catalog reference now.
  describe('updateGroup', () => {
    it('corrects the group on an approved enrollment', async () => {
      const { service, enrollmentsRepo } = buildService({
        enrollments: {
          findOne: vi
            .fn()
            .mockResolvedValue(
              buildEnrollment({ status: 'approved', group: buildGroup('group-1a', '1A') }),
            ),
        },
        institutionGroups: { findOne: vi.fn().mockResolvedValue(buildGroup('group-2a', '2A')) },
      });

      const result = await service.updateGroup('enr-1', 'admin-1', 'group-2a');

      expect(enrollmentsRepo.save).toHaveBeenCalledOnce();
      const saved = (enrollmentsRepo.save as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Partial<Enrollment>;
      expect(saved.group?.id).toBe('group-2a');
      expect(result).toMatchObject({ id: 'enr-1', status: 'approved', gradeOrGroup: '2A' });
    });

    it('accepts null to clear the group', async () => {
      const { service, enrollmentsRepo } = buildService({
        enrollments: {
          findOne: vi
            .fn()
            .mockResolvedValue(
              buildEnrollment({ status: 'approved', group: buildGroup('group-1a', '1A') }),
            ),
        },
      });

      await service.updateGroup('enr-1', 'admin-1', null);

      expect(enrollmentsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ group: null }));
    });

    it('rejects with 422 GROUP_NOT_IN_INSTITUTION when groupId does not belong to the enrollment institution', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ status: 'approved' })),
        },
        institutionGroups: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.updateGroup('enr-1', 'admin-1', 'foreign-group')).rejects.toMatchObject({
        status: 422,
        response: { code: 'GROUP_NOT_IN_INSTITUTION' },
      });
    });

    it('does not write an audit_log entry', async () => {
      const { service, auditRepo } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ status: 'approved' })),
        },
      });

      await service.updateGroup('enr-1', 'admin-1', 'group-2a');

      expect(auditRepo.save).not.toHaveBeenCalled();
    });

    it('does not send an email', async () => {
      const { service, emailProvider } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ status: 'approved' })),
        },
      });

      await service.updateGroup('enr-1', 'admin-1', 'group-2a');

      expect(emailProvider.send).not.toHaveBeenCalled();
    });

    it('rejects with 404 RESOURCE_NOT_FOUND when the enrollment does not exist', async () => {
      const { service } = buildService({
        enrollments: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.updateGroup('missing', 'admin-1', 'group-2a')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('rejects with 409 ENROLLMENT_NOT_APPROVED when the enrollment is still pending', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ status: 'pending' })),
        },
      });

      await expect(service.updateGroup('enr-1', 'admin-1', 'group-2a')).rejects.toMatchObject({
        status: 409,
        response: { code: 'ENROLLMENT_NOT_APPROVED' },
      });
    });

    it('rejects with 409 ENROLLMENT_NOT_APPROVED when the enrollment is rejected (terminal)', async () => {
      const { service } = buildService({
        enrollments: {
          findOne: vi.fn().mockResolvedValue(buildEnrollment({ status: 'rejected' })),
        },
      });

      await expect(service.updateGroup('enr-1', 'admin-1', 'group-2a')).rejects.toMatchObject({
        status: 409,
        response: { code: 'ENROLLMENT_NOT_APPROVED' },
      });
    });
  });
});
