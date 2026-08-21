import { MigrationInterface, QueryRunner } from 'typeorm';

// Replaces the free-text enrollments.grade_or_group / delivery_points.assigned_groups
// with a curated per-institution catalog (institution_groups) referenced by FK.
// See ADR-084 for the full rationale; this migration implements section 9
// step by step, including the mandatory backfill and sanity checks.
//
// API responses are unaffected (ADR-084 point 1/3/4): EnrollmentsService and
// DeliveryPointsService keep returning gradeOrGroup/assignedGroups as before,
// now resolved by join instead of column. Only write DTOs and matching change
// (Fase 2, not this migration).
//
// Case-insensitive dedup during backfill (ADR-084 point 9.2): if "1A" and "1a"
// both existed for the same institution across either source, only the
// earliest-appearing row survives as the catalog entry. The collision count
// logged below is the only signal to detect this after the fact — review it
// if it's non-zero.
export class InstitutionGroupsCatalog1787349827677 implements MigrationInterface {
  name = 'InstitutionGroupsCatalog1787349827677';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Snapshot "before" counts for the mandatory sanity check (ADR-084 9.5) ---
    const [{ count: enrollmentsBefore }] = (await queryRunner.query(
      `SELECT count(*)::int AS count FROM "enrollments" WHERE "grade_or_group" IS NOT NULL`,
    )) as { count: number }[];
    const [{ count: deliveryPointsBefore }] = (await queryRunner.query(
      `SELECT count(*)::int AS count FROM "delivery_points" WHERE "assigned_groups" IS NOT NULL`,
    )) as { count: number }[];

    // --- 1. CREATE TABLE institution_groups + functional unique index ---
    await queryRunner.query(
      `CREATE TABLE "institution_groups" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "institution_id" uuid, CONSTRAINT "PK_782761fcbdc37386c465f78c145" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "institution_groups" ADD CONSTRAINT "FK_6826eabede0d16fdce0be5821ed" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    // Functional over lower(name) — case-insensitive on purpose (ADR-084 pt.2).
    // Not expressible via TypeORM's @Index decorator (no expression-index
    // support), so the entity's declarative mirror is a plain column index;
    // this raw SQL is the real source of truth, same convention already used
    // for the other partial/GIN indexes in this codebase.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_institution_groups_name_ci" ON "institution_groups" ("institution_id", lower("name"))`,
    );

    // --- 2. Backfill the catalog: union of both sources, case-insensitive dedup ---
    const [{ count: collisionCount }] = (await queryRunner.query(
      `
      SELECT count(*)::int AS count FROM (
        SELECT institution_id, lower(name) AS name_ci
        FROM (
          SELECT institution_id, grade_or_group AS name
          FROM "enrollments"
          WHERE grade_or_group IS NOT NULL
          UNION ALL
          SELECT dp.institution_id, g.name
          FROM "delivery_points" dp, unnest(dp.assigned_groups) AS g(name)
          WHERE dp.assigned_groups IS NOT NULL
        ) sources
        GROUP BY institution_id, lower(name)
        HAVING count(DISTINCT name) > 1
      ) collisions
      `,
    )) as { count: number }[];
    console.log(
      `[InstitutionGroupsCatalog migration] case-insensitive name collisions resolved during backfill: ${collisionCount}`,
    );

    await queryRunner.query(
      `
      INSERT INTO "institution_groups" (institution_id, name)
      SELECT DISTINCT ON (institution_id, lower(name)) institution_id, name
      FROM (
        SELECT institution_id, grade_or_group AS name, requested_at AS occurred_at, id AS source_id
        FROM "enrollments"
        WHERE grade_or_group IS NOT NULL
        UNION ALL
        SELECT dp.institution_id, g.name, dp.created_at AS occurred_at, dp.id AS source_id
        FROM "delivery_points" dp, unnest(dp.assigned_groups) AS g(name)
        WHERE dp.assigned_groups IS NOT NULL
      ) sources
      ORDER BY institution_id, lower(name), occurred_at ASC, source_id ASC
      `,
    );

    // --- 3. enrollments: grade_or_group (text) -> group_id (FK) ---
    await queryRunner.query(`ALTER TABLE "enrollments" ADD "group_id" uuid`);
    await queryRunner.query(
      `
      UPDATE "enrollments" e
      SET "group_id" = g.id
      FROM "institution_groups" g
      WHERE g.institution_id = e.institution_id
        AND lower(g.name) = lower(e.grade_or_group)
        AND e.grade_or_group IS NOT NULL
      `,
    );

    const [{ count: enrollmentsAfter }] = (await queryRunner.query(
      `SELECT count(*)::int AS count FROM "enrollments" WHERE "group_id" IS NOT NULL`,
    )) as { count: number }[];
    if (enrollmentsAfter !== enrollmentsBefore) {
      throw new Error(
        `InstitutionGroupsCatalog migration sanity check failed: enrollments with grade_or_group before (${enrollmentsBefore}) != enrollments with group_id after (${enrollmentsAfter})`,
      );
    }

    await queryRunner.query(
      `CREATE INDEX "IDX_52e3e34305ad0800648eab215e" ON "enrollments" ("group_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD CONSTRAINT "FK_52e3e34305ad0800648eab215ed" FOREIGN KEY ("group_id") REFERENCES "institution_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "enrollments" DROP COLUMN "grade_or_group"`);

    // --- 4. delivery_points -> delivery_point_groups relation table ---
    await queryRunner.query(
      `CREATE TABLE "delivery_point_groups" ("delivery_point_id" uuid NOT NULL, "group_id" uuid NOT NULL, CONSTRAINT "PK_bf4571f8e22848262f3374a0c13" PRIMARY KEY ("delivery_point_id", "group_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f28b3def7827ca968d38f019c3" ON "delivery_point_groups" ("group_id")`,
    );

    await queryRunner.query(
      `
      INSERT INTO "delivery_point_groups" (delivery_point_id, group_id)
      SELECT DISTINCT dp.id, g.id
      FROM "delivery_points" dp
      CROSS JOIN unnest(dp.assigned_groups) AS a(name)
      JOIN "institution_groups" g
        ON g.institution_id = dp.institution_id AND lower(g.name) = lower(a.name)
      WHERE dp.assigned_groups IS NOT NULL
      `,
    );

    const [{ count: deliveryPointsAfter }] = (await queryRunner.query(
      `SELECT count(DISTINCT delivery_point_id)::int AS count FROM "delivery_point_groups"`,
    )) as { count: number }[];
    if (deliveryPointsAfter !== deliveryPointsBefore) {
      throw new Error(
        `InstitutionGroupsCatalog migration sanity check failed: delivery_points with assigned_groups before (${deliveryPointsBefore}) != distinct delivery_point_id in delivery_point_groups after (${deliveryPointsAfter})`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "delivery_point_groups" ADD CONSTRAINT "FK_11106cfb9b44fd418b1655dc778" FOREIGN KEY ("delivery_point_id") REFERENCES "delivery_points"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_point_groups" ADD CONSTRAINT "FK_f28b3def7827ca968d38f019c36" FOREIGN KEY ("group_id") REFERENCES "institution_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`DROP INDEX "public"."IDX_delivery_points_assigned_groups"`);
    await queryRunner.query(`ALTER TABLE "delivery_points" DROP COLUMN "assigned_groups"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Best-effort data-preserving reversal: reconstructs the free-text columns
    // from the catalog/relation tables that are still present at this point.
    // Not guaranteed lossless if two case-variant names were fused into one
    // catalog row during up() (ADR-084 9.2/consequences) — that fusion cannot
    // be undone since the original distinct casings are no longer recorded.
    await queryRunner.query(
      `ALTER TABLE "delivery_points" ADD "assigned_groups" character varying(100) array`,
    );
    await queryRunner.query(
      `
      UPDATE "delivery_points" dp
      SET "assigned_groups" = names.groups
      FROM (
        SELECT dpg.delivery_point_id, array_agg(g.name) AS groups
        FROM "delivery_point_groups" dpg
        JOIN "institution_groups" g ON g.id = dpg.group_id
        GROUP BY dpg.delivery_point_id
      ) names
      WHERE names.delivery_point_id = dp.id
      `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_delivery_points_assigned_groups" ON "delivery_points" USING GIN ("assigned_groups")`,
    );

    await queryRunner.query(
      `ALTER TABLE "delivery_point_groups" DROP CONSTRAINT "FK_f28b3def7827ca968d38f019c36"`,
    );
    await queryRunner.query(
      `ALTER TABLE "delivery_point_groups" DROP CONSTRAINT "FK_11106cfb9b44fd418b1655dc778"`,
    );
    await queryRunner.query(`DROP TABLE "delivery_point_groups"`);

    await queryRunner.query(
      `ALTER TABLE "enrollments" ADD "grade_or_group" character varying(100)`,
    );
    await queryRunner.query(
      `
      UPDATE "enrollments" e
      SET "grade_or_group" = g.name
      FROM "institution_groups" g
      WHERE g.id = e.group_id
      `,
    );
    await queryRunner.query(
      `ALTER TABLE "enrollments" DROP CONSTRAINT "FK_52e3e34305ad0800648eab215ed"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_52e3e34305ad0800648eab215e"`);
    await queryRunner.query(`ALTER TABLE "enrollments" DROP COLUMN "group_id"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_institution_groups_name_ci"`);
    await queryRunner.query(
      `ALTER TABLE "institution_groups" DROP CONSTRAINT "FK_6826eabede0d16fdce0be5821ed"`,
    );
    await queryRunner.query(`DROP TABLE "institution_groups"`);
  }
}
