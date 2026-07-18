import { describe, expect, it, vi } from 'vitest';
import { InstitutionsService } from './institutions.service';
import { Institution } from '@casillego/shared/entities';

function buildInstitution(overrides?: Partial<Institution>): Institution {
  return {
    id: 'inst-1',
    name: 'Colegio San Benito',
    type: 'school',
    category: null,
    address: 'Av. Siempre Viva 123',
    location: { type: 'Point', coordinates: [-99.1332, 19.4326] },
    geofenceRadiusMeters: 100,
    activationRadiusMeters: 3000,
    timezone: 'America/Mexico_City',
    cctCode: null,
    levels: [],
    arrivalToleranceMinutes: 10,
    advanceNoticeMinutes: 15,
    arrivingLeadMinutes: 5,
    joinCode: 'CSB-2024',
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [],
    deliveryPoints: [],
    enrollments: [],
    dismissalWindows: [],
    dismissalExceptions: [],
    ...overrides,
  };
}

function buildService(overrides?: {
  institutionsRepo?: Partial<Record<'findOne' | 'save' | 'exists', unknown>>;
}) {
  const institutionsRepo = {
    findOne: vi.fn().mockResolvedValue(buildInstitution()),
    save: vi.fn((entity: Institution) => Promise.resolve(entity)),
    exists: vi.fn().mockResolvedValue(false),
    ...overrides?.institutionsRepo,
  };
  const service = new InstitutionsService(institutionsRepo as never);
  return { service, institutionsRepo };
}

describe('InstitutionsService', () => {
  describe('get', () => {
    it('maps the institution to the profile response shape, including joinCode and status', async () => {
      const { service } = buildService();
      const result = await service.get('inst-1');
      expect(result).toMatchObject({
        id: 'inst-1',
        name: 'Colegio San Benito',
        type: 'school',
        location: { lat: 19.4326, lng: -99.1332 },
        joinCode: 'CSB-2024',
        status: 'approved',
      });
    });

    it('throws 404 RESOURCE_NOT_FOUND when the institution does not exist', async () => {
      const { service } = buildService({
        institutionsRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });
      await expect(service.get('missing')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });
  });

  describe('update', () => {
    it('applies partial edits and keeps the two radii independent', async () => {
      const { service, institutionsRepo } = buildService();
      const result = await service.update('inst-1', {
        geofenceRadiusMeters: 50,
        activationRadiusMeters: 2000,
      });
      expect(result.geofenceRadiusMeters).toBe(50);
      expect(result.activationRadiusMeters).toBe(2000);
      expect(institutionsRepo.save).toHaveBeenCalledOnce();
    });

    it('does not return joinCode in the response shape', async () => {
      const { service } = buildService();
      const result = await service.update('inst-1', { name: 'Nuevo nombre' });
      expect(result).not.toHaveProperty('joinCode');
      expect(result.name).toBe('Nuevo nombre');
    });

    it('rejects with 409 INSTITUTION_NOT_APPROVED when status is not approved', async () => {
      const { service } = buildService({
        institutionsRepo: {
          findOne: vi.fn().mockResolvedValue(buildInstitution({ status: 'pending' })),
        },
      });
      await expect(service.update('inst-1', { name: 'x' })).rejects.toMatchObject({
        status: 409,
        response: { code: 'INSTITUTION_NOT_APPROVED' },
      });
    });

    it('rejects with 409 CATEGORY_NOT_ALLOWED_FOR_TYPE when setting category on type = school', async () => {
      const { service } = buildService({
        institutionsRepo: {
          findOne: vi.fn().mockResolvedValue(buildInstitution({ type: 'school' })),
        },
      });
      await expect(service.update('inst-1', { category: 'Ballet' })).rejects.toMatchObject({
        status: 409,
        response: { code: 'CATEGORY_NOT_ALLOWED_FOR_TYPE' },
      });
    });

    it('allows category on type = extracurricular', async () => {
      const { service } = buildService({
        institutionsRepo: {
          findOne: vi
            .fn()
            .mockResolvedValue(buildInstitution({ type: 'extracurricular', category: 'Natación' })),
        },
      });
      const result = await service.update('inst-1', { category: 'Ballet' });
      expect(result.category).toBe('Ballet');
    });
  });

  describe('regenerateJoinCode', () => {
    it('produces a new join_code, distinct from the previous one', async () => {
      const { service } = buildService();
      const result = await service.regenerateJoinCode('inst-1');
      expect(result.joinCode).not.toBe('CSB-2024');
      expect(result.joinCode).toMatch(new RegExp(`^CSB-${new Date().getFullYear()}`));
    });

    it('retries with a random suffix when the base candidate collides on save', async () => {
      let saveAttempts = 0;
      const institutionsRepo = {
        findOne: vi.fn().mockResolvedValue(buildInstitution()),
        exists: vi.fn().mockResolvedValue(false),
        save: vi.fn((entity: Institution) => {
          saveAttempts += 1;
          if (saveAttempts === 1) {
            return Promise.reject(Object.assign(new Error('duplicate key'), { code: '23505' }));
          }
          return Promise.resolve(entity);
        }),
      };
      const { service } = buildService({ institutionsRepo });
      const result = await service.regenerateJoinCode('inst-1');
      expect(saveAttempts).toBe(2);
      expect(result.joinCode).toMatch(new RegExp(`^CSB-${new Date().getFullYear()}-[0-9A-F]{4}$`));
    });

    it('throws 404 RESOURCE_NOT_FOUND when the institution does not exist', async () => {
      const { service } = buildService({
        institutionsRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });
      await expect(service.regenerateJoinCode('missing')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });
  });
});
