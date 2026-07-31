/**
 * Test de integracion contra Postgres REAL (no repositorios en memoria).
 *
 * Motivo: los tests de controller/service del proyecto inyectan repositorios
 * falsos basados en `Map`, que nunca emiten SQL. Por eso nadie detecto que
 * `institution_id` quedaba `NULL` en la base para 6 entidades: el objeto en
 * memoria que devuelve `.save()` SI trae el valor correcto — solo se ve
 * releyendo la fila desde la base.
 *
 * Este test hace exactamente eso: inserta via la relacion `@ManyToOne` (igual
 * que el codigo real de creacion) y relee con SQL crudo.
 *
 * No forma parte de `npm run check` — requiere Postgres. Se corre con
 * `npm run test:integration`. Todo ocurre dentro de una transaccion que
 * siempre hace rollback: no deja datos.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource, type QueryRunner } from 'typeorm';
import {
  DeliveryPoint,
  DismissalException,
  DismissalWindow,
  Enrollment,
  Institution,
  InstitutionMember,
  PickupRequest,
  Student,
  User,
} from '@casillego/shared/entities';
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

describe.skipIf(!databaseReachable)('persistencia del FK institution_id (Postgres real)', () => {
  let qr: QueryRunner;
  let institution: Institution;
  let user: User;
  let student: Student;
  let enrollment: Enrollment;

  const suffix = Date.now().toString(36);

  beforeAll(async () => {
    qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    const m = qr.manager;

    institution = await m.getRepository(Institution).save(
      m.getRepository(Institution).create({
        name: `FK test ${suffix}`,
        type: 'school',
        category: null,
        address: 'Calle Test 1',
        location: { type: 'Point', coordinates: [-99.1332, 19.4326] },
        timezone: 'America/Mexico_City',
        joinCode: `FKT-${suffix}`.slice(0, 20),
      }),
    );

    user = await m
      .getRepository(User)
      .save(m.getRepository(User).create({ email: `fk-${suffix}@example.com`, status: 'active' }));

    student = await m
      .getRepository(Student)
      .save(m.getRepository(Student).create({ fullName: 'Alumno FK', createdBy: user }));

    enrollment = await m.getRepository(Enrollment).save(
      m.getRepository(Enrollment).create({
        student,
        institution,
        status: 'approved',
        enrollmentCode: `FK-${suffix}`.slice(0, 50),
        requestedBy: user,
      }),
    );
  });

  afterAll(async () => {
    if (qr) {
      await qr.rollbackTransaction();
      await qr.release();
    }
    if (dataSource.isInitialized) await dataSource.destroy();
  });

  /**
   * Relee la fila desde la base — nunca el objeto en memoria devuelto por
   * `.save()`, que puede mostrar un valor que jamas se persistio.
   */
  async function persistedInstitutionId(table: string, id: string): Promise<string | null> {
    const rows = (await qr.query(`SELECT institution_id FROM ${table} WHERE id = $1`, [id])) as {
      institution_id: string | null;
    }[];
    expect(rows, `no se encontro la fila insertada en ${table}`).toHaveLength(1);
    return rows[0].institution_id;
  }

  it('InstitutionMember persiste institution_id', async () => {
    const saved = await qr.manager
      .getRepository(InstitutionMember)
      .save(
        qr.manager.getRepository(InstitutionMember).create({ institution, user, role: 'admin' }),
      );

    expect(await persistedInstitutionId('institution_members', saved.id)).toBe(institution.id);
  });

  it('Enrollment persiste institution_id', async () => {
    expect(await persistedInstitutionId('enrollments', enrollment.id)).toBe(institution.id);
  });

  it('DeliveryPoint persiste institution_id', async () => {
    const saved = await qr.manager
      .getRepository(DeliveryPoint)
      .save(qr.manager.getRepository(DeliveryPoint).create({ institution, name: 'Puerta 1' }));

    expect(await persistedInstitutionId('delivery_points', saved.id)).toBe(institution.id);
  });

  it('DismissalWindow persiste institution_id', async () => {
    const saved = await qr.manager.getRepository(DismissalWindow).save(
      qr.manager.getRepository(DismissalWindow).create({
        institution,
        weekday: 1,
        startTime: '14:00',
        endTime: '14:30',
        label: 'Salida primaria',
      }),
    );

    expect(await persistedInstitutionId('dismissal_windows', saved.id)).toBe(institution.id);
  });

  it('DismissalException persiste institution_id', async () => {
    const saved = await qr.manager.getRepository(DismissalException).save(
      qr.manager.getRepository(DismissalException).create({
        institution,
        date: '2026-12-25',
        name: 'Navidad',
        time: '12:00',
      }),
    );

    expect(await persistedInstitutionId('dismissal_exceptions', saved.id)).toBe(institution.id);
  });

  it('PickupRequest persiste institution_id', async () => {
    const saved = await qr.manager.getRepository(PickupRequest).save(
      qr.manager.getRepository(PickupRequest).create({
        enrollment,
        institution,
        guardian: user,
        status: 'en_route',
        deliveryCode: '1234',
      }),
    );

    expect(await persistedInstitutionId('pickup_requests', saved.id)).toBe(institution.id);
  });

  /**
   * El requisito que motivo la columna companion en ADR-029: el guard lee el FK
   * como escalar sin cargar la relacion. Si esto se rompe, el reemplazo no
   * cumple su proposito aunque el INSERT si persista.
   */
  it('InstitutionMember expone institutionId en un findOne SIN cargar la relacion', async () => {
    // Usuario propio: institution_members tiene un indice unico (institution, user).
    const otherUser = await qr.manager
      .getRepository(User)
      .save(
        qr.manager
          .getRepository(User)
          .create({ email: `fk-guard-${suffix}@example.com`, status: 'active' }),
      );

    const saved = await qr.manager.getRepository(InstitutionMember).save(
      qr.manager.getRepository(InstitutionMember).create({
        institution,
        user: otherUser,
        role: 'gate_operator',
      }),
    );

    const found = await qr.manager
      .getRepository(InstitutionMember)
      .findOne({ where: { id: saved.id } });

    expect(found?.institutionId).toBe(institution.id);
    expect(found?.institution, 'la relacion no debe cargarse').toBeUndefined();
  });
});
