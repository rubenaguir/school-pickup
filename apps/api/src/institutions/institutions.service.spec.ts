import { describe, expect, it, vi } from 'vitest';
import { ILike } from 'typeorm';
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
    attentionWaitMinutes: 20,
    joinCode: 'CSB-2024',
    status: 'approved',
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [],
    deliveryPoints: [],
    enrollments: [],
    dismissalWindows: [],
    dismissalExceptions: [],
    groups: [],
    ...overrides,
  };
}

interface MemberRecord {
  role: 'admin' | 'coordinator' | 'teacher' | 'gate_operator';
  user: { email: string };
}

function buildService(overrides?: {
  institutionsRepo?: Partial<Record<'findOne' | 'save' | 'exists' | 'findAndCount', unknown>>;
  members?: MemberRecord[];
  send?: ReturnType<typeof vi.fn>;
  publish?: ReturnType<typeof vi.fn>;
}) {
  const institutionsRepo = {
    findOne: vi.fn().mockResolvedValue(buildInstitution()),
    save: vi.fn((entity: Institution) => Promise.resolve(entity)),
    exists: vi.fn().mockResolvedValue(false),
    findAndCount: vi.fn().mockResolvedValue([[buildInstitution()], 1]),
    ...overrides?.institutionsRepo,
  };

  const auditRepo = {
    create: vi.fn((entity: unknown) => entity),
    save: vi.fn((entity: unknown) => Promise.resolve(entity)),
  };

  // The transition runs inside dataSource.transaction; the fake hands back
  // repositories per entity so the audit row can be asserted.
  const dataSource = {
    transaction: (run: (manager: unknown) => Promise<unknown>) =>
      run({
        getRepository: (entity: { name: string }) =>
          entity.name === 'AuditLog' ? auditRepo : institutionsRepo,
      }),
  };

  const membersRepo = {
    find: vi.fn().mockResolvedValue(overrides?.members ?? []),
  };

  const emailProvider = { send: overrides?.send ?? vi.fn().mockResolvedValue(undefined) };
  const mqttClient = { publish: overrides?.publish ?? vi.fn().mockResolvedValue(undefined) };

  const service = new InstitutionsService(
    institutionsRepo as never,
    membersRepo as never,
    dataSource as never,
    emailProvider as never,
    mqttClient as never,
  );
  return { service, institutionsRepo, membersRepo, auditRepo, emailProvider, mqttClient };
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

  describe('search', () => {
    it('searches by partial, case-insensitive name and applies default pagination', async () => {
      const { service, institutionsRepo } = buildService();
      const result = await service.search({ search: 'benito' });
      expect(institutionsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 0 }),
      );
      expect(result).toEqual({
        institutions: [
          { id: 'inst-1', name: 'Colegio San Benito', type: 'school', category: null },
        ],
        limit: 20,
        offset: 0,
        total: 1,
      });
    });

    it('only queries status = approved, never pending or suspended', async () => {
      const { service, institutionsRepo } = buildService();
      await service.search({ search: 'colegio' });
      expect(institutionsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { name: ILike('%colegio%'), status: 'approved' } }),
      );
    });

    it('respects an explicit limit/offset', async () => {
      const { service, institutionsRepo } = buildService();
      await service.search({ search: 'colegio', limit: 5, offset: 10 });
      expect(institutionsRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 }),
      );
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

  // Feature 025 / ADR-040. The three transitions of institutions.status.
  describe('status transitions', () => {
    const ADMINS: MemberRecord[] = [
      { role: 'admin', user: { email: 'admin1@example.com' } },
      { role: 'admin', user: { email: 'admin2@example.com' } },
    ];

    it('approves a pending institution and audits it as institution.approved', async () => {
      const { service, auditRepo } = buildService({
        institutionsRepo: {
          findOne: vi.fn().mockResolvedValue(buildInstitution({ status: 'pending' })),
        },
      });

      const result = await service.approve('inst-1', 'super-1');

      expect(result).toEqual({ id: 'inst-1', status: 'approved' });
      expect(auditRepo.save).toHaveBeenCalledOnce();
      expect(auditRepo.create).toHaveBeenCalledWith({
        actor: { id: 'super-1' },
        action: 'institution.approved',
        entityType: 'institution',
        entityId: 'inst-1',
        metadata: null,
      });
    });

    it('suspends an approved institution and audits it as institution.suspended', async () => {
      const { service, auditRepo } = buildService();

      const result = await service.suspend('inst-1', 'super-1');

      expect(result).toEqual({ id: 'inst-1', status: 'suspended' });
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'institution.suspended' }),
      );
    });

    it('reactivates a suspended institution under its own audit action, not institution.approved', async () => {
      const { service, auditRepo } = buildService({
        institutionsRepo: {
          findOne: vi.fn().mockResolvedValue(buildInstitution({ status: 'suspended' })),
        },
      });

      const result = await service.reactivate('inst-1', 'super-1');

      // Same destination as approve, deliberately distinguishable in the log
      // (ADR-040 point 6).
      expect(result).toEqual({ id: 'inst-1', status: 'approved' });
      expect(auditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'institution.reactivated' }),
      );
    });

    it.each([
      ['approve', 'approved'],
      ['suspend', 'pending'],
      ['reactivate', 'approved'],
    ] as const)(
      'rejects %s with 409 INVALID_STATUS_TRANSITION from status %s',
      async (verb, status) => {
        const { service, auditRepo, emailProvider } = buildService({
          institutionsRepo: { findOne: vi.fn().mockResolvedValue(buildInstitution({ status })) },
        });

        await expect(service[verb]('inst-1', 'super-1')).rejects.toMatchObject({
          status: 409,
          response: { code: 'INVALID_STATUS_TRANSITION' },
        });
        // Nothing happened: no audit row, no email (feature 025).
        expect(auditRepo.save).not.toHaveBeenCalled();
        expect(emailProvider.send).not.toHaveBeenCalled();
      },
    );

    it('throws 404 RESOURCE_NOT_FOUND when the institution does not exist', async () => {
      const { service } = buildService({
        institutionsRepo: { findOne: vi.fn().mockResolvedValue(null) },
      });
      await expect(service.suspend('missing', 'super-1')).rejects.toMatchObject({
        status: 404,
        response: { code: 'RESOURCE_NOT_FOUND' },
      });
    });

    it('emails every institution_member with role = admin', async () => {
      const { service, membersRepo, emailProvider } = buildService({ members: ADMINS });

      await service.suspend('inst-1', 'super-1');

      expect(membersRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { institution: { id: 'inst-1' }, role: 'admin' } }),
      );
      expect(emailProvider.send).toHaveBeenCalledTimes(2);
      expect(emailProvider.send).toHaveBeenCalledWith({
        kind: 'institution_suspended',
        to: 'admin1@example.com',
        institutionName: 'Colegio San Benito',
      });
    });

    it('keeps the transition when the email fails, and still notifies the other admins', async () => {
      const send = vi
        .fn()
        .mockRejectedValueOnce(new Error('smtp down'))
        .mockResolvedValueOnce(undefined);
      const { service } = buildService({ members: ADMINS, send });

      // Best-effort email (ADR-040 point 4): the status change already
      // committed, so a bounce must not surface as a failed request.
      await expect(service.suspend('inst-1', 'super-1')).resolves.toEqual({
        id: 'inst-1',
        status: 'suspended',
      });
      expect(send).toHaveBeenCalledTimes(2);
    });

    // ADR-087 pt.3: the super-admin queue's realtime channel.
    it('publishes the transitioned institution to the global admin topic', async () => {
      const { service, mqttClient } = buildService();

      await service.suspend('inst-1', 'super-1');

      expect(mqttClient.publish).toHaveBeenCalledWith(
        'school-pickup/admin/institutions',
        expect.objectContaining({ id: 'inst-1', status: 'suspended' }),
        1,
      );
    });

    it('does not fail the transition when the MQTT publish throws', async () => {
      const { service } = buildService({
        publish: vi.fn().mockRejectedValue(new Error('broker down')),
      });

      await expect(service.suspend('inst-1', 'super-1')).resolves.toEqual({
        id: 'inst-1',
        status: 'suspended',
      });
    });
  });
});
