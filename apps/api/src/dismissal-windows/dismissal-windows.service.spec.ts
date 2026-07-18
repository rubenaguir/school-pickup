import { describe, expect, it, vi } from 'vitest';
import { DismissalWindowsService } from './dismissal-windows.service';
import { DismissalWindow, Institution } from '@casillego/shared/entities';

function buildDismissalWindow(overrides?: Partial<DismissalWindow>): DismissalWindow {
  return {
    id: 'dw-1',
    institutionId: 'inst-1',
    institution: { id: 'inst-1' } as Institution,
    weekday: 1,
    startTime: '13:00',
    endTime: '14:00',
    label: 'Salida vespertina',
    level: null,
    status: 'active',
    ...overrides,
  };
}

function buildService(overrides?: {
  dismissalWindowsRepo?: Partial<Record<'find' | 'findOne' | 'create' | 'save', unknown>>;
}) {
  const dismissalWindowsRepo = {
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(buildDismissalWindow()),
    create: vi.fn((partial: Partial<DismissalWindow>) => partial),
    save: vi.fn((entity: DismissalWindow) => Promise.resolve(entity)),
    ...overrides?.dismissalWindowsRepo,
  };
  const service = new DismissalWindowsService(dismissalWindowsRepo as never);
  return { service, dismissalWindowsRepo };
}

describe('DismissalWindowsService', () => {
  describe('list', () => {
    it('filters by institutionId and, when provided, status', async () => {
      const { service, dismissalWindowsRepo } = buildService({
        dismissalWindowsRepo: { find: vi.fn().mockResolvedValue([buildDismissalWindow()]) },
      });

      const result = await service.list('inst-1', 'active');

      expect(dismissalWindowsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { institution: { id: 'inst-1' }, status: 'active' },
        }),
      );
      expect(result.dismissalWindows).toHaveLength(1);
      expect(result.dismissalWindows[0]).toMatchObject({ id: 'dw-1', institutionId: 'inst-1' });
    });

    it('omits the status filter when none is given', async () => {
      const { service, dismissalWindowsRepo } = buildService();

      await service.list('inst-1');

      expect(dismissalWindowsRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { institution: { id: 'inst-1' } } }),
      );
    });
  });

  describe('create', () => {
    it('creates with status = active and echoes the resolved institutionId', async () => {
      const { service, dismissalWindowsRepo } = buildService();

      const result = await service.create('inst-1', {
        weekday: 2,
        startTime: '13:00',
        endTime: '14:00',
        label: 'Salida vespertina',
      });

      expect(dismissalWindowsRepo.save).toHaveBeenCalledOnce();
      expect(result).toMatchObject({
        institutionId: 'inst-1',
        weekday: 2,
        label: 'Salida vespertina',
        status: 'active',
        level: null,
      });
    });

    it('stores an explicit level when provided', async () => {
      const { service } = buildService();

      const result = await service.create('inst-1', {
        weekday: 2,
        startTime: '13:00',
        endTime: '14:00',
        label: 'Salida vespertina',
        level: 'Primaria',
      });

      expect(result.level).toBe('Primaria');
    });
  });

  describe('update', () => {
    it('throws 404 RESOURCE_NOT_FOUND when the dismissal window does not exist', async () => {
      const { service } = buildService({
        dismissalWindowsRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });

      await expect(service.update('missing', { label: 'x' })).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('applies only the fields present in the dto', async () => {
      const { service, dismissalWindowsRepo } = buildService({
        dismissalWindowsRepo: {
          findOne: vi.fn().mockResolvedValue(buildDismissalWindow({ label: 'original' })),
        },
      });

      const result = await service.update('dw-1', { label: 'Nuevo nombre' });

      expect(result.label).toBe('Nuevo nombre');
      expect(result.startTime).toBe('13:00');
      expect(dismissalWindowsRepo.save).toHaveBeenCalledOnce();
    });

    it('pauses via status = paused', async () => {
      const { service } = buildService();

      const result = await service.update('dw-1', { status: 'paused' });

      expect(result.status).toBe('paused');
    });

    it('re-activates a paused window via status = active', async () => {
      const { service } = buildService({
        dismissalWindowsRepo: {
          findOne: vi.fn().mockResolvedValue(buildDismissalWindow({ status: 'paused' })),
        },
      });

      const result = await service.update('dw-1', { status: 'active' });

      expect(result.status).toBe('active');
    });
  });
});
