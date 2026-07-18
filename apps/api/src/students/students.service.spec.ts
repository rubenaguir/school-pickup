import { describe, expect, it, vi } from 'vitest';
import { StudentsService } from './students.service';
import { Student, StudentGuardian } from '@casillego/shared/entities';

function buildStudentGuardianLink(overrides?: Partial<StudentGuardian>): StudentGuardian {
  return {
    id: 'sg-1',
    student: {
      id: 'student-1',
      fullName: 'Ana Pérez',
      birthDate: '2015-05-01',
      photoUrl: null,
    } as Student,
    guardian: { id: 'user-1' } as StudentGuardian['guardian'],
    relationship: 'mother',
    isPrimary: true,
    status: 'active',
    createdAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides?: {
  studentGuardiansRepo?: Partial<Record<'find', unknown>>;
  managerStudentsRepo?: Partial<Record<'create' | 'save', unknown>>;
  managerGuardiansRepo?: Partial<Record<'create' | 'save', unknown>>;
}) {
  const studentGuardiansRepo = {
    find: vi.fn().mockResolvedValue([]),
    ...overrides?.studentGuardiansRepo,
  };

  const managerStudentsRepo = {
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: Partial<Student>) =>
      Promise.resolve({
        id: 'student-1',
        birthDate: null,
        photoUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...entity,
      }),
    ),
    ...overrides?.managerStudentsRepo,
  };

  const managerGuardiansRepo = {
    create: vi.fn((data: object) => data),
    save: vi.fn((entity: Partial<StudentGuardian>) =>
      Promise.resolve({ id: 'sg-1', createdAt: new Date(), ...entity }),
    ),
    ...overrides?.managerGuardiansRepo,
  };

  const dataSource = {
    transaction: (cb: (manager: unknown) => Promise<unknown>) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === Student) return managerStudentsRepo;
          if (entity === StudentGuardian) return managerGuardiansRepo;
          throw new Error('Unexpected entity in test manager.getRepository');
        },
      }),
  };

  const service = new StudentsService(studentGuardiansRepo as never, dataSource as never);

  return { service, studentGuardiansRepo, managerStudentsRepo, managerGuardiansRepo };
}

describe('StudentsService', () => {
  describe('create', () => {
    it('creates the student and its primary active guardian link in a single transaction', async () => {
      const { service, managerStudentsRepo, managerGuardiansRepo } = buildService();

      const result = await service.create('user-1', {
        fullName: 'Ana Pérez',
        birthDate: '2015-05-01',
        photoUrl: null,
        relationship: 'mother',
      });

      expect(managerStudentsRepo.save).toHaveBeenCalledOnce();
      expect(managerGuardiansRepo.save).toHaveBeenCalledOnce();
      expect(managerGuardiansRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          relationship: 'mother',
          isPrimary: true,
          status: 'active',
        }),
      );
      expect(result).toMatchObject({
        id: 'student-1',
        fullName: 'Ana Pérez',
        birthDate: '2015-05-01',
        photoUrl: null,
        createdByUserId: 'user-1',
      });
    });

    it('propagates a failure from the guardian insert without swallowing it (transaction must roll back)', async () => {
      const { service } = buildService({
        managerGuardiansRepo: {
          save: vi.fn().mockRejectedValue(new Error('insert failed')),
        },
      });

      await expect(
        service.create('user-1', {
          fullName: 'Ana Pérez',
          relationship: 'mother',
        }),
      ).rejects.toThrow('insert failed');
    });
  });

  describe('listMine', () => {
    it('filters by the authenticated guardian and only active links', async () => {
      const { service, studentGuardiansRepo } = buildService({
        studentGuardiansRepo: { find: vi.fn().mockResolvedValue([buildStudentGuardianLink()]) },
      });

      const result = await service.listMine('user-1');

      expect(studentGuardiansRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { guardian: { id: 'user-1' }, status: 'active' },
        }),
      );
      expect(result.students).toHaveLength(1);
      expect(result.students[0]).toMatchObject({
        id: 'student-1',
        fullName: 'Ana Pérez',
        guardianRelationship: 'mother',
        guardianStatus: 'active',
        isPrimaryGuardian: true,
      });
    });

    it('returns an empty list when the user has no active guardian links', async () => {
      const { service } = buildService();

      const result = await service.listMine('user-1');

      expect(result.students).toEqual([]);
    });
  });
});
