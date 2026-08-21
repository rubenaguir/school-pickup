/**
 * Test de integracion contra Postgres REAL (no repositorios en memoria).
 *
 * ADR-083 reescribio resolveDeliveryPointId() para resolver en dos pasos
 * (match exacto -> atrapa-todo) sobre this.deliveryPointsRepository.find(),
 * en vez del createQueryBuilder anterior. pickups.service.spec.ts ya cubre
 * esta logica con repositorios falsos, pero ese mock no emite SQL real —
 * mismo motivo que foreign-key-persistence.integration.spec.ts (patron
 * ADR-044): el objeto en memoria puede verse correcto sin que el mapeo real
 * de TypeORM (relacion institution, columna assigned_groups como array) lo
 * este. Este test relee sobre una base real.
 *
 * No forma parte de `npm run check` — requiere Postgres. Se corre con
 * `npm run test:integration`. Todo ocurre dentro de una transaccion que
 * siempre hace rollback: no deja datos.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource, type QueryRunner, type Repository } from 'typeorm';
import { PickupsService } from './pickups.service';
import { DeliveryPoint, Institution, type Enrollment } from '@casillego/shared/entities';
import * as entities from '@casillego/shared/entities';

function buildDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    uuidExtension: 'pgcrypto',
    entities: Object.values(entities),
  });
}

const dataSource = buildDataSource();
// Sin Postgres alcanzable el archivo entero se salta, en vez de fallar: la
// compuerta normal (`npm run check`) no debe exigir una base de datos.
const databaseReachable = await dataSource
  .initialize()
  .then(() => true)
  .catch(() => false);

describe.skipIf(!databaseReachable)('resolveDeliveryPointId (Postgres real, ADR-083)', () => {
  let qr: QueryRunner;
  let deliveryPointsRepo: Repository<DeliveryPoint>;
  let institutionsRepo: Repository<Institution>;
  let service: PickupsService;

  const suffix = Date.now().toString(36);
  let institutionCounter = 0;

  // resolveDeliveryPointId is private — accessed via cast, same criterion as
  // any other test that reaches past TypeScript's compile-time-only `private`
  // to exercise a helper directly instead of driving the whole create() flow
  // (guardian/vehicle/mqtt setup would be unrelated noise for what this test
  // actually checks: the real find() query and the two-step matching logic).
  function resolve(enrollment: Partial<Enrollment>): Promise<string | null> {
    return (
      service as unknown as { resolveDeliveryPointId(e: Enrollment): Promise<string | null> }
    ).resolveDeliveryPointId(enrollment as Enrollment);
  }

  // Each test gets its own institution — resolveDeliveryPointId's catch-all
  // logic (ADR-083) is only deterministic within one institution's active
  // points, so sharing one across tests inside the same rolled-back
  // transaction would let an earlier test's catch-all point leak into a
  // later test's result.
  async function newInstitution(): Promise<Institution> {
    institutionCounter += 1;
    return institutionsRepo.save(
      institutionsRepo.create({
        name: `ADR-083 test ${suffix}-${institutionCounter}`,
        type: 'school',
        category: null,
        address: 'Calle Test 1',
        location: { type: 'Point', coordinates: [-99.1332, 19.4326] },
        timezone: 'America/Mexico_City',
        joinCode: `A083-${suffix}-${institutionCounter}`.slice(0, 20),
      }),
    );
  }

  beforeAll(async () => {
    qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    deliveryPointsRepo = qr.manager.getRepository(DeliveryPoint);
    institutionsRepo = qr.manager.getRepository(Institution);

    // Solo deliveryPointsRepository importa a resolveDeliveryPointId — el
    // resto de las dependencias del constructor nunca se invoca en este
    // test, un stub basta.
    service = new PickupsService(
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      deliveryPointsRepo,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
      undefined as never,
    );
  });

  afterAll(async () => {
    if (qr) {
      await qr.rollbackTransaction();
      await qr.release();
    }
    if (dataSource.isInitialized) await dataSource.destroy();
  });

  it('resuelve al punto con match exacto de grupo', async () => {
    const institution = await newInstitution();
    const grouped = await deliveryPointsRepo.save(
      deliveryPointsRepo.create({
        institution,
        name: 'Puerta 3B',
        assignedGroups: ['3B'],
        status: 'active',
      }),
    );
    await deliveryPointsRepo.save(
      deliveryPointsRepo.create({
        institution,
        name: 'Atrapa-todo',
        assignedGroups: null,
        status: 'active',
      }),
    );

    const result = await resolve({ institutionId: institution.id, gradeOrGroup: '3B' });

    expect(result).toBe(grouped.id);
  });

  it('cae al atrapa-todo cuando el grupo es huérfano (ningún punto activo lo cubre)', async () => {
    const institution = await newInstitution();
    await deliveryPointsRepo.save(
      deliveryPointsRepo.create({
        institution,
        name: 'Puerta 3B',
        assignedGroups: ['3B'],
        status: 'active',
      }),
    );
    const catchAll = await deliveryPointsRepo.save(
      deliveryPointsRepo.create({
        institution,
        name: 'Atrapa-todo',
        assignedGroups: [],
        status: 'active',
      }),
    );

    const result = await resolve({ institutionId: institution.id, gradeOrGroup: 'grupo-huérfano' });

    expect(result).toBe(catchAll.id);
  });

  it('cae al atrapa-todo cuando el alumno no tiene grupo', async () => {
    const institution = await newInstitution();
    const catchAll = await deliveryPointsRepo.save(
      deliveryPointsRepo.create({
        institution,
        name: 'Atrapa-todo',
        assignedGroups: null,
        status: 'active',
      }),
    );

    const result = await resolve({ institutionId: institution.id, gradeOrGroup: null });

    expect(result).toBe(catchAll.id);
  });

  it('devuelve null cuando no hay atrapa-todo ni match (comportamiento previo a ADR-083 preservado)', async () => {
    const institution = await newInstitution();
    await deliveryPointsRepo.save(
      deliveryPointsRepo.create({
        institution,
        name: 'Solo con grupo',
        assignedGroups: ['1A'],
        status: 'active',
      }),
    );

    const result = await resolve({ institutionId: institution.id, gradeOrGroup: null });

    expect(result).toBeNull();
  });
});
