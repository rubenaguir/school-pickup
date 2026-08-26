import { describe, expect, it } from 'vitest';
import {
  buildInstitutionAdminPayload,
  type InstitutionAdminPayload,
} from './institution-admin-payload';

describe('buildInstitutionAdminPayload', () => {
  it('produces the exact shape of AdminInstitutionListItem', () => {
    const institution: InstitutionAdminPayload = {
      id: 'inst-1',
      name: 'Colegio San Benito',
      type: 'school',
      category: null,
      status: 'approved',
      joinCode: 'CSB-2024',
    };

    expect(buildInstitutionAdminPayload(institution)).toEqual(institution);
  });

  // Structurally a subset of the Institution entity: extra fields (address,
  // geofence radii, timezone…) must not leak through even when the caller
  // hands the build function the full row, same criterion as
  // buildBoardPayload dropping deliveryCode.
  it('drops fields outside AdminInstitutionListItem when given a superset object', () => {
    const institutionRow = {
      id: 'inst-1',
      name: 'Colegio San Benito',
      type: 'school' as const,
      category: null,
      status: 'approved' as const,
      joinCode: 'CSB-2024',
      address: 'Av. Siempre Viva 123',
      timezone: 'America/Mexico_City',
    };

    const payload = buildInstitutionAdminPayload(institutionRow);

    expect(payload).not.toHaveProperty('address');
    expect(payload).not.toHaveProperty('timezone');
  });
});
