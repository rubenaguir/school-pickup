import { describe, expect, it, vi } from 'vitest';
import { DismissalExceptionsService } from './dismissal-exceptions.service';
import { DismissalException } from '../database/entities/dismissal-exception.entity';
import { Institution } from '../database/entities/institution.entity';

function buildDismissalException(overrides?: Partial<DismissalException>): DismissalException {
  return {
    id: 'de-1',
    institutionId: 'inst-1',
    institution: { id: 'inst-1' } as Institution,
    date: '2026-07-20',
    name: 'Fin de cursos',
    level: null,
    time: '11:00',
    createdAt: new Date(),
    ...overrides,
  };
}

function buildService(overrides?: {
  repo?: Partial<Record<'find' | 'findOne' | 'create' | 'save' | 'remove' | 'exists', unknown>>;
}) {
  const repo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(buildDismissalException()),
    create: vi.fn((partial: Partial<DismissalException>) => partial),
    save: vi.fn((entity: DismissalException) => Promise.resolve(entity)),
    remove: vi.fn((entity: DismissalException) => Promise.resolve(entity)),
    exists: vi.fn().mockResolvedValue(false),
    ...overrides?.repo,
  };
  const service = new DismissalExceptionsService(repo as never);
  return { service, repo };
}

describe('DismissalExceptionsService', () => {
  describe('create', () => {
    it('creates and echoes the resolved institutionId', async () => {
      const { service, repo } = buildService();

      const result = await service.create('inst-1', {
        date: '2026-07-20',
        name: 'Fin de cursos',
        time: '11:00',
      });

      expect(repo.exists).toHaveBeenCalledOnce();
      expect(repo.save).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        institutionId: 'inst-1',
        date: '2026-07-20',
        name: 'Fin de cursos',
        level: null,
        time: '11:00',
      });
    });

    it('rejects with 422 CONFLICTING_DISMISSAL_EXCEPTION when the application-layer check finds a conflict, without attempting to save', async () => {
      const { service, repo } = buildService({ repo: { exists: vi.fn().mockResolvedValue(true) } });

      await expect(
        service.create('inst-1', { date: '2026-07-20', name: 'x', level: null, time: '11:00' }),
      ).rejects.toMatchObject({
        status: 422,
        response: { code: 'CONFLICTING_DISMISSAL_EXCEPTION' },
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('queries for any existing row on the date when level = null (no level filter)', async () => {
      const existsMock = vi.fn().mockResolvedValue(false);
      const { service } = buildService({ repo: { exists: existsMock } });

      await service.create('inst-1', { date: '2026-07-20', name: 'x', level: null, time: '11:00' });

      const call = existsMock.mock.calls[0]?.[0] as { where: Record<string, unknown> };
      expect(call.where).not.toHaveProperty('level');
    });

    it('queries only for level = null rows when creating a specific level (leaves the trivial same-level case to the DB unique index)', async () => {
      const existsMock = vi.fn().mockResolvedValue(false);
      const { service } = buildService({ repo: { exists: existsMock } });

      await service.create('inst-1', {
        date: '2026-07-20',
        name: 'x',
        level: 'Primaria',
        time: '11:00',
      });

      const call = existsMock.mock.calls[0]?.[0] as { where: Record<string, unknown> };
      expect(call.where).toHaveProperty('level');
    });

    it('rejects with 409 DUPLICATE_DISMISSAL_EXCEPTION when the DB unique index rejects the insert', async () => {
      const dbError = Object.assign(new Error('duplicate key'), { code: '23505' });
      const { service } = buildService({ repo: { save: vi.fn().mockRejectedValue(dbError) } });

      await expect(
        service.create('inst-1', {
          date: '2026-07-20',
          name: 'x',
          level: 'Primaria',
          time: '11:00',
        }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'DUPLICATE_DISMISSAL_EXCEPTION' },
      });
    });

    it('propagates unrelated save errors unchanged', async () => {
      const otherError = new Error('connection lost');
      const { service } = buildService({ repo: { save: vi.fn().mockRejectedValue(otherError) } });

      await expect(
        service.create('inst-1', { date: '2026-07-20', name: 'x', time: '11:00' }),
      ).rejects.toBe(otherError);
    });
  });

  describe('update', () => {
    it('throws 404 RESOURCE_NOT_FOUND when the exception does not exist', async () => {
      const { service } = buildService({ repo: { findOne: vi.fn().mockResolvedValue(null) } });

      await expect(service.update('missing', { name: 'x' })).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('re-validates the merged date/level, excluding the row itself', async () => {
      const existsMock = vi.fn().mockResolvedValue(false);
      const { service } = buildService({
        repo: {
          exists: existsMock,
          findOne: vi
            .fn()
            .mockResolvedValue(buildDismissalException({ date: '2026-07-20', level: null })),
        },
      });

      await service.update('de-1', { level: 'Primaria' });

      const call = existsMock.mock.calls[0]?.[0] as { where: { id?: unknown } };
      expect(call.where).toHaveProperty('id');
    });

    it('applies only the fields present in the dto', async () => {
      const { service, repo } = buildService({
        repo: { findOne: vi.fn().mockResolvedValue(buildDismissalException({ name: 'original' })) },
      });

      const result = await service.update('de-1', { name: 'Nuevo nombre' });

      expect(result.name).toBe('Nuevo nombre');
      expect(result.time).toBe('11:00');
      expect(repo.save).toHaveBeenCalledOnce();
    });

    it('rejects with 422 CONFLICTING_DISMISSAL_EXCEPTION when the edit introduces a conflict', async () => {
      const { service } = buildService({ repo: { exists: vi.fn().mockResolvedValue(true) } });

      await expect(service.update('de-1', { level: 'Primaria' })).rejects.toMatchObject({
        status: 422,
        response: { code: 'CONFLICTING_DISMISSAL_EXCEPTION' },
      });
    });
  });

  describe('remove', () => {
    it('deletes the exception physically', async () => {
      const existing = buildDismissalException();
      const { service, repo } = buildService({
        repo: { findOne: vi.fn().mockResolvedValue(existing) },
      });

      await service.remove('de-1');

      expect(repo.remove).toHaveBeenCalledWith(existing);
    });

    it('throws 404 RESOURCE_NOT_FOUND when the exception does not exist', async () => {
      const { service } = buildService({ repo: { findOne: vi.fn().mockResolvedValue(null) } });

      await expect(service.remove('missing')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });
  });

  describe('list', () => {
    it('filters by institutionId with no date filter when from/to are omitted', async () => {
      const { service, repo } = buildService();

      await service.list('inst-1');

      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { institution: { id: 'inst-1' } } }),
      );
    });
  });
});
